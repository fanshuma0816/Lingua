// node scripts/corpus/import-materials.mjs SOURCE.md [OUTPUT.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanText } from "../../lib/text.js";
import { materialId } from "../../lib/cefr.mjs";

// Explicit, source-specific corrections only. Never remove arbitrary suffixes.
const CORRECTIONS = {
  "Hoe heet je?": [["komt®", "komt"], ["komt~", "komt"]],
  "Boodschappen doen": [["niet&", "niet"], ["geena", "geen"]],
  "Hoe kom je naar de les": [["erovera", "erover"]],
  "Hoe women jullie?": [["woon jlj", "woon jij"]],
  "Hoe kom ik daar?": [["moeten&", "moeten"]],
  "Een leuk weekend": [["gehada", "gehad"], ["maaltija", "maaltijd"], ["jüj", "jij"], ["Had jü", "Had jij"]],
  "De bank": [["eis data", "eis dat"]],
  "Een dagje uit": [["ledereen akkoord", "Iedereen akkoord"], ["miin creditcard", "mijn creditcard"], ["totale bedras", "totale bedrag"], ["afte spreken", "af te spreken"]],
  "Op de helft": [["Dat«", "Dat"]],
};
const TITLES = { "Hoe women jullie?": "Hoe wonen jullie?", "Fest vieren": "Feest vieren" };
export function importMaterials(markdown, sourceFile = "A1-A2.md") {
  const lines = String(markdown).replace(/\r\n?/g,"\n").split("\n");
  const articles = []; let level = null, current = null;
  const order = { A1: 0, A2: 0 }, seen = new Set();
  const flush = () => {
    if (!current) return;
    const originalText = current.lines.join("\n").trim();
    if (!originalText) throw new Error(`Empty article: ${current.title}`);
    const key = `${current.level}:${current.title}`;
    if (seen.has(key)) throw new Error(`Duplicate article: ${key}`);
    seen.add(key);
    let corrected = originalText;
    const corrections = [];
    for (const [from,to] of CORRECTIONS[current.title] || []) {
      if (!corrected.includes(from)) throw new Error(`Source correction no longer matches: ${current.title}: ${from}`);
      corrections.push({ field: "text", from, to, occurrences: corrected.split(from).length-1 });
      corrected = corrected.split(from).join(to);
    }
    const title = TITLES[current.title] || current.title;
    if (title !== current.title) corrections.push({ field: "title", from: current.title, to: title });
    const text = cleanText(corrected), sequence = ++order[current.level];
    const contextWarnings = /\bfiguur\s*\d/i.test(text) ? ["References figures not included in the source"] : [];
    const tags = ["daily life"];
    for (const [tag,re] of [["travel",/reis|kaart|dagje|kom ik/i],["work & study",/school|werk|les|leren/i],["food",/boodschappen/i],["society",/bevolking|polit|gemeente|klimaat|bank|papieren/i],["culture",/feest|trouwen|republiek|provincies/i]]) if(re.test(title)) tags.push(tag);
    articles.push({ id: `nl-curated-${current.level.toLowerCase()}-${String(sequence).padStart(2,"0")}`,
      title, originalTitle: current.title, level: current.level, levelSource: "user-curated",
      source: "User-curated Dutch material", sourceFile, sourceOrder: articles.length, levelOrder: sequence,
      sourceLine: current.line, version: materialId(text), corpusVersion: 2,
      originalText, text, corrections, contextWarnings, tags });
    current = null;
  };
  lines.forEach((line,index) => {
    const group = line.match(/^# (A1|A2)\s*$/);
    if (group) { flush(); if (group[1]==="A1" && level==="A2") throw new Error("A1 must precede A2"); level=group[1]; return; }
    const heading = line.match(/^### (.+)$/);
    if (heading) { flush(); if(!level) throw new Error("Article has no level"); current={title:heading[1].trim(),level,line:index+1,lines:[]}; return; }
    if (current) current.lines.push(line);
  });
  flush();
  if(order.A1!==17 || order.A2!==22) throw new Error(`Expected 17 A1 / 22 A2 articles, got ${JSON.stringify(order)}`);
  return articles;
}
if(process.argv[1] && path.basename(process.argv[1]) === "import-materials.mjs" && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv[2];
  if(!input) throw new Error("Provide the source Markdown path");
  const output = process.argv[3] || path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../../data/corpus/a1-a2-materials.json");
  const articles=importMaterials(fs.readFileSync(input,"utf8"),path.basename(input));
  fs.writeFileSync(output,JSON.stringify(articles,null,2)+"\n");
  console.log(`Imported ${articles.length} articles: 17 A1, 22 A2. Corrections: ${articles.reduce((n,a)=>n+a.corrections.length,0)}.`);
}
