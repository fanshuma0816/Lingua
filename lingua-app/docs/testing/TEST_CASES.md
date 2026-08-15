# LanguageLearning Test Cases

Last updated: 2026-08-15

This file is designed for solo builder + AI coding iteration. Each test case should be small enough to run manually after a batch, while still giving an AI coding agent clear expected behavior.

## Test Data

Use three levels of Dutch material:

### A1 Sample

```
Ik woon in Amsterdam. Ik ga vandaag naar de supermarkt. Ik koop brood, melk en appels. Daarna drink ik koffie thuis.
```

Expected:

- Short sentences.
- Common vocabulary.
- Material level should be A1 or possibly A2 only if the analyzer is conservative.

### A2 Sample

```
Morgen neem ik de trein naar Utrecht, omdat ik daar een afspraak heb. Ik moet eerst mijn kaart opladen en daarna zoek ik het juiste perron.
```

Expected:

- Basic subordinate clause with `omdat`.
- Everyday travel vocabulary.
- Material level should be around A2.

### B1 Sample

```
Steeds meer gemeenten proberen hun inwoners te stimuleren om vaker de fiets te nemen, vooral tijdens de drukke ochtendspits. Toch blijft het openbaar vervoer belangrijk voor mensen die verder van hun werk wonen.
```

Expected:

- Longer sentences.
- More abstract vocabulary.
- Material level should be around B1.

## Batch 1 Verification: Material Generation And CEFR

### TC-001: CEFR consistency across card, preview, diagnosis, and lesson

Status: Required manual QA

Steps:

1. Set learner level to A1.
2. Generate or load a B1-like material.
3. Open the material card.
4. Open preview.
5. Open diagnosis.
6. Open the lesson.

Expected:

- All material-level displays agree.
- The app does not show A1 simply because the learner is A1.
- Diagnosis shows both learner level and material level where relevant.

### TC-002: Target level is not reused as material level

Status: Required manual QA

Steps:

1. Request A1 generated material.
2. Inspect the generated text.
3. Compare requested target level with analyzed material level.

Expected:

- The app analyzes the generated text after generation.
- If the text is harder than A1, the app does not blindly label it A1.
- Harder material is regenerated, rejected, downgraded, or marked as stretch.

### TC-003: Regeneration returns varied materials

Status: Required manual QA

Steps:

1. Generate material for the same learner level and topic.
2. Regenerate at least five times.
3. Record titles, text openings, and topics.

Expected:

- Results are meaningfully different.
- The same fallback set does not appear in the same order repeatedly.
- No stale cached response is reused.

### TC-004: Fallback sample variation

Status: Required manual QA

Steps:

1. Temporarily simulate AI generation failure or unavailable API.
2. Trigger material generation several times.

Expected:

- Fallback material is available.
- Fallback responses vary in order or selection.
- The app does not repeatedly show the exact same three samples in the same order.

## Batch 1 Verification: Vocabulary And Diagnosis

### TC-005: Vocabulary selection is CEFR-aware

Status: Required manual QA

Steps:

1. Load the B1 sample text.
2. Set learner level to A1 or A2.
3. Open diagnosis and vocabulary sections.

Expected:

- Vocabulary includes words such as `gemeenten`, `stimuleren`, `ochtendspits`, or `openbaar vervoer` when appropriate.
- Selection is not dominated by merely long words.
- Useful phrases can appear, not only isolated words.

### TC-006: Later hard words are not dropped

Status: Required manual QA

Steps:

1. Create a longer Dutch text where harder vocabulary appears near the end.
2. Run diagnosis.
3. Inspect vocabulary candidates.

Expected:

- Later hard words remain eligible.
- Candidate selection is not capped only to the first words in document order.

### TC-007: Diagnosis explains fit between learner and material

Status: Required manual QA

Steps:

1. Set learner level to A1.
2. Load A1, A2, and B1 samples one by one.
3. Open diagnosis for each.

Expected:

- A1 material is framed as comfortable.
- A2 material is framed as balanced or mild stretch.
- B1 material is framed as stretch.
- The explanation is learner-friendly and not overly technical.

## Batch 2 Planned Tests: TTS And Audio

### TC-008: Google TTS provider and voice verification

Status: Planned for Batch 2

Steps:

1. Configure production-like TTS environment variables.
2. Request audio for a Dutch sentence.
3. Inspect server logs or response metadata.

Expected:

- The app records or exposes the actual TTS provider.
- The exact Dutch voice name is visible in logs or debug output.
- The response uses the intended audio encoding.
- Browser/system speech synthesis is not used unless explicitly in fallback mode.

### TC-009: TTS fallback transparency

Status: Planned for Batch 2

Steps:

1. Simulate Google TTS failure or missing credentials.
2. Request audio.
3. Observe UI and logs.

Expected:

- The app does not silently pretend premium TTS succeeded.
- Fallback behavior is understandable during debugging.
- The user is not left with a broken player.

### TC-010: Progress does not move while audio is loading

Status: Planned for Batch 2

Steps:

1. Throttle network speed.
2. Start audio playback.
3. Watch progress before audio is audible.

Expected:

- The player shows loading or buffering.
- Progress remains still until real playback begins.
- Progress follows media playback time, not an independent timer.

### TC-011: Pause and resume progress accuracy

Status: Planned for Batch 2

Steps:

1. Play audio.
2. Pause after a few seconds.
3. Wait five seconds.
4. Resume playback.

Expected:

- Progress freezes while paused.
- Progress resumes from the correct timestamp.
- The audio and visual progress remain aligned.

### TC-012: Audio error state

Status: Planned for Batch 2

Steps:

1. Force an invalid audio URL or failed TTS response.
2. Try to play audio.

Expected:

- The player shows an error state.
- Progress does not move.
- The user can retry or continue without the UI getting stuck.

## Batch 2 Planned Tests: Sentence And Chunking

### TC-013: Long sentence splits into learner-friendly chunks

Status: Planned for Batch 2

Input:

```
Hoewel veel mensen graag zelfstandig Nederlands leren, merken ze vaak dat authentieke teksten moeilijk blijven wanneer ze geen duidelijke uitleg, woordenschatsteun of oefening krijgen.
```

Expected:

- The sentence may be split into smaller semantic chunks.
- Chunks remain natural and readable.
- Splits should prefer clause boundaries.

### TC-014: Abbreviations do not break sentence splitting

Status: Planned for Batch 2

Input:

```
Ik heb een afspraak met dr. De Vries om 10.30 uur. Daarna ga ik naar huis.
```

Expected:

- `dr.` does not become a separate sentence.
- `10.30` does not break incorrectly.
- The result contains two logical sentences.

### TC-015: Display chunks and TTS chunks align

Status: Planned for Batch 2

Steps:

1. Open a lesson with multiple chunks.
2. Play audio chunk by chunk.
3. Compare highlighted or visible text with spoken audio.

Expected:

- The visible chunk matches the spoken chunk.
- Replay repeats the same text the learner sees.

## Lesson Navigation Tests

### TC-016: Full lesson flow has no dead ends

Status: Needs diagnosis

Steps:

1. Start from a material card.
2. Move through preview, diagnosis, vocabulary, grammar, guided practice, AI practice, and review.
3. Use back and next controls.

Expected:

- The learner always has a clear next action.
- Returning to a previous section preserves progress.
- The lesson does not reset unexpectedly.

### TC-017: Mobile navigation remains usable

Status: Needs diagnosis

Steps:

1. Open a lesson on a mobile viewport.
2. Move through every lesson section.
3. Check buttons, labels, and progress indicators.

Expected:

- Navigation controls are visible and tappable.
- Text does not overflow or overlap.
- The user can complete the lesson on mobile.

## Practice With AI Tests

### TC-018: AI practice stays grounded in lesson material

Status: Needs diagnosis

Steps:

1. Open AI practice from a lesson.
2. Ask a question about a vocabulary item or sentence from the material.
3. Ask an unrelated question.

Expected:

- The AI answers lesson-specific questions using the material context.
- The AI gently redirects unrelated questions back to learning when appropriate.
- The AI does not invent facts about the source text.

### TC-019: AI feedback is level-appropriate

Status: Needs diagnosis

Steps:

1. Set learner level to A1 or A2.
2. Submit a short Dutch writing answer with mistakes.
3. Review feedback.

Expected:

- Feedback is clear, encouraging, and not too advanced.
- Corrections include a short explanation.
- The AI gives the learner a next attempt or improved version.

### TC-020: AI practice uses target vocabulary

Status: Needs diagnosis

Steps:

1. Complete vocabulary study.
2. Start AI practice.
3. Ask for a practice exercise.

Expected:

- The exercise uses vocabulary or phrases from the current lesson.
- The AI does not switch to unrelated generic vocabulary.

