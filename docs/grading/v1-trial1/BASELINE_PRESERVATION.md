# V1 Trial 1 baseline preservation — 2026-10-01

The completed Trial 1 human semantic review is the preserved V1 Trial 1 baseline. The 22 submitted human reviews and exact notes remain unchanged. Applying the existing rubric yields 21 meeting its semantic threshold and NS-16 below it; eight cases remain ungradable from Trial 1 artifacts. Deterministic outcomes remain separate and unchanged. This designation does not assert an overall V1 quality pass.

## Findings — analysis only

- NS-16: semantic grounding/retrieval failure.
- NS-12 and NS-21: minor product-logic issues above the semantic failure threshold; neither falls below the existing minimum scores.
- Pattern validator: confirmed lexical false-positive/false-negative problem, documented in the offline validator audit; a V2 candidate only. No replacement or validator change is authorized here.
- NS-18/19/20/22: post-action persistence observability gap. Retained evidence does not establish the post-confirmation/cancellation database outcomes identified in the human notes.
- Provider 503/timeouts/429 and live frontend fetch failures remain a separate reliability concern. They are not merged into semantic model-quality findings; this entry does not assert a shared root cause.

## Next live experiment — planned, not started

After provider quota availability permits it, the next live experiment will be a fresh complete Trial 2, starting again from NS-01, not a continuation of the incomplete Trial 2. Preserve the incomplete Trial 2 under its existing run directory as historical evidence; a fresh run must have a distinct run directory and manifest. No quota check, external request, rerun, or live experiment was performed for this preservation step.

V1, rubric, validators, dataset, historical grades and evidence remain unchanged. No fixes were implemented and V2 has not begun. Baseline preservation hashes are recorded in baseline-preservation-manifest.json, separately from historical manifests. The completed reviews and derived summary retain their existing filenames.
