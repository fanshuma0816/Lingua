import { analyzeDifficulty, cefrIdx as cefrIndex, materialId as cefrMaterialId } from "./cefr.mjs";
import { LEVELS, levelIdx } from "../config/constants";
import { fallbackWordInfo } from "./dutch";
import { clamp, clampToDuration } from "./format";
import { cleanText, contextFor, pickVocab, sentencesOf, words } from "./text";

function practiceQuestion(lesson,shownLang,uiLang){
  const sents=lesson.sents||[];
  const fullText=(sents||[]).join(" ").toLowerCase();
  const scene=writingScene(fullText,uiLang);
  const easy=levelIdx(lesson.level)<=1;
  if(uiLang==="zh"){
    return easy
      ? `${scene.zh} 请用 ${shownLang} 写 2–3 个短句：你需要什么、你会选择什么，或者你接下来会说什么。`
      : `${scene.zh} 请用 ${shownLang} 写 3–5 句：先写发生了什么，再补一句你的看法、选择或类似经历。`;
  }
  return easy
    ? `${scene.en} Write 2–3 short ${shownLang} sentences about what you need, what you choose, or what you say next.`
    : `${scene.en} Write 3–5 ${shownLang} sentences: first say what is happening, then add your opinion, choice, or a similar experience.`;
}

function writingScene(text,uiLang){
  const t=String(text||"");
  const match=(re)=>re.test(t);
  const scenes=[
    [/\b(supermarkt|brood|melk|appels|rijst|kassa)\b/i,
      "You are at the supermarket with Mila. She is buying bread, milk, apples, and rice.",
      "想象你和 Mila 在超市。她正在买面包、牛奶、苹果和米。"],
    [/\b(thuis|koffie|raam|pauze)\b/i,
      "Someone is working at home and takes a short coffee break by the open window.",
      "想象有人在家工作，十点做咖啡、打开窗户，短暂休息一下。"],
    [/\b(bibliotheek|boek|taalgroep)\b/i,
      "Someone is at the library choosing a book and noticing a language group.",
      "想象有人在图书馆选书，也看到一个语言小组的信息。"],
    [/\b(dokter|assistente?|afspraak|moe)\b/i,
      "Someone calls the doctor's office and gets an appointment for later today.",
      "想象有人打电话给诊所，并约到了今天晚些时候的时间。"],
    [/\b(pasta|tomaten|kaas|koken|water)\b/i,
      "Two friends are cooking a simple meal together.",
      "想象两个朋友正在一起做一顿简单的饭。"],
    [/\b(school|bericht|zoon|agenda|les)\b/i,
      "A parent receives a school message and needs to adjust the day.",
      "想象一位家长收到学校通知，需要调整当天安排。"],
    [/\b(trein|station|reizigers|reizen)\b/i,
      "Someone is planning or taking a train trip and thinking about the journey.",
      "想象有人正在计划或乘坐火车，关注这段行程。"],
    [/\b(weekend|markt|cadeau|station|koffie)\b/i,
      "Two people are making simple weekend plans together.",
      "想象两个人正在一起安排周末计划。"],
  ];
  const found=scenes.find(([re])=>match(re));
  if(found) return {en:found[1],zh:found[2]};
  return uiLang==="zh"
    ? {en:"The text describes a small everyday situation.",zh:"这段文本描述了一个日常小场景。"}
    : {en:"The text describes a small everyday situation.",zh:"这段文本描述了一个日常小场景。"};
}

function recommendLevel(text,sents){ const ws=words(text); if(!ws.length) return LEVELS[1];
  const avgLen=ws.reduce((a,w)=>a+w.length,0)/ws.length; const avgSent=ws.length/(sents.length||1);
  const score=avgLen+avgSent*0.4;
  if(score<7)return LEVELS[0]; if(score<8.5)return LEVELS[1]; if(score<10)return LEVELS[2]; if(score<12)return LEVELS[3]; return LEVELS[4]; }

const TOPIC_KEYWORDS={
  Technology:["technology","computer","software","internet","digital","data","robot","device","online","machine","algorithm","artificial","intelligence"],
  Environment:["climate","energy","environment","solar","renewable","carbon","pollution","nature","planet","sustainable","emissions","wind","ecosystem","forest"],
  Health:["health","medical","doctor","disease","brain","mental","exercise","diet","patient","medicine","wellness","sleep","body"],
  Business:["business","company","market","money","economy","finance","invest","startup","customer","profit","trade","price","industry"],
  Travel:["travel","country","city","trip","journey","flight","hotel","tourist","abroad","destination","adventure"],
  Food:["food","cook","recipe","meal","restaurant","kitchen","taste","dish","ingredient","dinner","flavour"],
  Education:["school","student","learn","teacher","study","education","university","class","knowledge","course","exam"],
  Sports:["game","team","player","sport","match","football","soccer","score","training","athlete","championship"],
  Science:["science","research","experiment","scientist","theory","discovery","space","physics","biology","chemistry","universe"],
  Culture:["music","film","book","story","history","culture","tradition","festival","artist","painting","poem"],
  Society:["people","society","community","government","social","public","policy","politics","rights","citizen"],
};

function inferTopics(text){ const ws=words(text); const wl=ws.join(" ");
  const scored=Object.entries(TOPIC_KEYWORDS).map(([k,list])=>[k,list.reduce((a,w)=>a+(wl.includes(w)?1:0),0)]).filter(x=>x[1]>0);
  scored.sort((a,b)=>b[1]-a[1]);
  if(scored.length) return scored.slice(0,3).map(x=>x[0]);
  return pickVocab(text,2).map(w=>w.replace(/^./,c=>c.toUpperCase())); }

function altered(sentence,pool){ const toks=sentence.split(/(\s+)/);
  const idxs=toks.map((t,i)=>({t,i})).filter(o=>/[\p{L}]{4,}/u.test(o.t));
  if(!idxs.length)return sentence+" (variant)";
  const pick=idxs[Math.floor(Math.random()*idxs.length)];
  const rep=pool[Math.floor(Math.random()*pool.length)]||"different";
  const clone=[...toks]; clone[pick.i]=rep; return clone.join(""); }

function quizItems(sents,pool,count){ const items=[]; const used=new Set(); const pickable=sents.filter(s=>s.length<160);
  for(let k=0;k<count&&pickable.length;k++){ let ci; do{ci=Math.floor(Math.random()*pickable.length);}while(used.has(ci)&&used.size<pickable.length);
    used.add(ci); const correct=pickable[ci]; const opts=[{t:correct,ok:true}]; let g=0;
    while(opts.length<4&&g++<20){ const d=altered(correct,pool); if(d!==correct&&!opts.some(o=>o.t===d)) opts.push({t:d,ok:false}); }
    for(let i=opts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]];}
    items.push({correct,options:opts}); } return items; }

function estimateVocabCount(text,chars){
  const wc=words(text||"").length;
  return clamp(Math.round(Math.max((chars||0)/120,wc*0.08)),6,30);
}

function estimateMinutes(chars,sentCount,vocabCount,diff,wordCount=0){
  const wc=wordCount||Math.max(1,Math.round((chars||0)/6));
  const s=sentCount||1;
  const base=6 + wc/70 + (vocabCount||8)*0.7 + s*1.8 + 5 + ((vocabCount||8)+s)*0.25;
  const mult=0.92 + (diff||3)*0.08;
  return clamp(Math.round((base*mult)/5)*5,15,60);
}

function materialStats(text,level,targetDuration){
  const clean=cleanText(text||""); const ws=words(clean); const sents=sentencesOf(clean);
  const recommended=recommendLevel(clean,sents); const diff=clamp(3+(levelIdx(recommended)-levelIdx(level)),1,5);
  const vocab=estimateVocabCount(clean,clean.length);
  const estimated=estimateMinutes(clean.length,sents.length,vocab,diff,ws.length);
  return {words:ws.length,chars:clean.length,vocab,mins:targetDuration?clampToDuration(estimated,targetDuration):estimated};
}

function sourceIcon(source){
  const s=(source||"").toLowerCase();
  if(s.includes("dialogue")) return "💬";
  if(s.includes("news")) return "📰";
  if(s.includes("podcast")) return "🎧";
  if(s.includes("vlog")||s.includes("youtube")) return "📹";
  if(s.includes("story")) return "📖";
  return "✨";
}

function fallbackGrammarItems(sentence,level,uiLang){
  const s=sentence||"";
  const zh=uiLang==="zh";
  if(/\b(omdat|terwijl|als|dat|wanneer)\b/i.test(s)) return [{
    point: zh ? "从句语序" : "Subclause word order",
    explain: zh ? "看到 omdat/als/dat 这类词时，后半句里的动词常常去句尾。" : "After words like omdat, als, or dat, the verb often moves toward the end.",
    examples:[
      {sentence:"Ik blijf thuis omdat het regent.",translation:zh?"我待在家，因为下雨了。":"I stay home because it is raining."},
      {sentence:"Zij zegt dat ze morgen komt.",translation:zh?"她说她明天来。":"She says that she is coming tomorrow."},
      {sentence:"Als ik tijd heb, bel ik je.",translation:zh?"如果我有时间，我给你打电话。":"If I have time, I will call you."},
    ],
  }];
  if(/\b(want|maar|dus|en)\b/i.test(s)) return [{
    point: zh ? "连接两个主句" : "Linking main clauses",
    explain: zh ? "want/maar/dus 后面通常保持普通主句语序，动词仍靠前。" : "After want, maar, or dus, Dutch usually keeps normal main-clause word order.",
    examples:[
      {sentence:"Ik ga mee, want ik heb tijd.",translation:zh?"我一起去，因为我有时间。":"I am coming along because I have time."},
      {sentence:"Het is laat, maar ik blijf nog even.",translation:zh?"已经晚了，但我还待一会儿。":"It is late, but I will stay a bit longer."},
      {sentence:"Ik ben moe, dus ik ga naar huis.",translation:zh?"我累了，所以我要回家。":"I am tired, so I am going home."},
    ],
  }];
  if(/\b(heb|hebt|heeft|hebben|ben|bent|is|zijn)\b.+\b(ge\p{L}+|gemaakt|gegaan|gezien|gekocht)\b/iu.test(s)) return [{
    point: zh ? "完成时" : "Perfect tense",
    explain: zh ? "hebben/zijn 加过去分词，常用来讲已经发生的事。" : "Dutch uses hebben or zijn plus a past participle for things that have happened.",
    examples:[
      {sentence:"Ik heb vandaag veel geleerd.",translation:zh?"我今天学了很多。":"I learned a lot today."},
      {sentence:"We zijn naar de markt gegaan.",translation:zh?"我们去了市场。":"We went to the market."},
      {sentence:"Hij heeft koffie gekocht.",translation:zh?"他买了咖啡。":"He bought coffee."},
    ],
  }];
  if(/\bom te\b|\bte\s+\p{L}{3,}\b/iu.test(s)) return [{
    point: zh ? "te + 动词" : "te + infinitive",
    explain: zh ? "te 后面接动词原形，常表达目的或动作本身。" : "te plus an infinitive often expresses a purpose or the action itself.",
    examples:[
      {sentence:"Ik probeer Nederlands te spreken.",translation:zh?"我试着说荷兰语。":"I try to speak Dutch."},
      {sentence:"Zij begint te lezen.",translation:zh?"她开始读。":"She starts to read."},
      {sentence:"We hebben tijd om te oefenen.",translation:zh?"我们有时间练习。":"We have time to practise."},
    ],
  }];
  return [{
    point: zh ? "主句语序" : "Main-clause word order",
    explain: zh ? `按你现在的 ${level.slice(0,2)} 水平，先抓住一件事：荷兰语主句里变位动词通常在第二个位置。` : `At ${level.slice(0,2)}, notice one useful anchor: the finite verb usually sits in second position.`,
    examples:[
      {sentence:"Vandaag fiets ik naar de markt.",translation:zh?"今天我骑车去市场。":"Today I cycle to the market."},
      {sentence:"Morgen werk ik thuis.",translation:zh?"明天我在家工作。":"Tomorrow I work from home."},
      {sentence:"Na het eten lees ik een boek.",translation:zh?"吃完饭后我读一本书。":"After dinner I read a book."},
    ],
  }];
}

function generateLesson(text,lang,level,goal,targetMin=null,providedMaterial=null){ const chars=text.length; const sents=sentencesOf(text);
  const vocabCount=estimateVocabCount(text,chars);
  const vlist=pickVocab(text,vocabCount);
  const vocab=vlist.map(w=>{ const f=fallbackWordInfo(w,lang,"en"); return {...f,word:w.replace(/^./,c=>c.toUpperCase()),context:contextFor(w,sents)}; });
  // ONE material analysis, shared with the server path via lib/cefr.mjs.
  const analysis=analyzeDifficulty(text,level);
  const estimated=estimateMinutes(chars,sents.length,vocabCount,Math.max(1,Math.min(5,3+(analysis.validatedTextLevelIdx-cefrIndex(level)))),words(text).length);
  const estMin=targetMin||estimated;
  const material=(providedMaterial&&providedMaterial.validatedTextLevel)
    ? {...providedMaterial,estimatedLessonTime:estMin}
    : { id:cefrMaterialId(text),title:null,source:null,targetUserLevel:analysis.targetUserLevel,
        validatedTextLevel:analysis.validatedTextLevel,difficultyTier:analysis.difficultyTier,
        hardWordRatio:analysis.hardWordRatio,vocabularyAnnotations:analysis.annotations,estimatedLessonTime:estMin };
  const recommended=LEVELS.find(l=>l.slice(0,2)===material.validatedTextLevel)||LEVELS[1];
  const diff=Math.max(1,Math.min(5,3+(cefrIndex(material.validatedTextLevel)-levelIdx(level))));
  return { lang,level,goal,charCount:chars,sents,vocab,vocabCount,vlist,recommended,material,diff,
    topics:inferTopics(text),
    estMin,
    grammarFocus:["Verb position in main clauses","Useful tense patterns","Connectors and sentence flow"],
    comprehension:quizItems([...sents].sort((a,b)=>a.split(/\s+/).length-b.split(/\s+/).length),vlist,3),
    recognition:quizItems(sents,vlist,3) }; }

export { TOPIC_KEYWORDS, altered, estimateMinutes, estimateVocabCount, fallbackGrammarItems, generateLesson, inferTopics, materialStats, practiceQuestion, quizItems, recommendLevel, sourceIcon };
