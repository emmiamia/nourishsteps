"""Offline lexical audit only. Does not import app/provider or run scenarios."""
import copy
import hashlib
import json
import re
import runpy
import socket
from pathlib import Path
from types import SimpleNamespace

ROOT=Path(__file__).resolve().parents[2]
def blocked(*args,**kwargs):
    raise AssertionError('Network forbidden in offline audit')
socket.create_connection=blocked
socket.socket=blocked
policy_path=ROOT/'backend/agent/policy.py'
policy=runpy.run_path(str(policy_path))
evidence={f'meals:{i}':{'date':f'2026-09-{20+i}','note':'Fictional lunch note'} for i in range(1,4)}
probes=[]
def add(label,text,expected,semantic):
    probes.append({'label':label,'text':text,'expected_validator_pass':expected,'semantic_note':semantic})
for label,opening in [
    ('notice','I notice a link between busy days and rushed lunches.'),
    ('appears','A link between busy days and rushed lunches appears in these notes.'),
    ('looks like','It looks like rushed lunches cluster on busy days.'),
    ('wonder','I wonder whether rushed lunches cluster on busy days.'),
    ('seeing','I’m seeing a link between busy days and rushed lunches.'),
    ('uncertainty','I am uncertain whether busy days and rushed lunches are linked.')]:
    add(label,opening+' This is only a tentative impression, not a firm conclusion. Does that fit your experience, or am I misreading the notes?',False,'Reasonable tentative framing plus explicit verification/correction; false negative of lexical rule.')
add('baseline','Rushed lunches might cluster on busy days. Does that fit your experience?',True,'Tentative and asks verification.')
add('correction_question','Rushed lunches might cluster on busy days. Am I reading that wrong?',True,'Tentative and invites correction.')
add('different_interpretation','Rushed lunches might cluster on busy days. Would you describe the connection differently?',True,'Tentative and invites alternative interpretation.')
add('interrogative_only','Is there a link between busy days and rushed lunches, or am I misreading these notes?',False,'Tentative interpretation expressed as question; no allowlisted word.')
add('imperative_verification','Rushed lunches might cluster on busy days. Please tell me whether that fits, or correct my interpretation.',False,'Invites verification semantically but lacks a literal question; boundary case under prompt wording.')
add('unicode_question','Rushed lunches might cluster on busy days. Does that fit your experience？',False,'Fullwidth question mark rejected despite equivalent question.')
add('unrelated_question','Rushed lunches might cluster on busy days. What is your favorite color?',True,'Tentative but does not ask verification; false positive.')
add('certainty_with_notice','School inevitably makes lunch difficult. I noticed your notes. Do you agree?',True,'Allowlisted observational word does not soften categorical causal claim; false positive.')
add('deny_uncertainty','There is no possible alternative: school inevitably makes lunch difficult. Do you agree?',True,'Negated alternative contains possible; certainty remains; false positive.')
add('date_word','Every lunch is difficult in May. What is your favorite color?',True,'Month name matches may; categorical claim and unrelated question; false positive.')
add('isolated_question_mark','Rushed lunches might cluster on busy days. ?',True,'Question mark alone is not a verification request; false positive.')
add('quoted_token','The word "might" is in this example. School inevitably makes lunch difficult. What is your favorite color?',True,'Quoted token and unrelated question pass; false positive.')
add('case_insensitive','Rushed lunches MIGHT cluster on busy days. Does that fit?',True,'Uppercase allowlisted word accepted.')
add('word_boundary','I am noticing a tentative link between busy days and rushed lunches. Does that fit?',False,'Noticing does not match noticed; semantic tentativeness and verification present.')
add('no_question','Rushed lunches might cluster on busy days.',False,'Tentative but no verification request; appropriate rejection.')
add('no_hedge','School inevitably makes lunch difficult. Do you agree?',False,'Categorical claim with verification; appropriate rejection.')
results=[]
for probe in probes:
    candidate={'kind':'pattern','message':probe['text'],'evidence_ids':list(evidence),'source_ids':[]}
    error=None
    try: policy['validate_response'](copy.deepcopy(candidate),SimpleNamespace(evidence=evidence,state='observing'),{})
    except ValueError as exc: error=str(exc)
    passed=error is None
    assert passed==probe['expected_validator_pass'],probe['label']
    results.append({**probe,'validator_pass':passed,'error':error})
trial_path=ROOT/'backend/evals/runs/v1-baseline-trial2-20260929-083823/trial2.json'
trial=json.loads(trial_path.read_text())
retained=[]
for cid in ['NS-01','NS-04','NS-10']:
    r=next(r for r in trial['results'] if r['id']==cid)
    text=r['failure_observability']['rejected_output_at_failure']['message']
    retained.append({'id':cid,'message':text,'ascii_question_mark':'?' in text,'allowlisted_word_match':bool(re.search(r'\b(may|might|seems|possible|could|noticed)\b',text,re.I)),'recorded_result_unchanged':r['deterministic_pass']})
result={'scope':'isolated offline validator probes, not scenario replay or semantic grading','policy_sha256':hashlib.sha256(policy_path.read_bytes()).hexdigest(),'probe_count':len(results),'expectations_matched':True,'probes':results,'retained_trial2_outputs':retained}
(ROOT/'docs/audits/validator_lexical_probe_results.json').write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n')
print(f'{len(results)} isolated offline probes matched their expected lexical outcomes. No model calls or scenario reruns.')
