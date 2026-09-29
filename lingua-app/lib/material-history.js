import { materialId } from "./cefr.mjs";

const COOLDOWN = 7 * 24 * 60 * 60 * 1000;
const KEY = "lingua:materialHistory";
export function normalizedText(text) {
  return String(text || "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
export function materialSignature(text) {
  const tokens = normalizedText(text).split(" ").filter(Boolean);
  const shingles = new Set();
  for (let i = 0; i + 2 < tokens.length; i++) shingles.add(materialId(tokens.slice(i, i + 3).join(" ")));
  return { fingerprint: materialId(tokens.join(" ")), shingles: [...shingles].sort() };
}
export function activeHistory(history = [], now = Date.now()) {
  return history.filter(r => r && (r.status !== "shown" || now - r.updatedAt < COOLDOWN));
}
export function isRepeated(material, history = [], now = Date.now()) {
  const sig = materialSignature(material.text);
  return activeHistory(history, now).some(r => {
    if (r.id && r.id === material.id || r.fingerprint === sig.fingerprint) return true;
    if (r.legacy && normalizedText(r.title) === normalizedText(material.title) && material.title) return true;
    const other = new Set(r.shingles || []);
    if (other.size < 8 || sig.shingles.length < 8) return false;
    const shared = sig.shingles.filter(x => other.has(x)).length;
    return shared / Math.min(other.size, sig.shingles.length) >= 0.80
      && Math.min(other.size, sig.shingles.length) / Math.max(other.size, sig.shingles.length) >= 0.80;
  });
}
export function recordMaterial(history, material, status = "shown", now = Date.now()) {
  const sig = materialSignature(material.text);
  const index = history.findIndex(r => r.fingerprint === sig.fingerprint || r.id && r.id === material.id);
  const previous = index >= 0 ? history[index] : {};
  const order = { shown: 0, started: 1, completed: 2 };
  const record = { ...previous, ...sig, id: material.id || materialId(material.text || ""),
    title: material.title || previous.title || null, language: material.language || "Dutch",
    status: (order[previous.status] ?? -1) > order[status] ? previous.status : status,
    updatedAt: now };
  return [record, ...history.filter((_, i) => i !== index)];
}
export function readMaterialHistory() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(saved)) return saved;
    const legacy = JSON.parse(localStorage.getItem("lingua:recentMaterials")) || [];
    const migrated = [...new Set(legacy)].filter(x => typeof x === "string").map(x => ({
      ...(x.startsWith("m_") ? { id: x } : { title: x }), legacy: true, status: "shown", updatedAt: Date.now(),
    }));
    localStorage.setItem(KEY, JSON.stringify(migrated));
    return migrated;
  } catch { return []; }
}
export function rememberMaterial(material, status = "shown") {
  const records = recordMaterial(readMaterialHistory(), material, status);
  localStorage.setItem(KEY, JSON.stringify(records));
  return records;
}
