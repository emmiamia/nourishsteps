import hashlib
import json
import secrets
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo
from jsonschema import validate
from models import Meal, CheckIn, Goal
from agent.models import ReflectionEntry, AgentAction
from agent.retrieval import retrieve
from agent.policy import screen_input, BAD_OUTPUT

DAY_SCHEMA = {'type':'object','properties':{'days':{'type':'integer','minimum':1,'maximum':30}},'required':['days'],'additionalProperties':False}
EMPTY = {'type':'object','properties':{},'required':[],'additionalProperties':False}
def obj(props):
    return {'type':'object','properties':props,'required':list(props),'additionalProperties':False}
def string(maximum=500):
    return {'type':'string','minLength':1,'maxLength':maximum}
def nullable(maximum=500):
    return {'type':['string','null'],'maxLength':maximum}

PAYLOAD_SCHEMAS = {
    'goal': obj({'title':string(200)}),
    'goal_update': obj({'goal_id':{'type':'integer','minimum':1},'status':{'type':'string','enum':['active','completed','paused','archived']}}),
    'reflection': obj({'date':string(10),'original_text':string(1000),'meal_type':{'type':['string','null'],'enum':['breakfast','lunch','dinner','snack',None]},'mood_label':nullable(80),'context_text':nullable(500)}),
}
DEFS = [
    ('get_meal_history','Read synthetic meal records only when history permission is enabled. Missing records are unknown. Never infer meal time from created_at.',DAY_SCHEMA),
    ('get_recent_reflections','Read check-ins and confirmed reflections when history permission is enabled. Numeric mood is not a stress label.',DAY_SCHEMA),
    ('get_active_goals','Read the current demo owner’s intentions only when the user asks to revisit them.',EMPTY),
    ('get_support_content','Retrieve source-checked general support; return no match if unavailable. No clinical treatment or nutrition prescription.',obj({'topic':string(200)})),
    ('create_reflection_goal','Propose a user-directed intention. Returns a confirmation card; does NOT save a goal until the user confirms the exact text.',PAYLOAD_SCHEMAS['goal']),
    ('update_goal','Propose changing a goal status, only at the user’s request. Requires a confirmation card.',PAYLOAD_SCHEMAS['goal_update']),
    ('save_reflection','Propose a structured reflection from the current user’s words. Unknown fields are null. No silent journal writes: requires user review and confirmation.',PAYLOAD_SCHEMAS['reflection']),
]
SCHEMAS = {name:schema for name, _, schema in DEFS}
KINDS = {'create_reflection_goal':'goal','update_goal':'goal_update','save_reflection':'reflection'}

def tool_definitions(session):
    names = set(SCHEMAS)
    if not session.consent['history']:
        names -= {'get_meal_history','get_recent_reflections'}
    if session.state == 'awaiting_verification':
        names -= set(KINDS)
    return [{'type':'function','name':n,'description':d,'strict':True,'parameters':s} for n,d,s in DEFS if n in names]

def payload_hash(payload):
    return hashlib.sha256(json.dumps(payload,sort_keys=True,ensure_ascii=False).encode()).hexdigest()

def validate_payload(kind, payload):
    validate(payload,PAYLOAD_SCHEMAS[kind])
    if kind == 'reflection':
        date.fromisoformat(payload['date'])
    prose = ' '.join(str(v) for k,v in payload.items() if k not in ['date','goal_id','status'] and v)
    result = screen_input(prose)
    if (result and result[0] in ['urgent','boundary']) or BAD_OUTPUT.search(prose):
        raise ValueError('This draft is outside the reflection agent’s scope.')

def goal_json(goal):
    return {'id':goal.id,'title':goal.title,'status':goal.status,'last_reviewed_at':goal.last_reviewed_at.isoformat() if goal.last_reviewed_at else None}

def action_json(action):
    return {'id':action.id,'kind':action.kind,'payload':action.payload,'payload_hash':action.payload_hash,'status':action.status,'result':action.result}

def execute_tool(name, args, db, session, retrieved):
    if name not in {t['name'] for t in tool_definitions(session)}:
        raise ValueError('Tool not permitted in this state or consent scope')
    validate(args,SCHEMAS[name])
    if name in ['get_meal_history','get_recent_reflections']:
        today = datetime.now(ZoneInfo(session.consent['timezone'])).date()
        start = today - timedelta(days=args['days']-1)
        models = [Meal] if name == 'get_meal_history' else [CheckIn,ReflectionEntry]
        rows = []
        truncated = False
        for model in models:
            query = db.query(model).filter(model.date >= start, model.date <= today)
            if model == ReflectionEntry:
                query = query.filter(model.owner_scope == session.owner_scope)
            found = query.order_by(model.date.desc(),model.id.desc()).limit(101).all()
            truncated |= len(found) > 100
            for row in found[:100]:
                ref = f'{model.__tablename__}:{row.id}'
                item = {'ref':ref,'date':row.date.isoformat()}
                for key in (['meal_type','status'] if model == Meal else ['mood','urge','meal_status'] if model == CheckIn else ['meal_type']):
                    item[key] = getattr(row,key)
                if session.consent['notes']:
                    if model == ReflectionEntry:
                        item.update(original_text=row.original_text,mood_label=row.mood_label,context_text=row.context_text)
                    else:
                        item['note'] = row.note
                rows.append(item)
        evidence = dict(session.evidence or {})
        evidence.update({r['ref']:r for r in rows})
        session.evidence = evidence
        return {'records':rows,'window':{'from':start.isoformat(),'through':today.isoformat()},'truncated':truncated,'missing_means':'unknown','dataset':'synthetic_demo','numeric_mood_is_not_context':True}
    if name == 'get_active_goals':
        return {'goals':[goal_json(g) for g in db.query(Goal).filter(Goal.owner_scope==session.owner_scope,Goal.status.in_(['active','paused'])).limit(30)]}
    if name == 'get_support_content':
        matches = retrieve(args['topic'])
        retrieved.update({r['id']:r for r in matches})
        return {'sources':matches,'scope':'general support, source checked for demo; not clinically reviewed'}
    kind = KINDS[name]
    validate_payload(kind,args)
    if kind == 'goal_update' and not db.query(Goal).filter_by(id=args['goal_id'],owner_scope=session.owner_scope).first():
        raise ValueError('Goal not found')
    if db.query(AgentAction).filter_by(session_id=session.id,status='pending').count() >= 1:
        raise ValueError('Resolve the existing confirmation card first')
    action = AgentAction(id=secrets.token_urlsafe(24),session_id=session.id,owner_scope=session.owner_scope,kind=kind,payload=args,payload_hash=payload_hash(args),expires_at=datetime.utcnow()+timedelta(minutes=15))
    db.add(action)
    db.flush()
    return {'status':'requires_confirmation','action':action_json(action),'saved':False}

def confirm_action(db, session, action, payload, expected_hash):
    # The route holds a SQLite write transaction. No model can approve an action.
    if action.owner_scope != session.owner_scope or action.session_id != session.id:
        raise ValueError('Action not found')
    if session.state in ['awaiting_verification','closed','paused']:
        raise ValueError('This conversation is not accepting actions')
    if action.status == 'executed':
        if payload_hash(payload) != action.payload_hash:
            raise ValueError('This action already executed with different text')
        return action.result
    if action.status != 'pending' or action.expires_at < datetime.utcnow():
        raise ValueError('Confirmation expired or cancelled')
    if expected_hash != action.payload_hash:
        raise ValueError('Draft changed; review it again')
    validate_payload(action.kind,payload)
    if action.kind == 'goal_update' and payload['goal_id'] != action.payload['goal_id']:
        raise ValueError('A confirmation cannot target a different goal')
    now = datetime.utcnow()
    if action.kind == 'goal':
        record = Goal(title=payload['title'],status='active',owner_scope=session.owner_scope,source='agent_confirmed',updated_at=now)
        db.add(record)
    elif action.kind == 'goal_update':
        record = db.query(Goal).filter_by(id=payload['goal_id'],owner_scope=session.owner_scope).first()
        if not record:
            raise ValueError('Goal not found')
        record.status = payload['status']
        record.updated_at = record.last_reviewed_at = now
    else:
        record = ReflectionEntry(owner_scope=session.owner_scope,**{**payload,'date':date.fromisoformat(payload['date'])})
        db.add(record)
    db.flush()
    result = {'kind':action.kind,'id':record.id,'saved':True}
    action.payload = payload
    action.payload_hash = payload_hash(payload)
    action.approved_at = now
    action.status = 'executed'
    action.result = result
    session.state = 'offering'
    return result
