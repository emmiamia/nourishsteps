import hashlib
import os
import secrets
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from flask import Blueprint, request, jsonify, current_app
from sqlalchemy import text
from jsonschema import ValidationError
from agent.storage import factory
from agent.models import AgentSession, AgentAction, ReflectionEntry
from agent.tools import confirm_action, goal_json
from agent.orchestrator import run_turn, TurnFailure
from agent.provider import get_provider, provider_name, gemini_ready, ProviderUnavailable
from agent.policy import FALLBACK
from models import Goal

bp = Blueprint('agent',__name__,url_prefix='/api/agent')
BUCKETS = defaultdict(deque)

def owner():
    token = request.headers.get('X-Reflection-Owner','')
    if len(token) < 32 or len(token) > 128:
        raise ValueError('A local demo identity is required')
    return hashlib.sha256(token.encode()).hexdigest()

def body():
    data = request.get_json(silent=True)
    if not isinstance(data,dict):
        raise ValueError('Expected a JSON object')
    return data

def get_session(db,sid):
    row = db.query(AgentSession).filter_by(id=sid,owner_scope=owner()).first()
    if not row or row.expires_at <= datetime.utcnow():
        raise ValueError('Conversation expired or not found. Start a new reflection.')
    return row

@bp.before_request
def local_demo_only():
    if os.getenv('AGENT_ENABLED') != '1' and not current_app.config.get('AGENT_TESTING'):
        return jsonify(error='Reflection is disabled. Follow the local demo setup.'),503
    host = urlparse(request.host_url).hostname
    origin = request.headers.get('Origin')
    if request.remote_addr not in ['127.0.0.1','::1',None] or host not in ['localhost','127.0.0.1','::1']:
        return jsonify(error='V1 reflection is available only in a local synthetic-data demo.'),403
    if request.headers.get('X-Forwarded-For') or request.headers.get('Forwarded'):
        return jsonify(error='V1 agent access through a proxy is disabled.'),403
    if origin and urlparse(origin).hostname not in ['localhost','127.0.0.1','::1']:
        return jsonify(error='Origin not allowed'),403
    if request.method == 'OPTIONS':
        return None
    if request.content_length and request.content_length > 12000:
        return jsonify(error='Request too large'),413
    # Per-process limits are sufficient only for this local demo.
    if len(BUCKETS)>1000:
        BUCKETS.clear()
    bucket = BUCKETS[request.headers.get('X-Reflection-Owner','anonymous')]
    now = time.monotonic()
    while bucket and bucket[0] < now-60:
        bucket.popleft()
    if len(bucket)>=30:
        return jsonify(error='Please pause briefly before trying again.'),429
    bucket.append(now)
    # Expired conversation text and drafts are removed on the next request.
    try:
        with factory()() as db:
            expired = [s.id for s in db.query(AgentSession).filter(AgentSession.expires_at<=datetime.utcnow())]
            if expired:
                db.query(AgentAction).filter(AgentAction.session_id.in_(expired)).delete(synchronize_session=False)
                db.query(AgentSession).filter(AgentSession.id.in_(expired)).delete(synchronize_session=False)
            db.query(AgentAction).filter(AgentAction.expires_at<=datetime.utcnow(),AgentAction.status!='executed').delete(synchronize_session=False)
            db.commit()
    except Exception:
        return jsonify(error='Initialize the separate demo database: python -m agent.demo'),503

@bp.errorhandler(ValueError)
@bp.errorhandler(ValidationError)
def invalid(exc):
    return jsonify(error=str(exc).split('\n')[0][:240]),400

@bp.get('/status')
def status():
    return jsonify(enabled=True,provider=provider_name(),configured=gemini_ready() if provider_name()=='gemini' else False,dataset='synthetic_demo',version='v1')

@bp.post('/sessions')
def create_session():
    data = body()
    for key in ['history','notes']:
        if type(data.get(key)) is not bool:
            raise ValueError('Select history and notes permissions')
    tz = data.get('timezone','UTC')
    try:
        ZoneInfo(tz)
    except (ZoneInfoNotFoundError,TypeError,ValueError):
        raise ValueError('Invalid timezone')
    if data['notes'] and not data['history']:
        raise ValueError('Notes permission requires history permission')
    row = AgentSession(id=secrets.token_urlsafe(32),owner_scope=owner(),consent={'history':data['history'],'notes':data['notes'],'timezone':tz},expires_at=datetime.utcnow()+timedelta(hours=24))
    with factory()() as db:
        db.add(row); db.commit()
        return jsonify(id=row.id,consent=row.consent,state=row.state),201

@bp.post('/sessions/<sid>/messages')
def message(sid):
    data = body()
    msg = data.get('message')
    if not isinstance(msg,str) or not 1<=len(msg.strip())<=2000:
        raise ValueError('Write a message between 1 and 2000 characters')
    event = data.get('event')
    if event not in [None,'verify','correct','resume']:
        raise ValueError('Unknown conversation event')
    with factory()() as db:
        session = get_session(db,sid)
        if session.turn_count>=40:
            raise ValueError('Start a new reflection after 40 turns')
        try:
            # Construct lazily: stop and urgent routing work even without credentials.
            class LazyProvider:
                def respond(self,*args):
                    provider = current_app.config.get('AGENT_PROVIDER') or get_provider()
                    return provider.respond(*args)
            reply, _ = run_turn(db,session,msg,LazyProvider(),event)
            db.commit()
            return jsonify(reply)
        except ProviderUnavailable as exc:
            db.rollback()
            return jsonify(error=str(exc)),503
        except Exception:
            db.rollback()
            # Deliberately do not log provider requests, notes or exception bodies.
            return jsonify(error=FALLBACK),502

@bp.post('/sessions/<sid>/actions/<aid>')
def act(sid,aid):
    data = body()
    with factory()() as db:
        db.execute(text('BEGIN IMMEDIATE'))
        session = get_session(db,sid)
        action = db.query(AgentAction).filter_by(id=aid,session_id=sid,owner_scope=session.owner_scope).first()
        if not action:
            raise ValueError('Action not found')
        if data.get('decision') == 'cancel':
            if action.status == 'executed':
                raise ValueError('This action already executed')
            action.status = 'cancelled'; db.commit()
            return jsonify(cancelled=True,saved=False)
        if data.get('decision') != 'confirm':
            raise ValueError('Explicit confirmation is required')
        result = confirm_action(db,session,action,data.get('payload'),data.get('payload_hash'))
        db.commit()
        return jsonify(result)

@bp.get('/goals')
def goals():
    with factory()() as db:
        return jsonify(goals=[goal_json(g) for g in db.query(Goal).filter_by(owner_scope=owner()).order_by(Goal.id.desc()).limit(50)])

@bp.delete('/sessions/<sid>')
def delete_session(sid):
    with factory()() as db:
        row = get_session(db,sid)
        db.query(AgentAction).filter_by(session_id=sid,owner_scope=row.owner_scope).delete()
        db.delete(row); db.commit()
    return jsonify(deleted=True)

@bp.delete('/data')
def delete_owner_data():
    scope = owner()
    with factory()() as db:
        for model in [AgentAction,AgentSession,ReflectionEntry,Goal]:
            db.query(model).filter_by(owner_scope=scope).delete()
        db.commit()
    return jsonify(deleted=True)
