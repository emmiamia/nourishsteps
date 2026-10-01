"""Synthetic-evaluation diagnostics only; no model calls or agent changes."""
import ast
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Suppress the whole candidate if it resembles credentials or private identifiers.
SENSITIVE = re.compile(r'(?i)(api[_ -]?key|authorization|bearer\s|password|secret|token\s*[:=]|AIza|sk-|https?://|[\w.+-]+@[\w.-]+|[A-Za-z0-9_+/=-]{28,})')
TOOLS = {'get_meal_history','get_recent_reflections','get_active_goals','get_support_content','create_reflection_goal','update_goal','save_reflection'}
FILES = {'agent/orchestrator.py','agent/policy.py','agent/tools.py','agent/provider.py','evals/runner.py'}
EXCEPTIONS = {'ValueError','ValidationError','KeyError','TypeError','RuntimeError','TurnFailure','ProviderUnavailable','JSONDecodeError'}
STATES = {'observing','awaiting_verification','clarifying','rejected','paused','closed','offering'}


def failure_observation(exc, session, trace):
    """Called BEFORE rollback. Never serialize traceback locals wholesale."""
    try:
        frames = []
        tb = exc.__traceback__
        output = None
        while tb:
            frame = tb.tb_frame
            path = Path(frame.f_code.co_filename).resolve()
            if path.is_relative_to(ROOT):
                relative = str(path.relative_to(ROOT))
                if relative in FILES:
                    frames.append((relative, frame.f_code.co_name, tb.tb_lineno, path))
                if relative == 'agent/orchestrator.py' and frame.f_code.co_name == 'run_turn':
                    output = frame.f_locals.get('output')
            tb = tb.tb_next
        origin = frames[-1] if frames else None
        # Preserve only an exact static ValueError literal at the raising line.
        # Arbitrary SDK/schema/DB messages may echo secrets or full objects.
        message = '[omitted: non-allowlisted exception message]'
        if type(exc) is ValueError and origin:
            tree = ast.parse(origin[3].read_text())
            for node in ast.walk(tree):
                if isinstance(node, ast.Raise) and node.lineno == origin[2]:
                    call = node.exc
                    if isinstance(call, ast.Call) and isinstance(call.func, ast.Name) and call.func.id == 'ValueError' and len(call.args) == 1 and isinstance(call.args[0], ast.Constant) and isinstance(call.args[0].value, str) and exc.args == (call.args[0].value,):
                        message = call.args[0].value
        candidate = None
        omitted = 'not available or unsafe/unexpected shape'
        if type(output) is dict and set(output) == {'kind','message','evidence_ids','source_ids'}:
            strings = [output['kind'], output['message']]
            arrays = [output['evidence_ids'], output['source_ids']]
            if all(type(v) is str and len(v)<=1200 for v in strings) and all(type(a) is list and len(a)<=20 and all(type(v) is str and len(v)<=120 for v in a) for a in arrays):
                strings += [v for a in arrays for v in a]
                if not any(SENSITIVE.search(v) for v in strings):
                    candidate = {k:(list(v) if type(v) is list else v) for k,v in output.items()}
                    omitted = None
        state = session.__dict__.get('state')  # No ORM refresh/query.
        return {'exception_type':type(exc).__name__ if type(exc).__name__ in EXCEPTIONS else 'OtherException', 'exception_message':message,
                'check_location':None if not origin else {'file':origin[0], 'function':origin[1], 'line':origin[2], 'source_sha256':hashlib.sha256(origin[3].read_bytes()).hexdigest()},
                'state_at_failure':state if state in STATES else None,
                'tool_sequence':[t['name'] if t.get('name') in TOOLS else '[unknown tool]' for t in trace if t.get('event')=='tool'],
                'rejected_output_at_failure':candidate, 'output_omission_reason':omitted}
    except Exception:
        # Diagnostic failure must never replace the original error or its checks.
        return {'capture_failed':True}
