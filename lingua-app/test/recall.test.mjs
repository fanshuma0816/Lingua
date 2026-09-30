import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source=readFileSync(new URL("../lib/recall.js",import.meta.url),"utf8");
const recall=await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("normalization ignores case and punctuation",()=>{
  assert.equal(recall.normalizeRecallText("Morgen, GA ik!"),"morgen ga ik");
  assert.equal(recall.compareRecallAnswer("Met de trein.","met de trein").accepted,true);
});

test("comparison classifies missing, extra, order, and spelling differences",()=>{
  assert.deepEqual(recall.compareRecallAnswer("met trein","met de trein").categories,["missing_word"]);
  assert.deepEqual(recall.compareRecallAnswer("met de snelle trein","met de trein").categories,["extra_word"]);
  assert.deepEqual(recall.compareRecallAnswer("trein de met","met de trein").categories,["word_order"]);
  assert.ok(recall.compareRecallAnswer("met de trien","met de trein").categories.includes("spelling"));
});

test("fallback plan uses exact phrases and mixes in dictation",()=>{
  const sentences=[
    "Morgen ga ik met de trein naar Amsterdam.",
    "We moeten rekening houden met het weer.",
    "Dit plan komt goed tot zijn recht.",
  ];
  const items=recall.buildFallbackRecallPlan(sentences,["trein","rekening"],3);
  assert.equal(items.length,3);
  items.forEach(item=>{
    assert.ok(item.sourceSentence.includes(item.targetPhrase));
    assert.equal(item.hiddenWords.length,item.targetPhrase.trim().split(/\s+/).length);
    assert.equal(item.clozeBefore+item.targetPhrase+item.clozeAfter,item.sourceSentence);
  });
  assert.ok(items.some(item=>item.clozeType==="dictation"));
});

test("fallback without marked words keeps a modal pattern together",()=>{
  const [item]=recall.buildFallbackRecallPlan(["Voor sommige scholen moet je je kind al inschrijven als ze baby zijn."],[],1);
  assert.equal(item.targetPhrase,"moet je je kind al inschrijven");
  assert.equal(item.hiddenWords.length,6);
});

test("mastery distinguishes independent, supported, developing, and review",()=>{
  const base={attempts:[],fullSentenceAttempts:[],revealedSentence:false};
  assert.equal(recall.masteryForRecallItem({...base,fullSentenceAttempts:[{accepted:true}]}),"independent");
  assert.equal(recall.masteryForRecallItem({...base,fullSentenceAttempts:[{accepted:false},{accepted:true}]}),"supported");
  assert.equal(recall.masteryForRecallItem({...base,attempts:[{accepted:true}]}),"developing");
  assert.equal(recall.masteryForRecallItem(base),"review");
});

test("summary identifies mastered expressions and review targets",()=>{
  const items=[
    {id:"a",targetPhrase:"met de trein",attempts:[{accepted:true}],fullSentenceAttempts:[{accepted:true}],revealedSentence:false},
    {id:"b",targetPhrase:"rekening houden met",attempts:[{accepted:true,categories:[]}],fullSentenceAttempts:[{accepted:false,categories:["word_order"]}],revealedSentence:false},
  ];
  const summary=recall.summarizeRecall(items);
  assert.equal(summary.counts.independent,1);
  assert.equal(summary.counts.developing,1);
  assert.deepEqual(summary.mastered,["met de trein"]);
  assert.equal(summary.review[0].target,"rekening houden met");
});
