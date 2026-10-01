"""Offline-only logging tests; scripted responses never invoke a provider API."""
import copy
import json
from types import SimpleNamespace
import pytest
import httpx
from evals import runner
from evals.diagnostics import failure_observation

@pytest.fixture(autouse=True)
def deny_network(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError('Network forbidden in observability tests')
    monkeypatch.setattr(httpx.Client, 'send', forbidden)


def case():
    return {'id':'offline-observation','category':'test','fixture':'pattern',
            'consent':{'history':True,'notes':True,'timezone':'UTC'},
            'turns':[{'message':'Fictional reflection'}],
            'required_tools':[],'forbidden_tools':[],
            'expected_goals':0,'expected_reflections':0}


def output(message='A fictional observation.', **changes):
    return dict(kind='conversation',message=message,evidence_ids=[],source_ids=[],**changes)


class Scripted:
    def __init__(self, candidate, tool=False):
        self.candidate=candidate; self.tool=tool
    def respond(self,*args):
        if self.tool:
            self.tool=False
            return {'calls':[{'name':'get_meal_history','arguments':'{"days":7}','call_id':'offline-call'}], 'items':[], 'output':None}
        return {'calls':[],'items':[], 'output':copy.deepcopy(self.candidate),
                'never_log_headers':{'Authorization':'Bearer HIDDEN_HEADER'},
                'never_log_reasoning':'HIDDEN_REASONING',
                'never_log_request':'HIDDEN_REQUEST'}


def comparable(result):
    return {k:v for k,v in result.items() if k not in ('latency_seconds','failure_observability')}


@pytest.mark.parametrize('fail',[False,True])
def test_logging_does_not_change_results(monkeypatch,fail):
    candidate=output('A fictional observation.' if not fail else 'This proves that school is the cause.')
    observed=runner.run_case(case(),Scripted(candidate,tool=True))
    monkeypatch.setattr(runner,'failure_observation',lambda *args: None)
    baseline=runner.run_case(case(),Scripted(candidate,tool=True))
    assert comparable(observed)==comparable(baseline)
    assert observed['deterministic_pass'] is (not fail)
    assert observed['rubric'] is None and observed['overall_pass'] is None


def test_message_location_output_state_and_sequence():
    c=case(); c['initial_state']='awaiting_verification'
    c['turns'][0]['event']='correct'
    candidate=output('This proves that school is the cause.')
    result=runner.run_case(c,Scripted(candidate,tool=True))
    d=result['failure_observability']
    assert d['exception_type']=='ValueError'
    assert d['exception_message']=='Unsupported or unsafe output'
    assert d['check_location']['file']=='agent/policy.py'
    assert d['check_location']['function']=='validate_response'
    assert d['check_location']['line']==31
    assert len(d['check_location']['source_sha256'])==64
    assert d['state_at_failure']=='rejected'
    assert d['tool_sequence']==['get_meal_history']
    assert d['rejected_output_at_failure']==candidate
    assert d['output_omission_reason'] is None
    assert all(v not in json.dumps(d) for v in ['HIDDEN_HEADER','HIDDEN_REASONING','HIDDEN_REQUEST'])


@pytest.mark.parametrize('sensitive',[
    'GEMINI_API_KEY=FAKE_KEY', 'Authorization: Bearer FAKE_VALUE',
    'password=FAKE_VALUE', 'secret FAKE_VALUE', 'token=FAKE_VALUE',
    'AIzaFAKE_NOT_A_KEY','sk-FAKE_NOT_A_KEY','https://example.invalid/?key=FAKE_VALUE',
    'person@example.invalid','ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
])
def test_sensitive_candidates_omitted(sensitive):
    result=runner.run_case(case(),Scripted(output('This proves that '+sensitive)))
    d=result['failure_observability']
    assert d['rejected_output_at_failure'] is None
    assert sensitive not in json.dumps(d)


def test_unknown_fields_and_schema_exception_never_dump_instance():
    candidate=output(); candidate['headers']={'Authorization':'FAKE_HEADER'}
    result=runner.run_case(case(),Scripted(candidate))
    d=result['failure_observability']
    assert d['exception_type']=='ValidationError'
    assert 'omitted' in d['exception_message']
    assert d['rejected_output_at_failure'] is None
    assert 'FAKE_HEADER' not in json.dumps(d)


def test_unknown_exception_and_tool_names_cannot_echo_secrets():
    SecretNamedError=type('FAKE_SECRET_IN_CLASS_NAME',(Exception,),{})
    try: raise SecretNamedError('FAKE_SECRET_MESSAGE')
    except Exception as exc:
        d=failure_observation(exc,SimpleNamespace(state='observing'),[{'event':'tool','name':'FAKE_SECRET_TOOL'}])
    assert d['exception_type']=='OtherException'
    assert d['tool_sequence']==['[unknown tool]']
    assert 'FAKE_SECRET' not in json.dumps(d)


def test_capture_failure_does_not_replace_evaluation_error(monkeypatch):
    import evals.diagnostics as diagnostics
    monkeypatch.setattr(diagnostics.ast,'parse',lambda *a: (_ for _ in ()).throw(RuntimeError('FAKE_SECRET')))
    result=runner.run_case(case(),Scripted(output('This proves that school is the cause.')))
    assert result['failure_observability']=={'capture_failed':True}
    assert result['error']=='ValueError'
    assert result['failures']==['Turn failed: ValueError']
    assert result['outputs']==[]

@pytest.mark.parametrize('changes,expected',[
    ({'evidence_ids':['missing:1']},'Unknown evidence'),
    ({'source_ids':['missing-source']},'Source was not retrieved this turn'),
    ({'kind':'pattern'},'Insufficient evidence or unverified/rejected hypothesis'),
    ({'kind':'pattern','evidence_ids':['meals:1','meals:2','meals:3']},'Pattern must be tentative and ask for verification'),
    ({'kind':'support'},'Support requires a retrieved source'),
])
def test_other_policy_checks_have_exact_static_messages(changes,expected):
    candidate=output(); candidate.update(changes)
    d=runner.run_case(case(),Scripted(candidate,tool=True))['failure_observability']
    assert d['exception_message']==expected
    assert d['check_location']['file']=='agent/policy.py'
    assert d['rejected_output_at_failure']==candidate


def test_diagnostic_does_not_copy_tool_payloads():
    try: raise RuntimeError('FAKE_PRIVATE_EXCEPTION')
    except RuntimeError as exc:
        d=failure_observation(exc,SimpleNamespace(state='observing'),[
            {'event':'tool','name':'get_meal_history','arguments':{'secret':'FAKE_PRIVATE_ARGUMENT'},
             'result':{'headers':'FAKE_PRIVATE_HEADER','request_body':'FAKE_PRIVATE_BODY','reasoning':'FAKE_PRIVATE_REASONING'}}])
    assert d['tool_sequence']==['get_meal_history']
    assert 'FAKE_PRIVATE' not in json.dumps(d)
