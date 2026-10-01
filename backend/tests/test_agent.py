import json
from datetime import datetime, timedelta, date
import pytest
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from agent.migrate import upgrade, downgrade
from agent.models import AgentSession, AgentAction, ReflectionEntry
from agent.storage import factory
from agent.tools import execute_tool, confirm_action, payload_hash
from agent.orchestrator import run_turn, TurnFailure
from agent.policy import validate_response
from agent.retrieval import retrieve
from models import Goal, Meal
from app import app

OWNER = 'test-owner-capability-12345678901234567890'
HEADERS = {'X-Reflection-Owner':OWNER}

def answer(message='What would you like to reflect on?',kind='conversation',evidence=None,sources=None):
    return {'calls':[],'items':[],'output':{'kind':kind,'message':message,'evidence_ids':evidence or [],'source_ids':sources or []}}

def call(name,args):
    return {'calls':[{'name':name,'arguments':json.dumps(args),'call_id':'c1'}], 'items':[{'type':'function_call','name':name,'arguments':json.dumps(args),'call_id':'c1'}], 'output':None}

class Scripted:
    def __init__(self,*responses): self.responses = iter(responses); self.inputs=[]
    def respond(self,*args):
        self.inputs.append(args)
        response = next(self.responses)
        if isinstance(response,Exception): raise response
        return response

@pytest.fixture
def client():
    app.config['TESTING']=True
    return app.test_client()

@pytest.fixture
def db():
    with factory()() as session:
        yield session
        session.rollback()

@pytest.fixture
def conversation(db):
    s=AgentSession(id='test-session',owner_scope='owner-a',consent={'history':True,'notes':True,'timezone':'UTC'},expires_at=datetime.utcnow()+timedelta(hours=1))
    db.add(s); db.flush()
    return s

def start(client, **permissions):
    r=client.post('/api/agent/sessions',headers=HEADERS,json={'history':True,'notes':True,'timezone':'UTC',**permissions})
    assert r.status_code==201
    return r.json['id']

def test_history_preserves_status_missingness_and_consent(db,conversation):
    db.add(Meal(date=date.today(),meal_type='lunch',status='skipped',note='private'))
    db.flush()
    conversation.consent={**conversation.consent,'notes':False}
    result=execute_tool('get_meal_history',{'days':7},db,conversation,{})
    assert result['records'][0]['status']=='skipped'
    assert 'note' not in result['records'][0]
    assert result['missing_means']=='unknown'
    conversation.consent={**conversation.consent,'history':False}
    with pytest.raises(ValueError): execute_tool('get_meal_history',{'days':7},db,conversation,{})

def test_tool_loop_returns_results_to_model(db,conversation):
    provider=Scripted(call('get_meal_history',{'days':7}),answer('There aren’t enough records to suggest a pattern.'))
    reply,trace=run_turn(db,conversation,'Look at recent meals',provider)
    assert trace[1]['name']=='get_meal_history'
    assert provider.inputs[1][1][-1]['type']=='function_call_output'
    assert 'enough' in reply['message']

def test_write_is_draft_then_confirmation_is_idempotent(db,conversation):
    result=execute_tool('create_reflection_goal',{'title':'Notice how my day feels'},db,conversation,{})
    assert db.query(Goal).count()==0
    action=db.get(AgentAction,result['action']['id'])
    edited={'title':'Ask a friend for company'}
    receipt=confirm_action(db,conversation,action,edited,action.payload_hash)
    again=confirm_action(db,conversation,action,edited,action.payload_hash)
    assert receipt==again and db.query(Goal).count()==1
    assert db.query(Goal).one().title==edited['title']

def test_cancelled_and_expired_drafts_cannot_execute(db,conversation):
    result=execute_tool('create_reflection_goal',{'title':'Notice my day'},db,conversation,{})
    action=db.get(AgentAction,result['action']['id'])
    action.status='cancelled'
    with pytest.raises(ValueError): confirm_action(db,conversation,action,action.payload,action.payload_hash)
    action.status='pending'; action.expires_at=datetime.utcnow()-timedelta(seconds=1)
    with pytest.raises(ValueError): confirm_action(db,conversation,action,action.payload,action.payload_hash)
    assert db.query(Goal).count()==0

def test_different_owner_cannot_read_or_change_goal(db,conversation):
    goal=Goal(title='Other owner',owner_scope='owner-b',status='active'); db.add(goal);db.flush()
    assert execute_tool('get_active_goals',{},db,conversation,{})['goals']==[]
    with pytest.raises(ValueError): execute_tool('update_goal',{'goal_id':goal.id,'status':'completed'},db,conversation,{})

def test_reflection_unknowns_stay_null_and_save_only_after_confirmation(db,conversation):
    fields={'date':date.today().isoformat(),'original_text':'Lunch felt rushed.','meal_type':'lunch','mood_label':None,'context_text':None}
    result=execute_tool('save_reflection',fields,db,conversation,{})
    assert db.query(ReflectionEntry).count()==0
    action=db.get(AgentAction,result['action']['id'])
    confirm_action(db,conversation,action,fields,action.payload_hash)
    assert db.query(ReflectionEntry).one().mood_label is None

def test_pattern_gate_and_correction(db,conversation):
    conversation.evidence={'meals:1':{'date':'2026-09-01'}}
    output=answer('Lunch might be harder. Does that fit?',kind='pattern',evidence=['meals:1'])['output']
    with pytest.raises(ValueError): validate_response(output,conversation,{})
    conversation.evidence={f'meals:{i}':{'date':f'2026-09-0{i}'} for i in range(1,4)}
    output['evidence_ids']=list(conversation.evidence)
    validate_response(output,conversation,{})
    conversation.state='rejected'
    with pytest.raises(ValueError): validate_response(output,conversation,{})

def test_citations_must_be_retrieved(db,conversation):
    output=answer('Options',kind='support',sources=['invented'])['output']
    with pytest.raises(ValueError): validate_response(output,conversation,{})

def test_unreviewed_expired_and_irrelevant_sources_excluded():
    base={'id':'x','tags':['stress'],'status':'source_checked_demo','review_due_at':'2099-01-01'}
    assert not retrieve('stress',records=[{**base,'status':'draft'}])
    assert not retrieve('stress',records=[{**base,'review_due_at':'2020-01-01'}])
    assert not retrieve('astrophysics',records=[base])
    assert retrieve('stress',records=[base])[0]['id']=='x'

@pytest.mark.parametrize('message,kind',[('I want to kill myself','urgent'),('Give me a calorie target','boundary'),('How do I purge?','boundary'),('Am I recovered?','boundary'),('Leave it here','paused')])
def test_safety_and_decline_bypass_model(db,conversation,message,kind):
    reply,trace=run_turn(db,conversation,message,Scripted())
    assert reply['kind']==kind and not trace
    assert not db.query(Goal).count()

def test_stop_cancels_existing_draft(db,conversation):
    execute_tool('create_reflection_goal',{'title':'Notice today'},db,conversation,{})
    run_turn(db,conversation,'Leave it here',Scripted())
    assert db.query(AgentAction).one().status=='cancelled'

def test_tool_budget_is_bounded(db,conversation):
    with pytest.raises(TurnFailure): run_turn(db,conversation,'Look at history',Scripted(*[call('get_meal_history',{'days':7})]*5))

def test_routes_confirmation_and_followup(client):
    sid=start(client)
    app.config['AGENT_PROVIDER']=Scripted(call('create_reflection_goal',{'title':'Ask a friend for company'}),answer('You can review this intention.',kind='draft'))
    reply=client.post(f'/api/agent/sessions/{sid}/messages',headers=HEADERS,json={'message':'Make an intention to ask a friend for company'})
    assert reply.status_code==200
    action=reply.json['actions'][0]
    with factory()() as db: assert not db.query(Goal).count()
    path=f'/api/agent/sessions/{sid}/actions/{action["id"]}'
    payload={'decision':'confirm','payload':action['payload'],'payload_hash':action['payload_hash']}
    assert client.post(path,headers=HEADERS,json=payload).json['saved']
    assert client.post(path,headers=HEADERS,json=payload).json['saved']
    assert len(client.get('/api/agent/goals',headers=HEADERS).json['goals'])==1
    stranger={'X-Reflection-Owner':'another-owner-1234567890123456789012345678'}
    assert not client.get('/api/agent/goals',headers=stranger).json['goals']
    assert client.post(path,headers=stranger,json=payload).status_code==400
    assert client.delete(f'/api/agent/sessions/{sid}',headers=HEADERS).status_code==200
    assert len(client.get('/api/agent/goals',headers=HEADERS).json['goals'])==1
    assert client.delete('/api/agent/data',headers=HEADERS).status_code==200
    assert not client.get('/api/agent/goals',headers=HEADERS).json['goals']

def test_failed_provider_rolls_back_drafts(client):
    sid=start(client)
    app.config['AGENT_PROVIDER']=Scripted(call('create_reflection_goal',{'title':'Notice today'}),RuntimeError('secret sensitive error'))
    response=client.post(f'/api/agent/sessions/{sid}/messages',headers=HEADERS,json={'message':'Please create an intention to notice today'})
    assert response.status_code==502
    assert 'secret' not in response.get_data(as_text=True)
    with factory()() as db: assert not db.query(AgentAction).count()

def test_local_only_and_origin_guard(client):
    assert client.get('/api/agent/status',environ_overrides={'REMOTE_ADDR':'203.0.113.5'}).status_code==403
    assert client.get('/api/agent/status',headers={'Origin':'https://evil.example'}).status_code==403
    assert client.get('/api/agent/status',headers={'Host':'evil.example'}).status_code==403

def test_migration_preserves_legacy_goal_and_rolls_back(tmp_path):
    engine=create_engine('sqlite:///'+str(tmp_path/'old.db'),future=True)
    with engine.begin() as conn:
        conn.execute(text('CREATE TABLE goals (id INTEGER PRIMARY KEY, title VARCHAR(200), status VARCHAR(16), created_at DATETIME)'))
        conn.execute(text("INSERT INTO goals (title,status) VALUES ('legacy','active')"))
    upgrade(engine);upgrade(engine)
    with engine.connect() as conn: assert conn.execute(text('SELECT title,owner_scope FROM goals')).first()==('legacy',None)
    downgrade(engine)
    assert 'owner_scope' not in {c['name'] for c in inspect(engine).get_columns('goals')}
    with engine.connect() as conn: assert conn.execute(text('SELECT title FROM goals')).scalar()=='legacy'

def test_summary_does_not_convert_logs_to_completed_days(client):
    from models import SessionLocal
    with SessionLocal() as db:
        db.add_all([Meal(date=date.today(),meal_type=t,status='skipped') for t in ['breakfast','lunch','dinner']]);db.commit()
    response=client.get('/api/meals/summary7').json
    assert response['counts']['completed']==0 and response['counts']['skipped']==3
    assert response['unknown_days']==6

def test_legacy_bad_inputs_are_400(client):
    assert client.post('/api/checkins',json={'date':'nonsense'}).status_code==400
    assert client.post('/api/checkins',json={'note':42}).status_code==400
    assert client.get('/api/meals?limit=nope').status_code==400

def test_status_update_requires_confirmation_and_cannot_retarget(db,conversation):
    first=Goal(title='First intention',status='active',owner_scope=conversation.owner_scope)
    second=Goal(title='Second intention',status='active',owner_scope=conversation.owner_scope)
    db.add_all([first,second]);db.flush()
    result=execute_tool('update_goal',{'goal_id':first.id,'status':'paused'},db,conversation,{})
    action=db.get(AgentAction,result['action']['id'])
    assert first.status=='active'
    with pytest.raises(ValueError): confirm_action(db,conversation,action,{'goal_id':second.id,'status':'completed'},action.payload_hash)
    confirm_action(db,conversation,action,action.payload,action.payload_hash)
    assert first.status=='paused' and second.status=='active'

def test_expired_session_is_removed_on_request(client):
    sid=start(client)
    with factory()() as db:
        row=db.get(AgentSession,sid);row.expires_at=datetime.utcnow()-timedelta(seconds=1);db.commit()
    response=client.post(f'/api/agent/sessions/{sid}/messages',headers=HEADERS,json={'message':'hello'})
    assert response.status_code==400
    with factory()() as db: assert db.get(AgentSession,sid) is None

def test_draft_stale_hash_and_changed_replay_are_rejected(db,conversation):
    result=execute_tool('create_reflection_goal',{'title':'Notice today'},db,conversation,{})
    action=db.get(AgentAction,result['action']['id'])
    with pytest.raises(ValueError): confirm_action(db,conversation,action,action.payload,'stale')
    confirm_action(db,conversation,action,action.payload,action.payload_hash)
    with pytest.raises(ValueError): confirm_action(db,conversation,action,{'title':'Something different'},action.payload_hash)
    assert db.query(Goal).count()==1

def test_function_argument_schema_rejects_unknown_user_id(db,conversation):
    from jsonschema import ValidationError
    with pytest.raises(ValidationError): execute_tool('get_meal_history',{'days':7,'userId':'other'},db,conversation,{})

def test_migration_refuses_downgrade_with_confirmed_agent_data(tmp_path):
    engine=create_engine('sqlite:///'+str(tmp_path/'agent.db'),future=True)
    upgrade(engine)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO goals (title,status,owner_scope) VALUES ('saved','active','owner')"))
    with pytest.raises(ValueError): downgrade(engine)
    with engine.connect() as conn: assert conn.execute(text('SELECT title FROM goals')).scalar()=='saved'

def test_provider_request_contract_without_network(monkeypatch):
    import openai
    from types import SimpleNamespace
    from agent.provider import OpenAIProvider
    captured={}
    def create(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(output=[],output_text=json.dumps(answer()['output']),usage=None)
    monkeypatch.setenv('AGENT_PROVIDER','openai')
    monkeypatch.setenv('ALLOW_PAID_OPENAI','1')
    monkeypatch.setenv('OPENAI_API_KEY','test-key-not-real')
    monkeypatch.setattr(openai,'OpenAI',lambda **kwargs: SimpleNamespace(responses=SimpleNamespace(create=create)))
    provider=OpenAIProvider()
    result=provider.respond('rules',[{'role':'user','content':'Hello'}],[])
    assert captured['store'] is False
    assert captured['parallel_tool_calls'] is False
    assert captured['text']['format']['strict'] is True
    assert result['output']['kind']=='conversation'

def test_agent_rejects_proxied_access_even_if_peer_is_local(client):
    response=client.get('/api/agent/status',headers={'X-Forwarded-For':'203.0.113.5'})
    assert response.status_code==403

def test_pattern_and_action_cannot_be_offered_before_verification(db,conversation):
    for i in range(3):
        db.add(Meal(date=date.today()-timedelta(days=i),meal_type='lunch',status='partial',note='Rushed between classes'))
    db.flush()
    provider=Scripted(call('get_meal_history',{'days':7}),call('create_reflection_goal',{'title':'Ask a friend for company'}),answer('Lunch might be harder on class days. Does that fit?',kind='pattern',evidence=['meals:1','meals:2','meals:3']))
    with pytest.raises(ValueError,match='Verify'): run_turn(db,conversation,'Look for a pattern',provider)
    db.rollback()
    assert db.query(Goal).count()==0
