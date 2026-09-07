"use client";

import { DB } from "./storage";
import { fallbackWordInfo } from "./dutch";

function wordKey(item) {
  return `${item?.lang || ""}:${item?.word || ""}`.toLowerCase();
}

function grammarKey(item) {
  return `${item?.lang || ""}:${item?.title || ""}:${item?.example || ""}`.toLowerCase();
}

// Fold inflected forms onto their base form so a word (and its variants) is
// only ever saved/listed once. Uses the existing Dutch lemma inference; for
// other languages (or unknown words) it falls back to the lowercased word.
function wordLemmaKey(word, lang) {
  const w = String(word || "").trim().toLowerCase();
  if (!w) return `${String(lang || "").toLowerCase()}:`;
  let lemma = w;
  try {
    if (lang === "Dutch") {
      const info = fallbackWordInfo(w, lang, "en");
      if (info && info.lemma) lemma = String(info.lemma).toLowerCase();
    }
  } catch (e) {}
  return `${String(lang || "").toLowerCase()}:${lemma}`;
}

// Match a lesson grammar card to a saved one by language + title.
function grammarItemKey(item) {
  return `${String(item?.lang || "").toLowerCase()}:${String(item?.title || "").trim().toLowerCase()}`;
}

function mergeCachedWords(words) {
  const cached = DB.get("collectionWordCards", {}) || {};
  return (words || []).map((word) => {
    const normalized = {
      ...word,
      exampleTranslation: word?.exampleTranslation || word?.example_translation || null,
      audioKey: word?.audioKey || word?.audio_key || null,
      ttsLang: word?.ttsLang || word?.tts_lang || word?.lang || null,
      ttsRate: word?.ttsRate || word?.tts_rate || 1,
      ttsVoiceRole: word?.ttsVoiceRole || word?.tts_voice_role || null,
    };
    return { ...(cached[wordKey(normalized)] || {}), ...normalized };
  });
}

function mergeCachedGrammar(grammar) {
  const cached = DB.get("collectionGrammarCards", {}) || {};
  return (grammar || []).map((item) => ({ ...(cached[grammarKey(item)] || {}), ...item }));
}

function rememberWord(item) {
  const cached = DB.get("collectionWordCards", {}) || {};
  cached[wordKey(item)] = item;
  DB.set("collectionWordCards", cached);
}

function rememberGrammar(item) {
  const cached = DB.get("collectionGrammarCards", {}) || {};
  cached[grammarKey(item)] = item;
  DB.set("collectionGrammarCards", cached);
}

function forgetWord(item) {
  const cached = DB.get("collectionWordCards", {}) || {};
  delete cached[wordKey(item)];
  DB.set("collectionWordCards", cached);
}

function forgetGrammar(item) {
  const cached = DB.get("collectionGrammarCards", {}) || {};
  delete cached[grammarKey(item)];
  DB.set("collectionGrammarCards", cached);
}

async function removeWordFromCollection(item, accessToken) {
  const data = await requestJson("/api/collection/remove", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: "word", item }),
  });
  forgetWord(item);
  return data;
}

async function removeGrammarFromCollection(item, accessToken) {
  const data = await requestJson("/api/collection/remove", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: "grammar", item }),
  });
  forgetGrammar(item);
  return data;
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Could not update your collection.");
  return data;
}

async function fetchCollection(accessToken) {
  const data = await requestJson("/api/collection/list", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return {
    ...data,
    words: mergeCachedWords(data.words || []),
    grammar: mergeCachedGrammar(data.grammar || []),
  };
}

async function saveWordToCollection(item, accessToken) {
  const data = await requestJson("/api/collection/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: "word", item }),
  });
  rememberWord(item);
  return { ...data, item };
}

async function saveGrammarToCollection(item, accessToken) {
  const data = await requestJson("/api/collection/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: "grammar", item }),
  });
  rememberGrammar(item);
  return { ...data, item };
}

export { fetchCollection, grammarItemKey, removeGrammarFromCollection, removeWordFromCollection, saveGrammarToCollection, saveWordToCollection, wordLemmaKey };
