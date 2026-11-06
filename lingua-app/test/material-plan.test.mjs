// Bundle with esbuild --bundle --platform=node --format=esm, then run node --test on the output.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createMaterialPlan, materialStatus } from "../lib/material-plan.js";
import { fallbackLearningObjectives } from "../lib/lesson-client.js";

test("long pasted text becomes an ordered, complete multi-lesson plan",()=>{
  const text=Array.from({length:24},(_,i)=>`Paragraaf ${i+1}. Vandaag gaat Noor naar haar werk. Daarna spreekt ze met haar collega en schrijft ze een kort bericht. Aan het einde van de dag fietst ze rustig naar huis.`).join("\n\n");
  const plan=createMaterialPlan(text,{sourceType:"pasted",level:"A2 — Elementary",goal:"General fluency",targetMin:30});
  assert(plan.segments.length>1);
  assert.equal(plan.segments.map(s=>plan.cleanedText.slice(s.start,s.end)).join(""),plan.cleanedText);
  plan.segments.forEach((segment,index)=>{assert.equal(segment.index,index);assert(segment.estimatedMinutesMin<=segment.estimatedMinutesMax);});
});

test("material status is derived from segment progress",()=>{
  assert.equal(materialStatus([{status:"pending"},{status:"pending"}]),"pending");
  assert.equal(materialStatus([{status:"completed"},{status:"pending"}]),"in_progress");
  assert.equal(materialStatus([{status:"completed"},{status:"completed"}]),"completed");
});

test("learning objectives have a grounded local fallback",()=>{
  const objectives=fallbackLearningObjectives("Sanne vertelt over haar hobby en haar vrije tijd.","Dutch","A2","Conversation & speaking");
  assert(objectives.length>=2);assert(objectives.every(item=>item.type&&item.text));
});
