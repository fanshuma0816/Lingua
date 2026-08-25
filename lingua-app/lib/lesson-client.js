import { analyzeDifficulty, cefrIdx as cefrIndex, materialId as cefrMaterialId } from "./cefr.mjs";
import { LEVELS, levelIdx } from "../config/constants";
import { fallbackWordInfo } from "./dutch";
import { clamp, clampToDuration } from "./format";
import { cleanText, contextFor, pickVocab, sentencesOf, words } from "./text";

function practiceQuestion(lesson,shownLang,uiLang){
  const sents=lesson.sents||[];
  const fullText=(sents||[]).join(" ").toLowerCase();
  const scene=writingScene(fullText,lesson.topics,uiLang);
  const easy=levelIdx(lesson.level)<=1;
  if(uiLang==="zh"){
    return easy
      ? `${scene.zh} 请用 ${shownLang} 写 2–3 个短句：${scene.easyZh} 尽量自然地用上 2–3 个今天学到的词。`
      : `${scene.zh} 请用 ${shownLang} 写 3–5 句：${scene.advancedZh} 尽量自然地用上今天学到的词和表达。`;
  }
  return easy
    ? `${scene.en} Write 2–3 short ${shownLang} sentences about ${scene.easyEn} Try to use 2–3 words from today's lesson.`
    : `${scene.en} Write 3–5 ${shownLang} sentences: ${scene.advancedEn} Try to reuse words and expressions from today's lesson.`;
}

function writingScene(text,topics=[],uiLang){
  const t=String(text||"");
  const match=(re)=>re.test(t);
  const topicText=topicSummary(topics,uiLang);
  const scenes=[
    [/\b(supermarkt|brood|melk|appels|rijst|kassa)\b/i,
      "You are at the supermarket with Mila. She is buying bread, milk, apples, and rice.",
      "想象你和 Mila 在超市。她正在买面包、牛奶、苹果和米。",
      "what you need, what you choose, or what you say next.",
      "你需要什么、你会选择什么，或者你接下来会说什么。",
      "first say what is happening, then add your choice, opinion, or a similar experience.",
      "先写发生了什么，再补一句你的选择、看法或类似经历。"],
    [/\b(thuis|koffie|raam|pauze)\b/i,
      "Someone is working at home and takes a short coffee break by the open window.",
      "想象有人在家工作，十点做咖啡、打开窗户，短暂休息一下。",
      "what the person does, what they need, or how the break feels.",
      "这个人在做什么、需要什么，或者这段休息感觉如何。",
      "first describe the situation, then add how the person feels or what happens next.",
      "先描述这个情境，再补一句这个人的感受或接下来发生什么。"],
    [/\b(bibliotheek|boek|taalgroep)\b/i,
      "Someone is at the library choosing a book and noticing a language group.",
      "想象有人在图书馆选书，也看到一个语言小组的信息。",
      "what the person chooses, why it is useful, or what they ask next.",
      "这个人会选择什么、为什么有用，或者接下来会问什么。",
      "first describe the situation, then add a choice, reason, or question.",
      "先描述这个情境，再补一句选择、原因或问题。"],
    [/\b(dokter|assistente?|afspraak|moe)\b/i,
      "Someone calls the doctor's office and gets an appointment for later today.",
      "想象有人打电话给诊所，并约到了今天晚些时候的时间。",
      "what the person needs, what they say, or how they feel.",
      "这个人需要什么、会说什么，或者感觉如何。",
      "first describe the problem, then add what the person asks for or decides to do.",
      "先描述问题，再补一句这个人会请求什么或决定做什么。"],
    [/\b(pasta|tomaten|kaas|koken|water)\b/i,
      "Two friends are cooking a simple meal together.",
      "想象两个朋友正在一起做一顿简单的饭。",
      "what they make, what they need, or what they say to each other.",
      "他们做什么、需要什么，或者会对彼此说什么。",
      "first describe the meal, then add a choice, problem, or opinion.",
      "先描述这顿饭，再补一句选择、问题或看法。"],
    [/\b(school|bericht|zoon|agenda|les)\b/i,
      "A parent receives a school message and needs to adjust the day.",
      "想象一位家长收到学校通知，需要调整当天安排。",
      "what the message says, what changes, or what the parent does next.",
      "通知说了什么、有什么变化，或者家长接下来做什么。",
      "first describe the message, then add what changes or how the parent reacts.",
      "先描述通知内容，再补一句有什么变化或家长如何回应。"],
    [/\b(trein|station|reizigers|reizen)\b/i,
      "Someone is planning or taking a train trip and thinking about the journey.",
      "想象有人正在计划或乘坐火车，关注这段行程。",
      "where the person goes, what they need, or what happens on the trip.",
      "这个人去哪里、需要什么，或者路上发生了什么。",
      "first describe the journey, then add a plan, problem, or feeling.",
      "先描述这段行程，再补一句计划、问题或感受。"],
    [/\b(weekend|markt|cadeau|station|koffie)\b/i,
      "Two people are making simple weekend plans together.",
      "想象两个人正在一起安排周末计划。",
      "what they plan, what they choose, or what they say to each other.",
      "他们计划什么、选择什么，或者会对彼此说什么。",
      "first describe the plan, then add a choice, reason, or similar experience.",
      "先描述这个计划，再补一句选择、原因或类似经历。"],
    [/\b(klimaat|energie|energietransitie|duurzaam|duurzame|landbouw|voedselsysteem|maatschappelijke|vraagstukken|toekomstbestendig|oplossingen)\b/i,
      "This lesson is about climate, energy, food systems, and new solutions for society.",
      "这节课的主题是气候、能源、食物系统，以及面向社会的新解决方案。",
      "one important problem, one idea that matters, or one solution you find interesting.",
      "一个重要问题、一个你觉得重要的想法，或者一个你感兴趣的解决方案。",
      "summarize the issue, then add your opinion, a possible solution, or a role you think is important.",
      "先概括这个议题，再补充你的看法、一个可能的解决方案，或者你觉得重要的角色。"],
    [/\b(ontwerper|vacature|baan|functie|beroep|werk|studie|opleiding|vaardigheden|ervaring|affiniteit|vermogen|project)\b/i,
      "This lesson is about work, study, or a role someone can take.",
      "这节课的主题是工作、学习，或者某个具体角色。",
      "what the role is about, one skill it needs, or whether it sounds interesting.",
      "这个角色是做什么的、需要哪项能力，或者它听起来是否有意思。",
      "describe the role or task, then add one needed skill, reason, or personal opinion.",
      "先描述这个角色或任务，再补充一项需要的能力、一个原因或你的个人看法。"],
    [/\b(nieuws|vandaag|gisteren|regering|gemeente|minister|politie|onderzoek|rapport|besluit|verandering)\b/i,
      "This lesson is about a news event or a recent change.",
      "这节课的主题是一个新闻事件或近期变化。",
      "what happened, who is affected, or what may happen next.",
      "发生了什么、谁会受到影响，或者接下来可能发生什么。",
      "summarize what happened, then add why it matters or what might happen next.",
      "先概括发生了什么，再补充为什么重要或接下来可能怎样。"],
    [/\b(cultuur|traditie|festival|museum|kunst|muziek|film|geschiedenis|gewoonte|feest)\b/i,
      "This lesson is about culture, habits, or shared traditions.",
      "这节课的主题是文化、习惯或共同传统。",
      "one special detail, how it compares with your experience, or one question you have.",
      "一个特别的细节、它和你的经验有什么异同，或者你的一个问题。",
      "describe the cultural idea, then compare it with your experience or add a question.",
      "先描述这个文化内容，再和你的经验比较，或者补充一个问题。"],
    [/\b(technologie|computer|software|app|data|internet|ai|kunstmatige intelligentie|machine|systeem|ontwerp)\b/i,
      "This lesson is about technology, systems, or design.",
      "这节课的主题是技术、系统或设计。",
      "the main idea, one useful detail, or one question you still have.",
      "主要意思、一个有用细节，或者你还有的一个问题。",
      "explain the main idea, then add one benefit, risk, or question.",
      "先解释主要意思，再补充一个好处、风险或问题。"],
  ];
  const found=scenes.find(([re])=>match(re));
  if(found) return {en:found[1],zh:found[2],easyEn:found[3],easyZh:found[4],advancedEn:found[5],advancedZh:found[6]};
  return {
    en:`This lesson is about ${topicText.en}.`,
    zh:`这节课的主题是：${topicText.zh}。`,
    easyEn:"the main idea, one thing you think is important, or one question you have.",
    easyZh:"主要意思、你觉得重要的一点，或者你的一个问题。",
    advancedEn:"summarize the main idea, then add your opinion, a useful detail, or one question you still have.",
    advancedZh:"先概括主要意思，再补充你的看法、一个有用细节，或者你还有的一个问题。",
  };
}

function topicSummary(topics=[],uiLang){
  const clean=(Array.isArray(topics)?topics:[]).map(t=>String(t||"").trim()).filter(Boolean).slice(0,3);
  if(!clean.length) return uiLang==="zh"
    ? {en:"the topic, problem, or situation in the text",zh:"文本中的主题、问题或情境"}
    : {en:"the topic, problem, or situation in the text",zh:"文本中的主题、问题或情境"};
  return {en:clean.join(", "),zh:clean.join("、")};
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
