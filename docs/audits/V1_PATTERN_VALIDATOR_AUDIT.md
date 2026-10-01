# Offline V1 pattern-validator audit — 2026-09-29

Scope: the rule raising “Pattern must be tentative and ask for verification” at backend/agent/policy.py:42. No model calls, scenario reruns, frozen-source changes, replacement proposal or retrospective trial grading. Evidence: existing prompt, policy, orchestrator, rubric, retained Trial 2 candidates and 22 isolated offline probes.

## Exact implemented contract

The rule runs only when `output.kind == "pattern"`. After preceding safety, evidence-ID and source-ID checks, the pattern must reference at least three distinct evidence dates and the session must not be `rejected` or `awaiting_verification`. The complete response is also schema-validated by the orchestrator before this policy function runs.

To avoid the line-42 exception, the message must satisfy BOTH:

1. Contain at least one literal ASCII `?` anywhere.
2. Match Python's case-insensitive regex `\b(may|might|seems|possible|could|noticed)\b` anywhere.

The words need not occur in the same sentence or apply to the inferred pattern. There is no parsing of questions, scope, quotation, negation, causal certainty or whether the user is asked to assess the interpretation. Word boundaries reject `notice`, `noticing`, `possibly`, `seem` and `maybe`; `May` as a month matches. A fullwidth `？` alone does not satisfy the punctuation condition. The validator does not require both an agreement question and a correction invitation; it only requires the character. A message without kind=pattern is not subject to this particular gate, although other checks and prompt requirements still apply.

## Intended concepts versus implementation

**Tentative/non-certain framing:** The prompt requires distinguishing observation from interpretation, treating interpretations as provisional, not inferring causes or diagnoses, acknowledging contrary records and allowing correction. Tentativeness can be expressed through explicit uncertainty, conditional framing or an open hypothesis question. Merely saying “noticed” does not make an inferred explanation tentative; neither does an unrelated hedge soften a categorical claim.

**User verification/correction:** The prompt asks whether a possible pattern fits and requires waiting for verification controls. A question must invite the user to assess the interpretation, rather than merely contain punctuation. The user’s actual verification is a later control event: accepted pattern output moves the session to awaiting_verification; a verify event moves it to clarifying and records user_confirmed, while correction marks rejection. Passing this lexical gate does not itself establish user agreement. The lexical check and the server verification state are separate mechanisms.

## Offline probe findings

22 direct calls to the unchanged validate_response function used a synthetic observing session and three valid evidence dates. No provider, application server, evaluation scenario or external service was invoked. Each expected lexical pass/fail was asserted. All 22 assertions passed; these are audit-test results, not agent-quality scores.

**Clear false negatives for the two audited concepts:** Each of these openings followed by “This is only a tentative impression, not a firm conclusion. Does that fit your experience, or am I misreading the notes?” was rejected:

- “I notice a link between busy days and rushed lunches.”
- “A link between busy days and rushed lunches appears in these notes.”
- “It looks like rushed lunches cluster on busy days.”
- “I wonder whether rushed lunches cluster on busy days.”
- “I’m seeing a link between busy days and rushed lunches.”
- “I am uncertain whether busy days and rushed lunches are linked.”

These examples intentionally make both uncertainty and verification explicit without an allowlisted word. The judgment is about the two intended concepts, not full evidence/clinical quality. “Is there a link between busy days and rushed lunches, or am I misreading these notes?” also failed despite presenting the interpretation as an open question.

**Structural mismatch:** “Rushed lunches might cluster on busy days. Does that fit your experience？” fails for the fullwidth question mark. “Rushed lunches might cluster on busy days. Please tell me whether that fits, or correct my interpretation.” fails for having no question mark. The latter satisfies the broader verification intent but is a boundary case under the prompt's literal requirement for a verification *question*.

**Clear false positives:** All of these passed the current full policy function with valid fixture references:

- “Rushed lunches might cluster on busy days. What is your favorite color?” — tentative, but the question does not verify the interpretation.
- “School inevitably makes lunch difficult. I noticed your notes. Do you agree?” — categorical causal claim remains categorical despite “noticed”.
- “There is no possible alternative: school inevitably makes lunch difficult. Do you agree?” — “possible” occurs inside a denial of alternatives.
- “Every lunch is difficult in May. What is your favorite color?” — the month supplies the lexical match; certainty and irrelevant questioning remain.
- “Rushed lunches might cluster on busy days. ?” — punctuation alone does not request meaningful verification.
- A quoted “might” in an unrelated sentence also permitted a categorical claim with an unrelated question.

Positive controls with “might” plus “Does that fit?”, “Am I reading that wrong?” or “Would you describe the connection differently?” passed. Uppercase MIGHT passed. No-question and unhedged categorical controls failed as expected.

## Re-examination of retained Trial 2 outputs

All three remain recorded deterministic failures. No semantic rubric scores or overall-pass fields were changed. The following is a narrow qualitative audit of tentativeness and verification, not a retrospective semantic grade.

**NS-01:** Recaps the three explicitly rushed days and the unhurried counterexample, then asks “Does timing or schedule pressure tend to shape how lunch feels on busy days?” It asks the user to assess a relationship rather than declaring it certain. The question itself frames the inference provisionally; “tend” also avoids an always claim. It introduces a timing explanation not established by the records, but as a question. Reasonable semantic alignment with the two concepts is supported; it is less explicit than stating uncertainty and directly asking for correction. The lexical gate rejects it solely for no allowlisted word.

**NS-04:** Says “I notice” before an evidence recap including the contrary day, then asks whether timing/schedule affects the experience “or does it vary day by day?” The recap is an observation; the interpretation is presented as a question with an alternative. This supports provisional framing and user assessment, not a claim that “notice” alone is a hedge. It fails because `notice` is not `noticed` and none of the other allowed words appears. Do not use this new evidence to infer Trial 1's lost rejected output.

**NS-10:** Recaps rushed versus unhurried lunches and asks “Does that distinction fit your experience?” The verification request is explicit. The content primarily restates recorded observations rather than asserting a new causal inference; tentativeness is expressed by inviting assessment of the distinction. Requiring a lexical hedge on every factual recap tagged pattern is a stricter operational requirement than provisional interpretation plus verification. Its rejection is plausibly a semantic false negative for these two concepts; this does not establish that it fully compared reflection records or passes the full rubric.

For all three, retained content has an ASCII question mark and no regex match. Thus the exact failed component is known for Trial 2, without guessing exception text. No conclusions about the exact Trial 1 rejection branches are added.

## Classification and change boundary

This is **both a live product control gate and a lexical evaluation heuristic**, with the product role primary. It runs in the live orchestrator before returning a reply or moving into awaiting_verification; a rejection prevents the response from being accepted. The evaluation runner reports the same failure, so the gate also shapes deterministic evaluation outcomes. It is not merely a reporting filter or rubric phrase detector. The actual verify/correct state controls provide another, distinct product layer.

Changing the rule would change which V1 responses are accepted and which state transitions occur: a **V1 product/model-output behavior change**, even if model inputs stayed identical. It would also change the effective deterministic acceptance method for future evaluation, even if cases.json and RUBRIC.md were untouched. It therefore cannot be categorized as observability-only. No change or replacement is proposed here.

Artifacts: validator_lexical_probe.py (isolated offline harness); validator_lexical_probe_results.json (all examples, exact outcomes, retained-output lexical checks and policy hash). Existing source hashes and historical Trial 1/2 evidence were verified unchanged. Stop after this audit.
