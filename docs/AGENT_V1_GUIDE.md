# NourishSteps Reflection Agent V1

This is a local, synthetic-data demonstration of Pattern → Reflection → Action. It uses the existing React/Flask/SQLAlchemy stack. The agent has a separate SQLite database; it cannot read the existing meal diary. No real-user deployment is implied.

## Start locally

From the project root:

```sh
cd backend
source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env` only if it does not already exist; otherwise merge the new settings without overwriting secrets. See [Gemini setup and migration](GEMINI_V1_MIGRATION.md) for the required unbilled account, local confirmations, limits and smoke-only procedure. Gemini is the default; OpenAI is inactive. Never paste a key into chat or commit it.

```sh
python -m agent.demo
python -m flask --app app run --host 127.0.0.1 --port 5001
```

The demo initializer creates fictional meal/check-in examples only when the separate dataset is empty. It preserves existing demo data. Never run `seed.py` to initialize the agent: that legacy script resets existing journal data.

In another terminal:

```sh
cd frontend
npm install
npm run dev
```

Open the local frontend and select **Reflect**. Restart the backend after changing `.env`. The backend rejects public hosts, non-loopback peers and nonlocal origins for agent routes. Do not expose this demo through a tunnel or proxy. The existing journal API has no multi-user authentication.

## Try the complete flow

1. Enable fictional history and notes, then start a reflection.
2. Ask: “Could you look at recent lunches and reflections for a possible pattern?”
3. Inspect the records behind the observation. Select **That fits** or **That doesn’t fit**; optionally type a correction first.
4. Ask for a general support option. A source card should come from eligible retrieved content; an unrelated topic should produce no matching content.
5. Ask: “Please make an intention to ask a friend for company.” Edit the draft, then choose **Save this version**. Before that click there is no saved intention.
6. End/delete the conversation. Start another and choose **View my demo intentions**, then **Reflect on this**. Follow-up is entirely user initiated.
7. Try: “Draft a reflection for today: lunch between classes felt rushed.” Confirm or edit the proposed fields; uncertain fields remain optional.
8. Select **Leave it here** to stop and cancel pending drafts. **Delete my demo reflection data** deletes this browser’s conversations, reflections and intentions without deleting the fixed sample history or the original diary.

This flow uses a real model when a valid key is configured. No canned-response provider is used by the product. Scripted providers exist only in tests.

## Implementation contracts

The model receives strict tool schemas and chooses tool calls. Flask validates name, arguments, consent and state, executes allowed functions, and returns results using the tool call ID. The model continues with those results. Four model calls and six tool calls maximum per turn; API calls have 20-second timeouts with automatic SDK retries disabled. Completed structured output is validated before display.

History uses raw statuses and explicit notes. Missing entries are unknown, row timestamps are not meal times, and numeric mood is not interpreted as a psychological label. A pattern response requires referenced records on at least three distinct dates and a tentative verification question. This is a conservative product heuristic, not statistical validation. Semantic correctness still needs rubric review.

The three write tools request drafts. The application defers the actual operation until a separate confirmation endpoint receives the exact reviewed payload. This is intentionally different from asking the model to decide whether a user approved a write. Payload hashes, owner/session checks, expiry and a SQLite write transaction make confirmation bounded and repeatable without duplicate saves. Editing changes the approved payload; replaying a different payload fails.

The backend invokes the same write service after confirmation without needing another model call. This preserves user control and avoids charging for an unnecessary model confirmation. Model-generated text never supplies a save receipt; the database operation does.

## Data and retention

- `nourish.db`: existing journal, unchanged by agent tools or evaluation.
- `agent-demo.db`: fictional examples plus demo conversations/intentions/reflections.
- A random browser capability is stored in localStorage; its hash scopes demo goals and sessions. This is local-demo separation, NOT account authentication.
- Sessions last 24 hours. Expired session data is removed on the next agent request. Pending drafts expire after 15 minutes. This is lazy cleanup, not a background deletion guarantee.
- Confirmed reflections and intentions persist until the user deletes demo data. Provider retention is governed by the account/API configuration; `store=False` does not establish zero provider retention.
- Operational errors do not print journal text, model prompts or provider exception bodies. Evaluation traces contain synthetic fixtures only.
- Toolbox notes in localStorage are not uploaded.

Run `python -m agent.migrate upgrade` for explicit schema migration. The CLI first makes a SQLite backup if a database exists. Additive changes preserve legacy goals without inventing ownership. Downgrade is available for empty agent data and refuses to erase confirmed records. Test storage is isolated before application import.

## Content provenance

Eight small general-support entries in `backend/knowledge/support.json` reference NHS, NEDA and 988. They were checked against those pages during implementation. Status is `source_checked_demo`; `clinical_reviewed` is false. This is not clinical approval. The retrieval function excludes draft or expired entries, ranks exact tag/keyword overlap and returns at most three sources. The interface can later use an index without changing tools.

Detailed support is shown as fixed source-card wording. Generated introductions cannot add steps to a support response. Source IDs must have been retrieved in that turn. The safety screen and output rules are deliberately bounded and imperfect; they can overblock benign mentions and miss paraphrases. The model prompt provides an additional layer, not a guarantee. No clinical effectiveness or safety claim has been established.

References checked:

- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [GPT-4.1 mini baseline capabilities](https://developers.openai.com/api/docs/models/gpt-4.1-mini)
- [NHS mindfulness](https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/what-is-mindfulness/)
- [NHS stress support](https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/feelings-and-symptoms/stress/)
- [NEDA support resources](https://www.nationaleatingdisorders.org/get-help/)
- [988 contact and emergency guidance](https://988lifeline.org/contact-us/)

## Evaluation and iteration

From `backend/`:

```sh
python -m pytest -q
python -m evals.runner --validate
python -m evals.runner --live --case NS-10 --trials 1
```

The live command is permitted only after Free-tier status and sufficient quota are verified. It runs one synthetic smoke scenario. Full-suite execution is currently blocked. The frozen suite contains 30 scenarios and retains its original three-trial default. NS-30 is an injected provider failure, and application safety short-circuits may bypass the model in other cases; traces explicitly expose those paths. Do not describe all 90 trials as model generations.

Review a copy of the report using `backend/evals/RUBRIC.md`. Fill in the five dimension scores, critical-failure flag, reviewer details and failure layer. Raw output is not automatically an overall pass. The runner records tool traces and visible messages, never hidden reasoning. Trace/runs directories are gitignored to prevent accidental data publication.

Preserve the V1 snapshot and raw report. Categorize failures as prompting, tool/data, retrieval, product logic, safeguards or infrastructure. Do not start V2 or rerun the full suite without a separate request. Compare reviewed reports:

```sh
python -m evals.compare evals/runs/v1-reviewed.json evals/runs/v2-reviewed.json
```

The comparator rejects ungraded, incomplete or different-suite runs. It reports trial and robust-case counts plus regressions, rather than manufacturing an improvement claim. A robust case passes every trial. These are development-set results; use held-out scenarios before asserting generalization.

## Deliberately not in V1

Real-user authentication, shared/public hosting, clinical content approval, vector search, notifications, automatic log analysis, voice and food photos. Before a real-user pilot, add ownership to every journal endpoint, decide retention and user eligibility, obtain qualified content review, and expand adversarial/semantic evaluation. Finite tests cannot establish clinical safety.

## Preserved baseline

`docs/baselines/v1/source.zip` and its SHA-256 manifest preserve the working source, including V1 changes that have not been committed. They exclude local secrets, databases, dependencies and runtime traces. Extract into a separate directory for later comparisons. Do not edit the V1 archive. The provider migration does not replace that archive or begin V2.
