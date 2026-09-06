"use client";

import { DB } from "./storage";

function wordKey(item) {
  return `${item?.lang || ""}:${item?.word || ""}`.toLowerCase();
}

function grammarKey(item) {
  return `${item?.lang || ""}:${item?.title || ""}:${item?.example || ""}`.toLowerCase();
}

function mergeCachedWords(words) {
  const cached = DB.get("collectionWordCards", {}) || {};
  return (words || []).map((word) => ({ ...(cached[wordKey(word)] || {}), ...word }));
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

export { fetchCollection, saveGrammarToCollection, saveWordToCollection };
