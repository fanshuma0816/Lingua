import { analyzeDifficulty, cefrIdx as cefrIndex, materialId as cefrMaterialId } from "./cefr.mjs";
import { LEVELS, levelIdx } from "../config/constants";
import { fallbackWordInfo } from "./dutch";
import { clamp, clampToDuration } from "./format";
import { cleanText, contextFor, pickVocab, sentencesOf, words } from "./text";

function practiceQuestion(lesson,shownLang,uiLang){
  const sents=lesson.sents||[];
  const fullText=(sents||[]).join(" ").toLowerCase();
  const generated=lesson.focus?.writingTask;
  if(generated?.situation&&generated?.goal){
    const role=generated.role?(uiLang==="zh"?`你的身份：${generated.role}。`:`Your role: ${generated.role}.`):"";
    const recipient=generated.recipient?(uiLang==="zh"?`写给：${generated.recipient}。`:`You are writing to ${generated.recipient}.`):"";
    return {
      prompt:[generated.situation,role,recipient,generated.goal].filter(Boolean).join(" "),
      points:Array.isArray(generated.points)?generated.points.slice(0,3):[],
      starters:Array.isArray(generated.starters)?generated.starters.slice(0,3):[],
    };
  }
  const scene=writingScene(fullText,uiLang);
  const easy=levelIdx(lesson.level)<=1;
  const local=uiLang==="zh"?scene.zh:scene.en;
  return {
    prompt:uiLang==="zh"
      ? `${local.situation} ${local.goal} 请用 ${shownLang} 写 ${easy?"2–3 个短句":"3–5 句"}。`
      : `${local.situation} ${local.goal} Write ${easy?"2–3 short":"3–5"} ${shownLang} sentences.`,
    points:local.points,
    starters:scene.starters,
  };
}

function writingScene(text,uiLang){
  const t=String(text||"");
  const match=(re)=>re.test(t);
  const scenes=[
    [/\b(supermarkt|brood|melk|appels|rijst|kassa)\b/i,
      {situation:"You are shopping with Mila for the items in the text.",goal:"Send her a short message to agree what to buy.",points:["Name two things you need.","Say which item you choose.","Ask one practical question."]},
      {situation:"你正在和 Mila 按照文本里的清单购物。",goal:"请给她写一条短消息，商量要买什么。",points:["说出两样需要的东西。","说明你选择哪一样。","问一个实际问题。"]},["We hebben … nodig.","Ik kies …","Zullen we …?"]],
    [/\b(thuis|koffie|raam|pauze)\b/i,
      {situation:"You are working at home in the situation from the text.",goal:"Tell a colleague how you organise your break.",points:["Say when you take a break.","Say what you do.","Explain why it helps."]},
      {situation:"你正在经历文本里的居家工作场景。",goal:"请告诉同事你会怎样安排休息。",points:["说明何时休息。","说明你会做什么。","解释这为什么有帮助。"]},["Om … uur …","Tijdens mijn pauze …","Dat helpt omdat …"]],
    [/\b(bibliotheek|boek|taalgroep)\b/i,
      {situation:"You are at the library from the text and notice the language group.",goal:"Write to a friend about whether you want to join.",points:["Mention the book or group.","Say what interests you.","Suggest a next step."]},
      {situation:"你来到文本里的图书馆，也看到了语言小组的信息。",goal:"请写信告诉朋友你是否想参加。",points:["提到书或语言小组。","说明哪里吸引你。","建议下一步怎么做。"]},["Ik heb … gezien.","Ik wil graag …","Ga je mee?"]],
    [/\b(dokter|assistente?|afspraak|moe)\b/i,
      {situation:"You need the doctor's appointment described in the text.",goal:"Write what you would say to the assistant.",points:["Describe the problem briefly.","Ask for an appointment.","Confirm the time."]},
      {situation:"你需要预约文本里提到的医生。",goal:"请写下你会怎样和诊所助理说明。",points:["简短说明问题。","提出预约请求。","确认时间。"]},["Ik voel me …","Kan ik een afspraak …?","Dus om … uur?"]],
    [/\b(pasta|tomaten|kaas|koken|water)\b/i,
      {situation:"You are cooking the meal from the text with a friend.",goal:"Divide the tasks in a short message.",points:["Say what you will prepare.","Ask your friend to do one thing.","Mention what happens next."]},
      {situation:"你正和朋友一起做文本里的那顿饭。",goal:"请用一条短消息分配任务。",points:["说明你会准备什么。","请朋友做一件事。","说明接下来做什么。"]},["Ik maak …","Kun jij …?","Daarna …"]],
    [/\b(school|bericht|zoon|agenda|les)\b/i,
      {situation:"You are the parent in the school situation from the text.",goal:"Reply to the school with a clear plan.",points:["Refer to the school message.","Say what you can or cannot do.","Ask or confirm the next step."]},
      {situation:"你是文本里收到学校通知的家长。",goal:"请回复学校，说明你的具体安排。",points:["提到学校通知。","说明你能做或不能做什么。","询问或确认下一步。"]},["Bedankt voor het bericht.","Ik kan …","Klopt het dat …?"]],
    [/\b(trein|station|reizigers|reizen)\b/i,
      {situation:"You are planning the train journey from the text.",goal:"Message a travel companion with the plan.",points:["Mention the departure time or station.","Say what you prefer.","Ask for confirmation."]},
      {situation:"你正在计划文本里的火车行程。",goal:"请给同行者发消息说明安排。",points:["提到出发时间或车站。","说明你的选择。","请对方确认。"]},["De trein vertrekt …","Ik wil liever …","Is dat goed?"]],
    [/\b(weekend|markt|cadeau|station|koffie)\b/i,
      {situation:"You are making the weekend plan from the text with a friend.",goal:"Suggest a concrete plan and invite a response.",points:["Suggest one activity.","Give a time or place.","Ask what your friend prefers."]},
      {situation:"你正和朋友安排文本里的周末活动。",goal:"请提出一个具体计划，并请对方回应。",points:["建议一项活动。","给出时间或地点。","询问朋友更喜欢什么。"]},["Zullen we …?","We kunnen om …","Wat vind jij?"]],
  ];
  const found=scenes.find(([re])=>match(re));
  if(found) return {en:found[1],zh:found[2],starters:found[3]};
  return {
    en:{situation:"Use the everyday situation from the text.",goal:"Write a message to someone involved in it.",points:["Mention one concrete detail from the text.","Say what you need, think or choose.","Add a question or next step."]},
    zh:{situation:"请使用文本里的日常场景。",goal:"给场景中的一个人写一条消息。",points:["提到文本里的一个具体细节。","说明你的需要、想法或选择。","补充一个问题或下一步。"]},
    starters:["In de tekst …","Ik denk dat …","Wat vind jij?"],
  };
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

function fallbackLearningObjectives(text,lang,level,goal){
  const lower=String(text||"").toLowerCase(),zh=typeof document!=="undefined"&&document.documentElement.lang.startsWith("zh");
  const pick=(en,cn)=>zh?cn:en;
  if(/restaurant|café|cafe|menukaart|bestellen|ober|serveerster/.test(lower))return [
    {type:"communicative",text:pick("Order food or a drink and make a polite request.","点餐或点饮料，并礼貌地提出一个要求。")},
    {type:"language",text:pick("Use common Dutch phrases for asking and responding in a restaurant.","使用餐厅场景中常见的荷兰语问答表达。")},
  ];
  if(/vrije tijd|weekend|hobby|graag|houden van/.test(lower))return [
    {type:"communicative",text:pick("Talk about what you like to do in your free time.","谈论自己空闲时间喜欢做的事情。")},
    {type:"communicative",text:pick("Ask someone about their plans or interests.","询问他人的计划或兴趣。")},
  ];
  if(/ik heet|mijn naam|ik woon|ik kom uit/.test(lower))return [
    {type:"communicative",text:pick("Introduce yourself and share basic personal information.","做简短的自我介绍并提供基本个人信息。")},
    {type:"communicative",text:pick("Ask and answer simple questions about where someone lives or comes from.","询问并回答居住地或来自哪里等简单问题。")},
  ];
  return [
    {type:"comprehension",text:pick("Identify the text's main situation and key details.","理解文本的主要情境和关键信息。")},
    {type:"communicative",text:pick("Summarize one important idea from the text in Dutch.","用荷兰语复述文本中的一个重要信息。")},
  ];
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
  const rank=levelIdx(level);
  if(/\bdwars\b/i.test(s)) return [{
    point: zh ? "表达：dwars zitten" : "Expression: dwars zitten",
    explain: zh ? "zitten 在这里不是“坐”，而是和 dwars 组成表达，表示某事让人烦心或别扭。" : "Here zitten is part of dwars zitten: something is bothering someone, not literally sitting.",
    level:"B2",
    examples:[
      {sentence:"Die opmerking zit me nog steeds dwars.",translation:zh?"那句话到现在还让我不舒服。":"That comment is still bothering me."},
      {sentence:"Wat zit haar dwars vandaag?",translation:zh?"她今天到底在烦什么？":"What is bothering her today?"},
      {sentence:"Er zit iets dwars tussen ons.",translation:zh?"我们之间有点不对劲。":"Something feels off between us."},
    ],
  }];
  if(/\b(omdat|terwijl|als|dat|wanneer)\b/i.test(s)) return [{
    point: rank>=2 ? (zh ? "从句承载背景信息" : "Subclause as background") : (zh ? "从句语序" : "Subclause word order"),
    explain: rank>=2
      ? (zh ? "omdat/als/dat 把原因或条件压进从句，让主句承载真正的重点。" : "Omdat, als, and dat tuck reasons or conditions into a clause so the main idea can carry the weight.")
      : (zh ? "看到 omdat/als/dat 这类词时，后半句里的动词常常去句尾。" : "After words like omdat, als, or dat, the verb often moves toward the end."),
    level: rank>=2 ? "B1" : "A2",
    examples:[
      {sentence:"Ik blijf thuis omdat het regent.",translation:zh?"我待在家，因为下雨了。":"I stay home because it is raining."},
      {sentence:"Zij zegt dat ze morgen komt.",translation:zh?"她说她明天来。":"She says that she is coming tomorrow."},
      {sentence:"Als ik tijd heb, bel ik je.",translation:zh?"如果我有时间，我给你打电话。":"If I have time, I will call you."},
    ],
  }];
  if(/\b(want|maar|dus|en)\b/i.test(s)) return [{
    point: rank>=2 ? (zh ? "连接词的语气功能" : "Connector nuance") : (zh ? "连接两个主句" : "Linking main clauses"),
    explain: rank>=2
      ? (zh ? "want 补理由，maar 制造转折，dus 推出结论；连接词会改变句子的语气流向。" : "Want adds a reason, maar turns the thought, and dus draws a conclusion; the connector shapes the sentence flow.")
      : (zh ? "want/maar/dus 后面通常保持普通主句语序，动词仍靠前。" : "After want, maar, or dus, Dutch usually keeps normal main-clause word order."),
    level: rank>=2 ? "B1" : "A2",
    examples:[
      {sentence:"Ik ga mee, want ik heb tijd.",translation:zh?"我一起去，因为我有时间。":"I am coming along because I have time."},
      {sentence:"Het is laat, maar ik blijf nog even.",translation:zh?"已经晚了，但我还待一会儿。":"It is late, but I will stay a bit longer."},
      {sentence:"Ik ben moe, dus ik ga naar huis.",translation:zh?"我累了，所以我要回家。":"I am tired, so I am going home."},
    ],
  }];
  if(/\b(heb|hebt|heeft|hebben|ben|bent|is|zijn)\b.+\b(ge\p{L}+|gemaakt|gegaan|gezien|gekocht)\b/iu.test(s)) return [{
    point: rank>=2 ? (zh ? "完成时的视角" : "Perfect-tense perspective") : (zh ? "完成时" : "Perfect tense"),
    explain: rank>=2
      ? (zh ? "完成时不只是说过去，也常强调这个经历或结果和现在有关。" : "The perfect tense often frames a past event by its present result, experience, or relevance.")
      : (zh ? "hebben/zijn 加过去分词，常用来讲已经发生的事。" : "Dutch uses hebben or zijn plus a past participle for things that have happened."),
    level: rank>=2 ? "B1" : "A2",
    examples:[
      {sentence:"Ik heb vandaag veel geleerd.",translation:zh?"我今天学了很多。":"I learned a lot today."},
      {sentence:"We zijn naar de markt gegaan.",translation:zh?"我们去了市场。":"We went to the market."},
      {sentence:"Hij heeft koffie gekocht.",translation:zh?"他买了咖啡。":"He bought coffee."},
    ],
  }];
  if(/\bom te\b|\bte\s+\p{L}{3,}\b/iu.test(s)) return [{
    point: rank>=2 ? (zh ? "te 短语压缩动作" : "Compact te-phrase") : (zh ? "te + 动词" : "te + infinitive"),
    explain: rank>=2
      ? (zh ? "te 短语可以把目的、尝试或评价压成一个紧凑的动作单位。" : "A te-phrase compresses purpose, attempt, or evaluation into one compact action unit.")
      : (zh ? "te 后面接动词原形，常表达目的或动作本身。" : "te plus an infinitive often expresses a purpose or the action itself."),
    level: rank>=2 ? "B1" : "A2",
    examples:[
      {sentence:"Ik probeer Nederlands te spreken.",translation:zh?"我试着说荷兰语。":"I try to speak Dutch."},
      {sentence:"Zij begint te lezen.",translation:zh?"她开始读。":"She starts to read."},
      {sentence:"We hebben tijd om te oefenen.",translation:zh?"我们有时间练习。":"We have time to practise."},
    ],
  }];
  if(rank>=2) return [];
  return [{
    point: zh ? "主句语序" : "Main-clause word order",
    explain: zh ? `按你现在的 ${level.slice(0,2)} 水平，先抓住一件事：荷兰语主句里变位动词通常在第二个位置。` : `At ${level.slice(0,2)}, notice one useful anchor: the finite verb usually sits in second position.`,
    level: "A1",
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
    learningObjectives:fallbackLearningObjectives(text,lang,level,goal),
    topics:inferTopics(text),
    estMin,
    grammarFocus:["Verb position in main clauses","Useful tense patterns","Connectors and sentence flow"],
    comprehension:quizItems([...sents].sort((a,b)=>a.split(/\s+/).length-b.split(/\s+/).length),vlist,3),
    recognition:quizItems(sents,vlist,3) }; }

export { TOPIC_KEYWORDS, altered, estimateMinutes, estimateVocabCount, fallbackGrammarItems, fallbackLearningObjectives, generateLesson, inferTopics, materialStats, practiceQuestion, quizItems, recommendLevel, sourceIcon };
