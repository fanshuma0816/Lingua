"use client";

import { DB } from "./storage";
import { fallbackWordInfo } from "./dutch";

const COLLECTION_REQUEST_TIMEOUT_MS = 15000;

function wordKey(item) {
  return wordLemmaKey(item?.word, item?.lang, item?.lemma);
}

function grammarKey(item) {
  return grammarItemKey(item);
}

// Fold inflected forms onto their base form so a word (and its variants) is
// only ever saved/listed once. Uses the existing Dutch lemma inference; for
// other languages (or unknown words) it falls back to the lowercased word.
function wordLemmaKey(word, lang, providedLemma) {
  const w = String(word || "").trim().toLowerCase();
  if (!w) return `${String(lang || "").toLowerCase()}:`;
  let lemma = String(providedLemma || "").trim().toLowerCase() || w;
  try {
    if (!providedLemma && lang === "Dutch") {
      const info = fallbackWordInfo(w, lang, "en");
      if (info && info.lemma) lemma = String(info.lemma).toLowerCase();
    }
  } catch (e) {}
  return `${String(lang || "").toLowerCase()}:${lemma}`;
}

// itemKey is locale-independent. Title remains a fallback for existing rows.
function grammarItemKey(item) {
  const lang = String(item?.lang || "").toLowerCase();
  const identity = String(item?.itemKey || item?.item_key || item?.title || "").trim().toLowerCase();
  return `${lang}:${identity}`;
}

function mergeCachedWords(words) {
  const cached = DB.get("collectionWordCards", {}) || {};
  return (words || []).map((word) => {
    const normalized = {
      ...word,
      itemKey: word?.itemKey || word?.item_key || null,
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
  return (grammar || []).map((item) => {
    const normalized = { ...item, itemKey: item?.itemKey || item?.item_key || null };
    return { ...(cached[grammarKey(normalized)] || {}), ...normalized };
  });
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), COLLECTION_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(path, { ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || "Could not update your collection.");
    return data;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("The collection request timed out.");
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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
