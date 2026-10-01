"""Only module that knows the provider SDK. Tests inject a scripted provider."""
import json
import os
import time
from agent.policy import FINAL_SCHEMA

class ProviderUnavailable(RuntimeError):
    def __init__(self, message, diagnostic=None):
        super().__init__(message)
        self.diagnostic = diagnostic


def safe_error_body(response):
    """Allowlisted error-body projection; never persist arbitrary provider text."""
    statuses = {'INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'OUT_OF_RANGE',
                'UNAUTHENTICATED', 'PERMISSION_DENIED', 'NOT_FOUND',
                'RESOURCE_EXHAUSTED', 'CANCELLED', 'UNKNOWN', 'INTERNAL',
                'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'UNIMPLEMENTED', 'ALREADY_EXISTS'}
    try:
        body = response.json()
    except ValueError:
        return {'body_format':'non_json', 'text_omitted':True}
    error = body.get('error') if isinstance(body, dict) else None
    if not isinstance(error, dict):
        return {'body_format':'json', 'unrecognized_body_omitted':True}
    result = {'body_format':'json', 'message_omitted':True, 'details_omitted':True}
    if type(error.get('code')) is int and 100 <= error['code'] <= 599:
        result['code'] = error['code']
    if isinstance(error.get('status'), str) and error['status'] in statuses:
        result['status'] = error['status']
    return result

class OpenAIProvider:
    def __init__(self):
        if provider_name() != "openai" or os.getenv("ALLOW_PAID_OPENAI") != "1":
            raise ProviderUnavailable("OpenAI requires explicit provider selection and paid-use authorization.")
        from openai import OpenAI
        if not os.getenv('OPENAI_API_KEY'):
            raise ProviderUnavailable('Set OPENAI_API_KEY on the backend to enable reflection.')
        self.client = OpenAI(timeout=20, max_retries=0)
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4.1-mini-2025-04-14')

    def respond(self, instructions, inputs, tools):
        response = self.client.responses.create(
            model=self.model, instructions=instructions, input=inputs, tools=tools,
            parallel_tool_calls=False, store=False, max_output_tokens=1600,
            text={'format':{'type':'json_schema','name':'reflection_reply','strict':True,'schema':FINAL_SCHEMA}},
        )
        calls = [{'name':i.name,'arguments':i.arguments,'call_id':i.call_id} for i in response.output if i.type == 'function_call']
        # Reasoning items may need round-tripping; never log or expose them.
        items = [i.model_dump(exclude_none=True) for i in response.output]
        return {'calls':calls,'items':items,'output':None if calls else json.loads(response.output_text),
                'usage':response.usage.model_dump() if response.usage else {}}


GEMINI_MODEL = 'gemini-3.5-flash-lite'


def provider_name():
    return os.getenv('AGENT_PROVIDER', 'gemini').lower()


def gemini_ready():
    return bool(os.getenv('GEMINI_API_KEY')) and all(
        os.getenv(name) == '1' for name in ('GEMINI_FREE_TIER_CONFIRMED', 'AGENT_SYNTHETIC_ONLY_CONFIRMED'))


class GeminiProvider:
    """Stateless Interactions adapter. Opaque steps stay in turn-local memory."""
    def __init__(self):
        if not gemini_ready():
            raise ProviderUnavailable('Configure GEMINI_API_KEY and confirm an unbilled Free-tier project and synthetic-only data locally.')
        self.model = os.getenv('GEMINI_MODEL', GEMINI_MODEL)
        if self.model != GEMINI_MODEL:
            raise ProviderUnavailable('Only the reviewed free-tier Gemini model is enabled.')
        self.requests = 0

    def respond(self, instructions, inputs, tools):
        import httpx
        steps = []
        names = {}
        for item in inputs:
            if '_gemini_step' in item:
                step = item['_gemini_step']
                steps.append(step)
                if step.get('type') == 'function_call':
                    names[step['id']] = step['name']
            elif item.get('type') == 'function_call_output':
                steps.append({'type':'function_result', 'name':names[item['call_id']],
                              'call_id':item['call_id'], 'result':[{'type':'text','text':item['output']}]})
            else:
                steps.append({'type':'user_input' if item['role']=='user' else 'model_output',
                              'content':[{'type':'text','text':item['content']}]})
        body = {'model':self.model, 'store':False, 'input':steps,
                'system_instruction':instructions,
                'tools':[{k:t[k] for k in ('type','name','description','parameters')} for t in tools],
                'generation_config':{'max_output_tokens':1600, 'thinking_summaries':'none', 'tool_choice':'auto'},
                'response_format':{'type':'text','mime_type':'application/json','schema':FINAL_SCHEMA}}
        self.requests += 1
        started = time.monotonic()
        diagnostic = {'provider':'gemini', 'request_number':self.requests,
                      'phase':'continuation' if names else 'initial',
                      'timeout_seconds':20, 'http_status':None,
                      'function_call_count':len(names),
                      'function_result_count':sum(s.get('type')=='function_result' for s in steps)}
        # No retries, redirects, alternate endpoints, built-in tools or paid fallback.
        try:
            with httpx.Client(timeout=20, follow_redirects=False, trust_env=False) as client:
                response = client.post('https://generativelanguage.googleapis.com/v1beta/interactions',
                                       headers={'x-goog-api-key':os.environ['GEMINI_API_KEY']}, json=body)
            diagnostic.update(http_status=response.status_code, elapsed_seconds=round(time.monotonic()-started,3))
            if response.status_code != 200:
                diagnostic.update(category='http_error', error_body=safe_error_body(response))
                raise ProviderUnavailable('Gemini request refused (HTTP %s); stopped without retry or fallback.' % response.status_code, diagnostic)
            data = response.json()
        except httpx.HTTPError as exc:
            # Exception strings can contain URLs, credentials or server echoes.
            # Retain only a known httpx class name, never str(exc), request or headers.
            known = ('ConnectTimeout','ReadTimeout','WriteTimeout','PoolTimeout',
                     'ConnectError','ReadError','WriteError','CloseError',
                     'LocalProtocolError','RemoteProtocolError','ProxyError',
                     'UnsupportedProtocol','DecodingError','TooManyRedirects')
            kind = type(exc).__name__
            diagnostic.update(category='transport_error',
                              exception_type=kind if kind in known else 'HTTPError',
                              elapsed_seconds=round(time.monotonic()-started,3))
            raise ProviderUnavailable('Gemini transport failed; stopped without retry or fallback.', diagnostic) from None
        returned = data.get('steps', [])
        calls = [{'name':s['name'], 'arguments':json.dumps(s['arguments']), 'call_id':s['id']}
                 for s in returned if s.get('type')=='function_call']
        text = ''.join(c['text'] for s in returned if s.get('type')=='model_output'
                       for c in s.get('content',[]) if c.get('type')=='text')
        usage = data.get('usage',{})
        return {'calls':calls, 'items':[{'_gemini_step':s} for s in returned],
                'output':None if calls else json.loads(text),
                'usage':{'input_tokens':usage.get('total_input_tokens',0),
                         'output_tokens':usage.get('total_output_tokens',0),
                         'total_tokens':usage.get('total_tokens',0)}}


def get_provider():
    if provider_name() == 'gemini':
        return GeminiProvider()
    if provider_name() == 'openai' and os.getenv('ALLOW_PAID_OPENAI') == '1':
        return OpenAIProvider()
    raise ProviderUnavailable('Provider disabled. No automatic provider fallback is allowed.')
