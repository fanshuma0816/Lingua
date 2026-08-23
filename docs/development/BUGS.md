# LanguageLearning Bugs And Work Queue

Last updated: 2026-08-15

Status key:

- `Fixed`: implementation has reportedly been changed.
- `Verified pending manual QA`: automated or code-level checks may exist, but human product QA is still needed.
- `Open`: known issue not yet fixed.
- `Planned`: accepted for a future batch.
- `Needs diagnosis`: suspected issue requiring root-cause tracing before implementation.

## Batch 1: Material Generation, CEFR, Vocabulary, Diagnosis

### BUG-001: Same material shows different CEFR levels across screens

Status: Fixed / verified pending manual QA

Severity: High

Observed behavior:

- The same material could appear as A1 on the card, B1 in preview, and A1 again in diagnosis.

Root cause:

- The app had no single source of truth for material CEFR.
- Card badge used generation `targetLevel`.
- Preview independently ran a heuristic recommendation.
- Diagnosis displayed the learner's level as if it were the material's level.

Expected behavior:

- Card, preview, diagnosis, and lesson screens all display the same analyzed `materialLevel`.
- `learnerLevel`, `targetLevel`, and `materialLevel` remain distinct.

Current Batch 1 resolution:

- A shared deterministic CEFR module was introduced.
- Material analysis is intended to be reused across generation, lesson build, cards, preview, and diagnosis.

Manual QA needed:

- Generate A1, A2, and B1 materials and verify level consistency across all screens.
- Confirm diagnosis labels the material level, not the user's level.

### BUG-002: Diagnosis displays learner level instead of material level

Status: Fixed / verified pending manual QA

Severity: High

Observed behavior:

- Diagnosis could show A1 because the user was A1, even when the material itself was closer to B1.

Root cause:

- Diagnosis used the user's selected or stored learner level for the displayed material difficulty.

Expected behavior:

- Diagnosis should show both learner level and analyzed material level.
- The fit label should explain the relationship between them.

Manual QA needed:

- Use an A1 learner profile with a B1 material and confirm diagnosis says the material is B1 and frames it as stretch.

### BUG-003: Vocabulary extraction surfaces long/common words instead of hard useful words

Status: Fixed / verified pending manual QA

Severity: Medium-high

Observed behavior:

- Vocabulary lists could include long or frequent words while missing genuinely difficult words.
- Harder words later in the text could be omitted.

Root cause:

- Previous extraction prioritized word length and frequency.
- Diagnosis candidates were capped too early in document order.
- Filtering could drop words at or above the learner's level.

Expected behavior:

- Vocabulary extraction should be CEFR-aware.
- Later hard words should remain eligible.
- Proper nouns and noise should be filtered or deprioritized.

Current Batch 1 resolution:

- Vocabulary selection was reportedly moved toward CEFR-aware ranking using shared analysis.

Manual QA needed:

- Test with a mixed A2/B1 Dutch text and inspect whether selected words are pedagogically useful.

### BUG-004: Generated material is labeled as requested level without validation

Status: Fixed / verified pending manual QA

Severity: High

Observed behavior:

- The user could request A1 material.
- The model could generate text closer to B1.
- The app still labeled it A1 because `level = targetLevel`.

Root cause:

- No post-generation difficulty validation.
- The system trusted the requested level rather than analyzing the actual generated text.

Expected behavior:

- Generated text must be analyzed after generation.
- The stored material level must reflect the actual text.
- Out-of-range text should be regenerated, rejected, or marked as stretch.

Current Batch 1 resolution:

- Post-generation validation was reportedly added through the shared CEFR module.

Manual QA needed:

- Repeatedly generate A1 material and confirm texts are actually short, simple, and A1-like.
- Confirm any harder generated text is not falsely labeled A1.

### BUG-005: Regeneration can return repeated materials

Status: Fixed / verified pending manual QA

Severity: Medium

Observed behavior:

- Regenerating could return the same or nearly identical sample materials.

Root cause:

- AI fallback returned static samples.
- Prompt could be byte-identical across regenerations.
- Route did not clearly opt out of caching.

Expected behavior:

- Regeneration should produce meaningfully different material.
- Fallback samples should vary.
- Generation routes should avoid stale cached responses.

Current Batch 1 resolution:

- Nonce, avoid-list behavior, `no-store`, dynamic route handling, and fallback shuffling were reportedly added.

Manual QA needed:

- Click regenerate several times under normal AI availability.
- Simulate AI fallback and confirm sample order/content varies.

## Batch 2: Audio Reliability, TTS Quality, Sentence Chunking

### BUG-006: Premium Google Dutch TTS may not actually be used

Status: Open / planned for Batch 2

Severity: High

Observed behavior:

- Audio sounds like a standard or lower-quality voice despite premium Google TTS configuration.

Needs diagnosis:

- Confirm actual provider used in production.
- Confirm exact Dutch voice name sent to Google.
- Confirm language code, audio config, encoding, and fallback path.
- Confirm whether client playback ever uses browser/system speech synthesis instead of generated audio.

Expected behavior:

- Production should use the configured high-quality Google Dutch TTS voice.
- If fallback is used, it should be logged and visible enough to debug.
- The app should not silently claim premium TTS while playing a fallback voice.

Implementation guardrails:

- Do not modify CEFR, material generation, vocabulary, diagnosis, practice, or unrelated UI in this batch.

### BUG-007: Playback progress advances while audio is still loading

Status: Open / planned for Batch 2

Severity: Medium-high

Observed behavior:

- The playback progress bar can move before audio is actually ready or audible.

Needs diagnosis:

- Trace browser audio events.
- Check whether progress is timer-based rather than media-time-based.
- Check loading, buffering, ready, playing, paused, ended, and error states.

Expected behavior:

- Progress should advance only when audio is actually playing.
- Loading and buffering should show a loading state.
- Pausing or waiting for audio should freeze progress.

Implementation guardrails:

- The fix should be local to audio state management and playback UI.

### BUG-008: Sentence and audio chunks are too long or awkward

Status: Open / planned for Batch 2

Severity: Medium

Observed behavior:

- Some displayed or spoken chunks are too long.
- Some chunk splits may feel semantically awkward.

Needs diagnosis:

- Inspect the current sentence splitting and chunking implementation.
- Check how chunks are passed to TTS.
- Check whether visual chunks and spoken chunks use the same boundaries.

Expected behavior:

- Chunks should be learner-friendly, readable, and suitable for TTS.
- Long sentences should be split at natural phrase boundaries.
- Abbreviations and punctuation should not cause broken sentence splits.

Implementation guardrails:

- Improve chunking without changing CEFR, vocabulary ranking, or unrelated lesson flow.

## Lesson Navigation

### BUG-009: Lesson navigation may not provide a clear guided path

Status: Needs diagnosis

Severity: Medium

Known concern:

- The product should feel like a structured lesson, not disconnected panels.
- The learner should know what to do next and be able to move between lesson sections without losing state.

Expected behavior:

- Clear navigation between preview, diagnosis, vocabulary, grammar, guided practice, AI practice, and review.
- Previous and next actions preserve state.
- Returning to earlier sections does not reset lesson progress.

Manual QA needed:

- Complete one full 10-30 minute lesson flow on desktop and mobile.
- Verify no section is a dead end.

## Practice With AI

### BUG-010: Practice with AI may be too generic or detached from the lesson

Status: Needs diagnosis

Severity: Medium-high

Known concern:

- AI practice should be grounded in the current material, vocabulary, grammar focus, learner level, and lesson state.

Expected behavior:

- The AI practice partner should stay inside lesson context.
- Corrections should be level-appropriate, clear, and encouraging.
- Practice should support comprehension, vocabulary use, guided writing, roleplay, and feedback.

Manual QA needed:

- Start practice from a lesson and ask content-specific questions.
- Verify the AI uses the material and does not invent unrelated facts.
- Submit learner mistakes and verify corrections are useful and not too advanced.

