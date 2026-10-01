# V1 Gemini migration — 2026-09-28

## Decision and limits

The default is Google Gemini, fixed to `gemini-3.5-flash-lite`. Its documented text free tier, function calling and structured outputs fit the existing seven-tool contract. Combining functions with structured output is a Gemini 3 preview feature; successful live compatibility is **not yet verified**. No dated immutable snapshot is documented for this model. The explicit model ID, API version, source hashes and fixture date are recorded for reproducibility; provider-side changes can still affect reruns.

The adapter uses the stateless Interactions REST endpoint with `store:false`, 1,600 maximum output tokens, a 20-second timeout and no retries. Tool arguments and final output remain validated by the existing application. Native steps/signatures are round-tripped only in turn-local memory; traces contain the existing visible responses, tool events and normalized usage, not thought content. Gemini may return multiple calls in a response; the existing loop executes them sequentially under the unchanged six-tool and four-model-call limits. No extra completion tool, hosted search, paid fallback or schema relaxation was introduced.

The model choice is a practical starting point, not a quality benchmark result. One smoke scenario cannot establish all seven tools' live reliability or clinical safety.

## Account and key setup

1. Sign in to [Google AI Studio](https://aistudio.google.com/) using an eligible Google account and accept the applicable terms.
2. Create/select a project with **no Cloud Billing account linked**. Confirm AI Studio shows **Free**. Do not enable billing, upgrade, or rely on trial credits.
3. Create a Gemini API key for that project using AI Studio. Keep it only in `backend/.env` as `GEMINI_API_KEY`. Never paste it into chat, commit it, or put it in the frontend. The adapter sends it in a header, never a URL.
4. Merge `backend/.env.example` settings into your existing `.env`; do not overwrite existing secrets. Keep `AGENT_PROVIDER=gemini`, `GEMINI_MODEL=gemini-3.5-flash-lite` and `ALLOW_PAID_OPENAI=0`.
5. Inspect that project's active model limits in AI Studio: RPM, input TPM and remaining RPD. Report the tier and limits without the key before the live smoke. A key does not prove billing status. Account confirmations are user attestations, not API-verified billing enforcement.
6. Only after confirming the project is unbilled, set `GEMINI_FREE_TIER_CONFIRMED=1`. Only when all input and records are fictional, set `AGENT_SYNTHETIC_ONLY_CONFIRMED=1`. Leave these at zero until verified. Restart the backend after configuration changes.

Google's free tier may use submitted content to improve products. Use only fictional/synthetic messages and records. `store:false` is not a zero-retention guarantee. Do not relink billing while this configuration is enabled.

## Evaluation authorization

No live request has been made during this migration. Full live evaluation is deliberately blocked in the runner; the frozen dataset and rubric are unchanged. Offline validation/tests make no model calls.

After the user confirms adequate free quota and configures the key locally, the **only authorized live command**, from `backend/`, is:

```sh
python -m evals.runner --live --case NS-10 --trials 1 --output evals/runs/v1-gemini-smoke.json
```

NS-10 uses fictional fixtures and requires meal-history and recent-reflection tools. Inspect its trace for model usage → both tool calls → final response; rubric scores remain ungraded. Run it once, then stop and review even if it fails. Do not retry automatically or run another scenario. Errors do not include provider bodies or keys.

The smoke has at most four model requests. The original three-trial, 30-case suite has an upper bound of 384 requests across 32 conversation turns per trial; policy shortcuts and the fault-injection case reduce actual usage. Input-token volume depends on tool results and must also fit the account's active limits. Google publishes account/project-specific limits through AI Studio. Full-suite capacity is **unconfirmed** until those limits and an execution schedule are reviewed. If quota is insufficient, stop; never switch to paid service. A 429 stops the current smoke without retry.

OpenAI is preserved only as an optional historical adapter, gated by both `AGENT_PROVIDER=openai` and `ALLOW_PAID_OPENAI=1`. Neither is enabled by this migration, and the live runner refuses OpenAI. Enabling it requires separate explicit permission for paid usage.

## Preserved experiment

No V2 work. Prompt, tool definitions, orchestrator, consent/confirmation service, retrieval, safety policy, knowledge corpus, 30 cases, rubric and frozen V1 archive are unchanged. The evaluation report keeps its trace structure and adds provider/API metadata. The old archive remains the original OpenAI baseline; this migration is documented separately rather than replacing that evidence.

## Official sources checked

- [Model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite)
- [Free-tier pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Structured outputs with tools](https://ai.google.dev/gemini-api/docs/structured-output#structured-outputs-with-tools)
- [Function calling](https://ai.google.dev/gemini-api/docs/function-calling)
- [Interactions REST reference](https://ai.google.dev/api/interactions-api)
- [API key setup](https://ai.google.dev/gemini-api/docs/api-key)
- [Billing tiers](https://ai.google.dev/gemini-api/docs/billing)
- [Project-specific rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
