# LanguageLearning Changelog

Last updated: 2026-08-15

This changelog is written for solo builder + AI coding iteration. It records product-level intent and implementation status without claiming unverified fixes as fully shipped.

## Status Labels

- `Done`: implemented and accepted.
- `Fixed, pending manual QA`: implementation reportedly changed, but needs product QA before being treated as fully verified.
- `Open`: known issue remains.
- `Planned`: accepted scope for a future batch.
- `Needs diagnosis`: investigate before changing code.

## 2026-08-15: Documentation Baseline

Status: Done

Created the working documentation set:

- `PRODUCT_SPEC.md`
- `BUGS.md`
- `TEST_CASES.md`
- `CHANGELOG.md`

Purpose:

- Provide a stable product and QA reference for AI coding iterations.
- Keep product rules separate from implementation prompts.
- Prevent future batches from accidentally rewriting unrelated systems.
- Track fixed, open, planned, and unverified work clearly.

Source context:

- `sources/PRODUCT_POSITIONING.md`
- Current LanguageLearning conversation context around material generation, CEFR, diagnosis, audio, chunking, navigation, and AI practice.

## Batch 1: Material Generation, CEFR, Vocabulary, Diagnosis

Status: Fixed, pending manual QA

Reported changes:

- Introduced a shared deterministic CEFR module as the intended single source of truth.
- Unified material CEFR usage across generation, lesson-building, cards, preview, and diagnosis.
- Added post-generation difficulty validation so generated text is not blindly labeled with the requested target level.
- Improved vocabulary selection toward CEFR-aware ranking.
- Reduced repeated generation by adding variation controls such as nonce, avoid-list behavior, no-store handling, dynamic route behavior, and fallback shuffling.

Problems addressed:

- Same material displaying different CEFR levels across screens.
- Diagnosis showing learner level instead of material level.
- Generated A1 requests producing harder text while still labeled A1.
- Vocabulary extraction selecting long/common words instead of useful hard words.
- Regeneration returning repeated or stale material.

Important caveat:

- The new CEFR logic is deterministic and consistency-oriented.
- It should not yet be treated as a linguistically perfect CEFR classifier.
- Manual QA and future calibration are still required.

Required follow-up:

- Run the Batch 1 tests in `TEST_CASES.md`.
- Manually inspect A1, A2, and B1 Dutch outputs.
- Confirm cards, preview, diagnosis, and lessons now agree.

## Batch 2: Audio Reliability, TTS Quality, Sentence Chunking

Status: Planned / open

Scope:

- Verify that premium Google Dutch TTS is actually used.
- Fix playback progress so it does not advance while audio is loading or buffering.
- Improve sentence and chunk splitting for learner-friendly reading and audio.

Known open issues:

- Audio may sound like a standard or fallback voice despite premium TTS configuration.
- Playback progress may move before audio is ready.
- Some sentence or audio chunks may be too long or semantically awkward.

Implementation rule:

- Batch 2 should not modify material generation, CEFR analysis, vocabulary ranking, diagnosis redesign, practice with AI, lesson navigation, or unrelated styling.

Required first step:

- Diagnose the full audio flow before making code changes:

```
lesson text -> sentence/chunk preparation -> TTS request -> Google TTS -> audio response -> browser loading -> playback -> progress UI
```

Expected outcome:

- The app can prove which TTS provider and voice were used.
- Audio player states accurately reflect loading, ready, playing, paused, ended, and error.
- Progress follows real media playback.
- Chunking creates readable and listenable Dutch segments.

## Future Batch: Lesson Navigation

Status: Needs diagnosis

Known product need:

- The lesson should feel like a guided path rather than disconnected panels.
- Learners should be able to move through preview, diagnosis, vocabulary, grammar, guided practice, AI practice, and review without losing state.

Do not mark as fixed until:

- A full lesson can be completed on desktop and mobile.
- Back/next navigation preserves progress.
- No section leaves the learner unsure what to do next.

## Future Batch: Practice With AI

Status: Needs diagnosis

Known product need:

- Practice with AI should be grounded in the current lesson material.
- The AI should use the material, vocabulary, grammar focus, learner level, and lesson state.
- Feedback should be clear, encouraging, and level-appropriate.

Do not mark as fixed until:

- AI practice answers lesson-specific questions using lesson context.
- AI corrections are useful for A1/A2 learners.
- The AI does not drift into unrelated generic chat.
- The learner receives a clear next action after feedback.

