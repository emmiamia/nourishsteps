import json
import time
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from jsonschema import validate, ValidationError
from agent.policy import FINAL_SCHEMA, screen_input, validate_response, FALLBACK
from agent.tools import execute_tool, tool_definitions, action_json
from agent.models import AgentAction

PROMPT = Path(__file__).parent / 'prompts' / 'v1.md'

class TurnFailure(RuntimeError):
    pass

def run_turn(db, session, message, provider, event=None, trace=None):
    trace = [] if trace is None else trace
    started = time.monotonic()
    screened = screen_input(message)
    if screened:
        kind, reply = screened
        session.state = 'paused' if kind == 'paused' else 'closed' if kind == 'urgent' else session.state
        for action in db.query(AgentAction).filter_by(session_id=session.id,status='pending'):
            action.status = 'cancelled'
        result = {'kind':kind,'message':reply,'evidence':[],'sources':[],'actions':[],'state':session.state}
        remember(session,message,result)
        return result, trace
    if session.state == 'closed':
        raise TurnFailure('Start a new conversation to continue.')
    if event == 'verify':
        if session.state != 'awaiting_verification':
            raise TurnFailure('There is no pattern awaiting verification.')
        session.state = 'clarifying'
        session.hypothesis = {**(session.hypothesis or {}),'status':'user_confirmed'}
    elif event == 'correct':
        for action in db.query(AgentAction).filter_by(session_id=session.id,status='pending'):
            action.status = 'cancelled'
        session.state = 'rejected'
        session.hypothesis = {**(session.hypothesis or {}),'status':'rejected','correction':message}
    elif event == 'resume':
        session.state = 'observing'
    elif session.state == 'paused':
        session.state = 'observing'
    instructions = PROMPT.read_text() + '\nServer context: ' + json.dumps({
        'state':session.state,'consent':session.consent,'event':event,
        'hypothesis_status':(session.hypothesis or {}).get('status'),
        'today':datetime.now(ZoneInfo(session.consent['timezone'])).date().isoformat(),
    })
    inputs = [{'role':r['role'],'content':r['content']} for r in (session.transcript or [])[-12:]]
    inputs.append({'role':'user','content':message})
    retrieved = {}
    tool_count = 0
    for iteration in range(4):
        if time.monotonic()-started > 65:
            raise TurnFailure('Turn time limit reached')
        response = provider.respond(instructions,inputs,tool_definitions(session))
        trace.append({'event':'model','usage':response.get('usage',{})})
        if response['calls']:
            inputs.extend(response['items'])
            for call in response['calls']:
                tool_count += 1
                if tool_count > 6:
                    raise TurnFailure('Tool limit reached')
                args = {}
                try:
                    args = json.loads(call['arguments'])
                    result = execute_tool(call['name'],args,db,session,retrieved)
                except (ValueError, KeyError, TypeError, ValidationError) as exc:
                    result = {'error':str(exc).split('\n')[0][:200],'saved':False}
                # Trace is returned only to the synthetic evaluation harness, never HTTP clients.
                trace.append({'event':'tool','name':call['name'],'arguments':args if 'args' in locals() else {},'result':result})
                inputs.append({'type':'function_call_output','call_id':call['call_id'],'output':json.dumps(result)})
            continue
        output = response['output']
        validate(output,FINAL_SCHEMA)
        validate_response(output,session,retrieved)
        if output['kind'] == 'pattern':
            if db.query(AgentAction).filter_by(session_id=session.id,status='pending').count():
                raise ValueError('Verify the observation before proposing actions')
            session.state = 'awaiting_verification'
            session.hypothesis = {'text':output['message'],'evidence_ids':output['evidence_ids'],'status':'unverified'}
        actions = db.query(AgentAction).filter_by(session_id=session.id,status='pending').all()
        actions = [a for a in actions if a.expires_at > datetime.utcnow()]
        result = {**output,'state':session.state,'evidence':[session.evidence[k] for k in output['evidence_ids']],
                  'sources':[retrieved[k] for k in output['source_ids']], 'actions':[action_json(a) for a in actions]}
        remember(session,message,result)
        return result, trace
    raise TurnFailure('Model request limit reached')

def remember(session,message,result):
    session.transcript = ((session.transcript or []) + [{'role':'user','content':message},{'role':'assistant','content':result['message']}])[-12:]
    session.turn_count += 1
