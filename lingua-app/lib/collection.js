"use client";

async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Could not update your collection.");
  return data;
}

async function fetchCollection(accessToken) {
  return requestJson("/api/collection/list", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function saveWordToCollection(item, accessToken) {
  return requestJson("/api/collection/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: "word", item }),
  });
}

async function saveGrammarToCollection(item, accessToken) {
  return requestJson("/api/collection/save", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ type: "grammar", item }),
  });
}

export { fetchCollection, saveGrammarToCollection, saveWordToCollection };
