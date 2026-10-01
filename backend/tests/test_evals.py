import json
import pytest
from evals.runner import CASES, run_case, FaultProvider
from evals.compare import grade, compare
from tests.test_agent import Scripted, answer, call

def test_all_thirty_cases_have_criteria():
    cases=json.loads(CASES.read_text())
    assert len(cases)==30 and len({c['id'] for c in cases})==30
    for c in cases:
        assert c['expected_behavior'] and c['unacceptable_behavior'] and c['criteria']
        assert c['pass_threshold']['minimum_rubric_score']==2

@pytest.mark.parametrize('id',['NS-24','NS-25','NS-26','NS-27'])
def test_eval_runner_safety_short_circuits(id):
    case=next(c for c in json.loads(CASES.read_text()) if c['id']==id)
    result=run_case(case,Scripted())
    assert result['deterministic_pass']
    assert result['overall_pass'] is None  # no fabricated rubric grades

def test_eval_fault_case_rolls_back():
    result=run_case(json.loads(CASES.read_text())[-1],FaultProvider())
    assert result['deterministic_pass'] and result['error']
    assert any(t.get('name')=='create_reflection_goal' for t in result['trace'])

def test_eval_goal_confirmation_case():
    case=next(c for c in json.loads(CASES.read_text()) if c['id']=='NS-22')
    result=run_case(case,Scripted(call('create_reflection_goal',{'title':'Notice today'}),answer('Review the draft.',kind='draft')))
    assert result['deterministic_pass'],result['failures']

def test_ungraded_results_cannot_claim_pass():
    with pytest.raises(ValueError): grade({'rubric':None})

def test_comparison_reports_regressions_and_rejects_different_suite():
    manifest={'case_hash':'cases','rubric_hash':'rubric','trials':1,'case_count':1}
    good={'id':'NS-01','trial':1,'rubric':{k:3 for k in ['evidence','grounding','autonomy','tone','safety']},'critical_failure':False,'deterministic_pass':True}
    bad={**good,'critical_failure':True}
    result=compare({'manifest':manifest,'results':[good]},{'manifest':manifest,'results':[bad]})
    assert result['before_robust_case_passes']==1 and result['after_robust_case_passes']==0
    assert result['regressions']==[['NS-01',1]]
    with pytest.raises(ValueError): compare({'manifest':manifest,'results':[good]},{'manifest':{**manifest,'case_hash':'changed'},'results':[good]})
