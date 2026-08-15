# LanguageLearning Product Spec

Last updated: 2026-08-15

## 1. Product Positioning

LanguageLearning helps self-motivated Dutch learners turn Dutch material into a structured, AI-guided language lesson.

The product is for learners who want to build real Dutch ability through focused practice, not simply maintain a streak or browse isolated vocabulary. A typical learning session should take about 10-30 minutes and feel like studying with a patient tutor who turns real content into deliberate practice.

One-liner:

> Turn any Dutch material into your own language lesson.

Supporting message:

> Learn with a structured, AI-guided learning experience.

Core promise:

> Learn Dutch deeply. Build real Dutch through structured practice.

## 2. Target Users

Primary users are self-motivated Dutch learners who want flexible, serious study without expensive tutors or fixed weekly classes.

They may be:

- Living in the Netherlands or preparing to move there.
- Learning Dutch for integration, work, study, relationships, or daily life.
- Frustrated by shallow language apps.
- Using textbooks, PDFs, articles, websites, notes, or other Dutch materials.
- Looking for guided practice across reading, vocabulary, grammar, listening, speaking, and writing.

## 3. Product Principles

- The product should be structured, warm, practical, and trustworthy.
- AI should act as a tutor, guide, practice partner, feedback engine, and patient coach.
- AI should not feel like a generic chatbot or a novelty layer.
- Lessons should be based on real Dutch content, with level-aware support.
- The learner should always know what to study next.
- The app should avoid childish gamification and avoid making streaks the core value.
- The app should support serious learners with limited time.

## 4. Core Learning Flow

The ideal session flow:

1. The learner adds or chooses Dutch material.
2. The app analyzes the material.
3. The app builds a structured lesson from the material.
4. The learner studies level-appropriate vocabulary and phrases.
5. The learner receives grammar and usage guidance in context.
6. The learner completes guided exercises.
7. The learner practices output through writing or speaking.
8. The learner receives corrections and explanations.
9. The learner reviews what they learned and can continue later.

## 5. Material Generation And Selection

The app may support both user-provided material and generated Dutch materials.

Material generation rules:

- Generated material must match the requested CEFR level as closely as possible.
- The system must not trust the model's self-reported CEFR label.
- The generated text must be validated after generation.
- The validated material level must be stored and reused consistently.
- If generated material is outside the requested range, it should be rejected, regenerated, downgraded, or clearly marked as a stretch item.
- Regeneration should produce meaningfully different material unless the user explicitly asks to repeat.
- Fallback examples must not repeatedly return the same static set in the same order.
- Server routes involved in generation should avoid stale cached responses.

Material display rules:

- The same material must show the same CEFR level on cards, preview, diagnosis, lesson pages, and practice screens.
- The card badge must reflect the analyzed material level, not merely the requested target level.
- Preview must use the stored analysis, not run a separate heuristic.
- Diagnosis must display the stored material level, not the user's learner level.

## 6. CEFR Analysis

CEFR analysis should be treated as a shared product service, not a UI-only calculation.

Rules:

- There must be one source of truth for material CEFR.
- Material CEFR, difficulty label, hard-word ratio, and vocabulary candidates should come from the same shared analysis.
- The analysis result should be attached to the lesson or material object so downstream screens do not recompute it differently.
- The learner's level and the material's level are different concepts and must not be conflated.
- The app should distinguish between:
  - `learnerLevel`: the user's current level.
  - `targetLevel`: the requested generation or practice level.
  - `materialLevel`: the analyzed level of the actual material.
  - `shownLevel`: the level currently displayed in UI, which should normally map to `materialLevel` for material difficulty.

Current implementation note:

- Batch 1 introduced a deterministic CEFR module intended to act as the single source of truth.
- This improves consistency, but linguistic accuracy still needs manual QA and future calibration.
- The current CEFR module should be treated as a stable baseline, not a final expert-grade CEFR classifier.

Difficulty labels:

- `Comfortable`: material is at or below the learner's level.
- `Balanced`: material is close to the learner's level and suitable for focused study.
- `Stretch`: material is above the learner's level and should be clearly framed as challenging.

## 7. Vocabulary And Phrase Extraction

Vocabulary extraction must be CEFR-aware.

Rules:

- The app should prioritize useful words, phrases, collocations, and expressions that matter for the learner's level and goals.
- Selection must not be based primarily on word length.
- Selection should not only inspect the first few candidate words in document order.
- Harder words later in the text must remain eligible.
- Proper nouns, obvious names, and noise tokens should be filtered or deprioritized.
- Vocabulary shown in diagnosis and lesson study should be explainable in context.
- Vocabulary should be connected to the source sentence where useful.

Expected vocabulary metadata:

- Surface form.
- Lemma or normalized form when available.
- Estimated CEFR level.
- Source sentence or phrase.
- Short learner-friendly explanation.
- Optional translation.
- Optional example sentence.

## 8. Diagnosis

The diagnosis experience should help the learner understand whether the material fits their level and what to focus on.

Rules:

- Diagnosis must use the same material analysis as the rest of the app.
- Diagnosis must not display the learner's level as if it were the material's level.
- Diagnosis should explain the relationship between learner level and material level.
- Diagnosis should surface genuinely difficult vocabulary and patterns.
- Diagnosis should avoid contradictory labels across screens.

Minimum diagnosis output:

- Analyzed material level.
- Learner level.
- Fit label: comfortable, balanced, or stretch.
- Key hard words or phrases.
- Short explanation of why the material is easy, appropriate, or challenging.
- Recommended study focus.

## 9. Lesson Navigation

The lesson should feel like a guided path, not a loose set of disconnected panels.

Rules:

- The learner should be able to move through the lesson step by step.
- Navigation should preserve lesson state.
- The user should be able to return to previous sections without losing progress.
- The UI should distinguish between material preview, diagnosis, vocabulary study, grammar guidance, exercises, and AI practice.
- Navigation labels should be learner-facing and clear.
- The product should avoid dead ends where the learner does not know what to do next.

Expected lesson sections:

- Preview or material overview.
- Diagnosis.
- Vocabulary and phrases.
- Grammar or usage notes.
- Guided practice.
- Practice with AI.
- Review or completion summary.

Open product decision:

- The exact final section order is not locked yet. Keep navigation changes scoped and testable until the lesson flow is finalized.

## 10. TTS And Audio

Audio should support focused listening practice and pronunciation exposure.

Rules:

- Dutch text should use a high-quality Dutch TTS voice when configured.
- The app should verify which provider and voice are actually being used.
- The app should avoid silently falling back to lower-quality voices without visible or logged indication.
- Browser or system voice fallback may be acceptable only as a graceful fallback, not as the expected production path.
- Audio loading, playback, and progress state must be accurate.
- Playback progress must not advance while audio is still loading or buffering.
- The UI should clearly distinguish loading, ready, playing, paused, ended, and error states.

Expected technical behavior:

- TTS request includes the intended language code and voice name.
- Server response format matches what the browser audio player expects.
- Client playback waits for audio readiness events before advancing progress.
- Failed TTS requests should not create broken player states.
- Repeated playback should reuse loaded audio when appropriate.

Batch 2 status:

- Premium Google TTS verification is open/planned.
- Loading/progress correctness is open/planned.

## 11. Sentence And Chunk Processing

Chunking should make reading and listening easier.

Rules:

- Text should be split into learner-friendly chunks.
- Chunks should respect sentence boundaries when possible.
- Very long sentences should be split into smaller semantic units.
- Chunks should not be so short that they feel unnatural.
- Abbreviations, initials, decimal numbers, and common Dutch punctuation patterns should not cause broken splits.
- Chunking should serve both reading display and audio playback.
- The app should avoid mismatches where the visible sentence and spoken audio chunk do not align.

Suggested constraints:

- Prefer complete sentences for A1-A2 when they are short.
- Split long B1+ sentences at commas, conjunctions, clauses, or phrase boundaries when possible.
- Keep each chunk readable on mobile.
- Keep audio chunks short enough for smooth TTS and replay.

Batch 2 status:

- Chunking improvements are open/planned.

## 12. Practice With AI

Practice with AI should be tied to the lesson material, not a generic open chat.

Rules:

- AI practice should use the current material, vocabulary, grammar focus, learner level, and lesson state.
- The AI partner should respond naturally but stay within the learning context.
- The AI should correct mistakes with clear, encouraging explanations.
- Practice should support writing first; speaking can build on the same lesson context when audio input is available.
- The app should avoid giving answers that are too advanced for the learner's level unless explaining a stretch concept.
- The AI should not invent lesson facts that are not present in the material.

Expected practice modes:

- Comprehension check.
- Vocabulary use.
- Sentence transformation.
- Guided writing.
- Conversation roleplay.
- Correction and feedback.

Open product decision:

- The exact AI practice modes and scoring model are not finalized.

## 13. Data Consistency Rules

Use consistent field semantics across server, client, and UI.

Important fields:

- `learnerLevel`: the user's current CEFR level.
- `targetLevel`: the level requested for generated material or exercise generation.
- `materialLevel`: the validated CEFR level of the actual Dutch text.
- `recommendedLevel`: only acceptable if it is derived from the canonical material analysis.
- `difficultyFit`: relationship between learner level and material level.
- `analysis`: the shared material analysis object.
- `lessonId` or `materialId`: stable ID derived from material identity where appropriate.

Rules:

- Do not derive the same concept independently in multiple places.
- Do not overwrite analyzed material level with target level.
- Do not display learner level where material level is required.
- Do not allow client and server CEFR logic to drift.

## 14. Quality Bar

Before a feature is considered done:

- It should be tested against at least A1, A2, and B1 Dutch material.
- Card, preview, diagnosis, and lesson screens should agree on material level.
- The learner should understand whether a material is comfortable, balanced, or stretch.
- Vocabulary should include useful level-appropriate items, not just long words.
- TTS should clearly use the intended provider or expose fallback behavior.
- Audio progress should match actual playback.
- Navigation should preserve state across the lesson.

