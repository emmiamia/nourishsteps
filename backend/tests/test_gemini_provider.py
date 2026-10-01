import json
import pytest
import httpx
from agent.provider import GeminiProvider, OpenAIProvider, get_provider, ProviderUnavailable, GEMINI_MODEL
from agent.tools import DEFS
from agent.policy import FINAL_SCHEMA

@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setenv('AGENT_PROVIDER','gemini')
    monkeypatch.setenv('GEMINI_API_KEY','synthetic-test-key')
    monkeypatch.setenv('GEMINI_FREE_TIER_CONFIRMED','1')
    monkeypatch.setenv('AGENT_SYNTHETIC_ONLY_CONFIRMED','1')
    monkeypatch.setenv('GEMINI_MODEL',GEMINI_MODEL)

def test_roundtrip_seven_tools_and_structured_response(enabled,monkeypatch):
    requests=[]
    opaque={'type':'thought','signature':'opaque-test-signature'}
    calls=[{'type':'function_call','id':'c1','name':'get_meal_history','arguments':{'days':7}},
           {'type':'function_call','id':'c2','name':'get_recent_reflections','arguments':{'days':7}}]
    final={'kind':'conversation','message':'What would you like to reflect on?','evidence_ids':[],'source_ids':[]}
    def post(self,url,**kwargs):
        requests.append(kwargs['json'])
        steps=[opaque]+calls if len(requests)==1 else [{'type':'model_output','content':[{'type':'text','text':json.dumps(final)}]}]
        return httpx.Response(200,json={'steps':steps,'usage':{'total_input_tokens':10,'total_output_tokens':4,'total_tokens':14}})
    monkeypatch.setattr(httpx.Client,'post',post)
    provider=get_provider()
    tools=[{'type':'function','name':n,'description':d,'parameters':s,'strict':True} for n,d,s in DEFS]
    inputs=[{'role':'assistant','content':'Hello'},{'role':'user','content':'Look at fictional lunches'}]
    result=provider.respond('unchanged rules',inputs,tools)
    inputs+=result['items']+[{'type':'function_call_output','call_id':c['call_id'],'output':'[]'} for c in result['calls']]
    reply=provider.respond('unchanged rules',inputs,tools)
    assert reply['output']==final
    assert reply['usage']=={'input_tokens':10,'output_tokens':4,'total_tokens':14}
    assert len(requests[0]['tools'])==7
    assert [t['parameters'] for t in requests[0]['tools']]==[s for _,_,s in DEFS]
    assert requests[0]['response_format']['schema']==FINAL_SCHEMA
    assert requests[0]['store'] is False
    assert opaque in requests[1]['input']
    assert requests[1]['input'][-1]['name']=='get_recent_reflections'
    assert requests[1]['input'][-1]['call_id']=='c2'
    assert 'signature' not in json.dumps(reply['usage'])

@pytest.mark.parametrize('flag',['GEMINI_FREE_TIER_CONFIRMED','AGENT_SYNTHETIC_ONLY_CONFIRMED','GEMINI_API_KEY'])
def test_missing_attestation_or_key_blocks(enabled,monkeypatch,flag):
    monkeypatch.delenv(flag)
    with pytest.raises(ProviderUnavailable): get_provider()

def test_no_paid_fallback_or_model_override(enabled,monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY','synthetic-key')
    with pytest.raises(ProviderUnavailable): OpenAIProvider()
    monkeypatch.setenv('GEMINI_MODEL','gemini-pro-latest')
    with pytest.raises(ProviderUnavailable): get_provider()

@pytest.mark.parametrize('status',[429,403,500])
def test_errors_never_retry_or_expose_body(enabled,monkeypatch,status):
    calls=[]
    def post(*args,**kwargs):
        calls.append(1)
        return httpx.Response(status,json={'error':'sensitive provider body'})
    monkeypatch.setattr(httpx.Client,'post',post)
    with pytest.raises(ProviderUnavailable) as exc: get_provider().respond('rules',[],[])
    assert len(calls)==1 and 'sensitive' not in str(exc.value)

def test_existing_eval_loop_with_mock_gemini_transport(enabled,monkeypatch):
    from evals.runner import CASES, run_case
    calls=[]
    def post(self,url,**kwargs):
        calls.append(kwargs['json'])
        steps=([{'type':'function_call','id':name,'name':name,'arguments':{'days':7}}
                for name in ['get_meal_history','get_recent_reflections']] if len(calls)==1 else
               [{'type':'model_output','content':[{'type':'text','text':json.dumps({
                   'kind':'conversation','message':'What would you like to reflect on?',
                   'evidence_ids':[],'source_ids':[]})}]}])
        return httpx.Response(200,json={'steps':steps})
    monkeypatch.setattr(httpx.Client,'post',post)
    case=next(c for c in json.loads(CASES.read_text()) if c['id']=='NS-10')
    result=run_case(case,get_provider())
    assert result['deterministic_pass'], result['failures']
    assert result['outputs'] and len(calls)==2
    assert [e['name'] for e in result['trace'] if e['event']=='tool']==['get_meal_history','get_recent_reflections']
    assert any(e['event']=='model' for e in result['trace'])
    assert '_gemini_step' not in json.dumps(result)

@pytest.mark.parametrize('error_type',[httpx.ReadTimeout,httpx.ConnectTimeout,httpx.RemoteProtocolError])
def test_transport_diagnostics_are_safe(enabled,monkeypatch,error_type):
    def post(*args,**kwargs):
        raise error_type('secret-in-url?key=synthetic-test-key')
    monkeypatch.setattr(httpx.Client,'post',post)
    with pytest.raises(ProviderUnavailable) as caught:
        get_provider().respond('rules',[],[])
    diagnostic=caught.value.diagnostic
    assert diagnostic['exception_type']==error_type.__name__
    assert diagnostic['http_status'] is None
    assert diagnostic['request_number']==1
    assert 'secret' not in json.dumps(diagnostic)
    assert 'synthetic-test-key' not in json.dumps(diagnostic)


def test_http_body_is_allowlisted_and_eval_preserves_diagnostics(enabled,monkeypatch):
    from evals.runner import CASES, run_case
    def post(*args,**kwargs):
        return httpx.Response(429,json={'error':{'code':429,'status':'RESOURCE_EXHAUSTED',
            'message':'key=synthetic-test-key other-secret','details':[{'secret':'other-secret'}]}})
    monkeypatch.setattr(httpx.Client,'post',post)
    case=next(c for c in json.loads(CASES.read_text()) if c['id']=='NS-10')
    result=run_case(case,get_provider())
    assert result['failure_layer']=='infrastructure'
    assert result['provider_diagnostic']['error_body']['status']=='RESOURCE_EXHAUSTED'
    assert result['provider_diagnostic']['http_status']==429
    assert 'synthetic-test-key' not in json.dumps(result)
    assert 'other-secret' not in json.dumps(result)
