"""Application gates supplement (and do not replace) evaluated model behavior."""
import re
from datetime import date

VERSION = 'policy-1'
URGENT = re.compile(r"kill myself|end my life|suicid|can't stay safe|cannot stay safe|overdos|vomiting blood|chest pain|fainted|passed out|immediate danger", re.I)
UNSAFE = re.compile(r"calori|weight.?loss|lose weight|lose \d+|calorie deficit|purge|purging|laxative|compensat|hide.{0,20}(restrict|not eating)|suppress.{0,10}appetite|starv|fasting plan", re.I)
DIAGNOSIS = re.compile(r"diagnos|am i recovered|have i recovered|do i have (anorexia|bulimia|an eating disorder)", re.I)
STOP = re.compile(r"^(no thanks|stop|leave it (here|there)|not now|i don.t want to (reflect|talk)|i.d rather not)[.! ]*$", re.I)
BAD_OUTPUT = re.compile(r"\b\d+\s*(calories|kcal)\b|calorie (target|deficit)|you (have|suffer from) (anorexia|bulimia)|you are recovered|good job.{0,30}(skip|restrict)|you should (skip|restrict|fast)|burn off|bad foods|good foods|caused by|proves that|definitely means", re.I)

REFUSAL = "I can help with reflection, but I can’t provide calorie targets, weight-loss plans, or instructions for restriction or compensating. A qualified clinician can help with individual nutrition concerns. We can leave it here."
DIAGNOSIS_REPLY = "I can’t diagnose an eating disorder or determine recovery status from your entries. A qualified clinician can assess that with you. You can choose whether to explore support options or leave it here."
URGENT_REPLY = "This may need immediate human support. If you are in immediate danger or have urgent physical symptoms, contact your local emergency service now. In the US, call 911 for an emergency; call or text 988 for suicide or emotional crisis support. If possible, ask someone you trust to stay with you. This app cannot provide emergency care."
FALLBACK = "I couldn’t produce a reliable response this time. Nothing was saved to your reflections or intentions. You can try again or leave it here."

def screen_input(message):
    if URGENT.search(message):
        return 'urgent', URGENT_REPLY
    if UNSAFE.search(message):
        return 'boundary', REFUSAL
    if DIAGNOSIS.search(message):
        return 'boundary', DIAGNOSIS_REPLY
    if STOP.match(message.strip()):
        return 'paused', 'We can leave it here. No new reflection or intention was saved.'
    return None

def validate_response(output, session, retrieved):
    text = output['message']
    if BAD_OUTPUT.search(text) or 'http' in text or re.search(r'\b(saved|created your goal|updated your goal)\b', text, re.I):
        raise ValueError('Unsupported or unsafe output')
    evidence = session.evidence or {}
    if any(ref not in evidence for ref in output['evidence_ids']):
        raise ValueError('Unknown evidence')
    if any(ref not in retrieved for ref in output['source_ids']):
        raise ValueError('Source was not retrieved this turn')
    if output['kind'] == 'pattern':
        dates = {evidence[ref]['date'] for ref in output['evidence_ids']}
        if len(dates) < 3 or session.state in ['rejected', 'awaiting_verification']:
            raise ValueError('Insufficient evidence or unverified/rejected hypothesis')
        if '?' not in text or not re.search(r'\b(may|might|seems|possible|could|noticed)\b', text, re.I):
            raise ValueError('Pattern must be tentative and ask for verification')
    if output['kind'] == 'support' and not output['source_ids']:
        raise ValueError('Support requires a retrieved source')
    if output['kind'] == 'support':
        # Detailed advice comes from source cards, never generated steps.
        output['message'] = 'Here are some source-based options. Would any feel useful, or would you prefer to leave it here?'
    return output

FINAL_SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'properties': {
        'kind': {'type':'string', 'enum':['conversation','pattern','support','draft','boundary']},
        'message': {'type':'string', 'minLength':1, 'maxLength':900},
        'evidence_ids': {'type':'array', 'items':{'type':'string'}, 'maxItems':12},
        'source_ids': {'type':'array', 'items':{'type':'string'}, 'maxItems':3},
    }, 'required':['kind','message','evidence_ids','source_ids'],
}
