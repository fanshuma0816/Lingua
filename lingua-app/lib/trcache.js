// Tiny shared cache of per-sentence translations, keyed by translation language.
// Understanding (Learn 1) fills it as lines get translated; Vocabulary & Grammar
// (Learn 2) reads it first, so the same sentence is never re-translated — saving
// both time and tokens.
import { DB } from "./storage";

function key(translationLang){ return "trcache:"+(translationLang||"en"); }

function getLineTr(translationLang,sent){ if(!sent) return null; const m=DB.get(key(translationLang),{})||{}; return m[sent]||null; }

function setLineTr(translationLang,sent,tr){ if(!sent||!tr) return; const k=key(translationLang); const m=DB.get(k,{})||{}; if(m[sent]===tr) return; m[sent]=tr; DB.set(k,m); }

function clearLineTr(){ DB.set(key("en"),{}); DB.set(key("zh"),{}); }

export { getLineTr, setLineTr, clearLineTr };
