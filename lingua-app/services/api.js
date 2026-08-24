import { compactQuote, stableHash } from "../lib/format";
import { DB } from "../lib/storage";
import { cefrIdx, validateMaterialFit } from "../lib/cefr.mjs";
import { FALLBACK_DUTCH, topicKey } from "./fallbackMaterials";

const CHAT_FALLBACK={
  Dutch:["Laten we even in het Nederlands kletsen. Vertel me eens wat je interessant vond.",
    w=>`Gebruik het woord "${w}" in een korte zin.`,"Wat vind jij daarvan?","Waarom denk je dat?","Zeg nog één volledige zin."],
  Spanish:["Charlemos un momento en español. Cuéntame algo que te pareció interesante.",
    w=>`Usa la palabra "${w}" en una frase corta.`,"¿Qué opinas de eso?","¿Por qué piensas eso?","Di una frase completa más."],
  French:["Parlons un peu en français. Dis-moi ce que tu as trouvé intéressant.",
    w=>`Utilise le mot « ${w} » dans une phrase courte.`,"Qu'est-ce que tu en penses ?","Pourquoi tu penses cela ?","Dis encore une phrase complète."],
  German:["Lass uns kurz auf Deutsch sprechen. Erzähl mir, was du interessant fandest.",
    w=>`Benutze das Wort "${w}" in einem kurzen Satz.`,"Was denkst du darüber?","Warum denkst du das?","Sag noch einen ganzen Satz."],
  Italian:["Parliamo un attimo in italiano. Raccontami cosa hai trovato interessante.",
    w=>`Usa la parola "${w}" in una frase breve.`,"Che cosa ne pensi?","Perché lo pensi?","Di' ancora una frase completa."],
  Portuguese:["Vamos conversar um pouco em português. Conta-me uma coisa que achaste interessante.",
    w=>`Usa a palavra "${w}" numa frase curta.`,"O que achas disso?","Por que pensas isso?","Diz mais uma frase completa."],
  Japanese:["日本語で少し話しましょう。おもしろいと思ったことを一つ教えてください。",
    w=>`「${w}」を使って短い文を作ってください。`,"どう思いますか。","どうしてそう思いますか。","もう一つ文で言ってください。"],
  Korean:["한국어로 잠깐 이야기해 봐요. 흥미로웠던 것을 하나 말해 주세요.",
    w=>`"${w}"라는 단어를 써서 짧은 문장을 만들어 보세요.`,"어떻게 생각해요?","왜 그렇게 생각해요?","문장 하나를 더 말해 주세요."],
  "Mandarin Chinese":["我们用中文简单聊一聊。告诉我一个你觉得有意思的地方。",
    w=>`请用“${w}”造一个短句。`,"你怎么看？","你为什么这么想？","再说一个完整的句子。"],
  Arabic:["لنتحدث قليلا بالعربية. أخبرني بشيء وجدته مثيرا للاهتمام.",
    w=>`استخدم كلمة "${w}" في جملة قصيرة.`,"ما رأيك في ذلك؟","لماذا تعتقد ذلك؟","قل جملة كاملة أخرى."],
  Russian:["Давай немного поговорим по-русски. Расскажи, что тебе показалось интересным.",
    w=>`Используй слово «${w}» в коротком предложении.`,"Что ты об этом думаешь?","Почему ты так думаешь?","Скажи ещё одно полное предложение."],
  English:["Let's chat in English. Tell me one thing you found interesting.",
    w=>`Use the word "${w}" in a sentence.`,"What's your opinion?","Why do you think so?","Give me one more full sentence."],
};

function chatFallback(lang,word,topicLine){
  const list=CHAT_FALLBACK[lang]||CHAT_FALLBACK.English;
  const base=list.map(x=>typeof x==="function"?x(word||"it"):x);
  const quote=compactQuote(topicLine||"",88);
  if(lang==="Dutch" && quote) base[0]=`In de tekst lees je: "${quote}". Wat gebeurt er volgens jou?`;
  return base;
}

// --- Offline fallback picker (Dutch) --------------------------------------
// Pick varied, level-appropriate texts from the bundled library, matching the
// duration tier + chosen topics, and skipping anything already shown this
// session (by text signature) so regenerating never repeats a text.
function durTier(label){
  const nums=String(label||"").match(/\d+/g)?.map(Number)||[];
  const max=Math.min(60,nums[1]||nums[0]||45);
  return max<=15?"short":max<=35?"medium":"long";
}
function textSig(text){
  return stableHash(String(text||"").toLowerCase().replace(/\s+/g," ").trim());
}
function shuffle(arr){
  return arr.map(x=>[Math.random(),x]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
}
function pickFallbackMaterials(lang,level,duration,topics,excludeSigs=[],n=3){
  if(lang!=="Dutch") return [];
  const tier=durTier(duration);
  const keys=(Array.isArray(topics)?topics:[]).map(topicKey).filter(Boolean);
  const ex=new Set(excludeSigs||[]);
  const userIdx=cefrIdx(level);
  const capIdx=Math.min(4,userIdx+1);   // "i+1" ceiling: never harder than one level above the learner

  // Keep only texts that are NOT too hard for this learner. A hand label is not
  // trusted on its own: run the same CEFR check the AI path uses, and drop the
  // text if the analyzer validates it above the i+1 cap or with too many hard
  // words. This is what stops, e.g., an A1 learner ever being shown a B2 text.
  const eligible=[];
  for(const m of FALLBACK_DUTCH){
    if(ex.has(textSig(m.text))) continue;
    if(cefrIdx(m.level)>capIdx) continue;                 // cheap pre-filter on the hand label
    const a=validateMaterialFit(m.text,level).analysis;
    if(a.validatedTextLevelIdx>capIdx) continue;          // analyzer says too hard → drop
    if(a.hardWordRatio>0.30) continue;                    // too many words above the learner's level → drop
    eligible.push({ m, validated:a.validatedTextLevel, vIdx:a.validatedTextLevelIdx });
  }

  // Rank: prefer the matching duration tier, then a chosen topic, then the level
  // closest to (but never above) the learner — so we don't hand out a needlessly
  // trivial text when a level-appropriate one exists. Shuffle within equal ranks.
  const scored=shuffle(eligible).map(e=>({ e, key:[
    e.m.tier===tier?0:1,
    keys.length?(keys.includes(e.m.topic)?0:1):0,
    Math.abs(e.vIdx-userIdx),
  ]}));
  scored.sort((p,q)=>{ for(let i=0;i<p.key.length;i++){ if(p.key[i]!==q.key[i]) return p.key[i]-q.key[i]; } return 0; });

  const out=[]; const used=new Set();
  for(const {e} of scored){
    const s=textSig(e.m.text);
    if(used.has(s)) continue;
    used.add(s);
    out.push({ title:e.m.title, source:e.m.source, text:e.m.text,
      level:e.validated, validatedTextLevel:e.validated,   // honest, analyzer-validated badge
      duration, resultSource:"fallback" });
    if(out.length>=n) return out;
  }
  return out;
}

function sampleMaterials(lang,level,goal,duration,topics,avoid=[]){
  const topic=(topics&&topics[0])||"daily life";
  const avoidText=(Array.isArray(avoid)?avoid:[]).join(" | ").toLowerCase();
  const fresh=(items)=>{
    const filtered=items.filter(m=>{
      const hay=[m.title,m.source,m.text].join(" ").toLowerCase();
      return !avoidText || !avoidText.split("|").some(x=>x.trim()&&hay.includes(x.trim().toLowerCase()));
    });
    return (filtered.length>=3?filtered:items).sort(()=>Math.random()-0.5);
  };
  if(lang==="Dutch") return pickFallbackMaterials(lang,level,duration,topics,[],3);
  if(lang==="Japanese") return [
    {title:"朝の電車",source:"Daily story",text:"毎朝、ゆきは電車で学校へ行きます。今日は少し雨が降っていますが、駅はとてもにぎやかです。電車の中で、ゆきは短いニュースを読みます。となりの人は静かに音楽を聞いています。学校に着くころには、雨が止んで、空が少し明るくなりました。"},
    {title:"週末の予定",source:"Dialogue",text:"金曜日の午後、たけしは友だちに週末の予定を聞きました。友だちは新しいカフェに行きたいと言いました。そのカフェは駅の近くにあって、抹茶のケーキが有名です。二人は土曜日の午後に会うことにしました。"},
    {title:"小さなニュース",source:"Short news explainer",text:"最近、町の図書館を使う人が増えています。学生だけでなく、仕事をしている人や親子も来ます。図書館では本を読むだけではなく、勉強したり、イベントに参加したりできます。静かな場所で時間を過ごしたい人に人気があります。"},
  ];
  return fresh([
    {title:`A simple ${lang} story about ${topic}`,source:"Daily story",text:`This is a short learning text for a ${level} learner of ${lang}. It is about ${topic}. The sentences are simple, practical, and useful for ${goal}. Use this as a placeholder material when live AI recommendations are unavailable.`},
    {title:`A short ${lang} dialogue`,source:"Dialogue",text:`Two people talk about ${topic} in clear ${lang}. One person asks a simple question, and the other answers with everyday words. The text is designed for a ${duration} study session.`},
    {title:`A mini ${lang} explainer`,source:"Explainer",text:`This short text explains one idea about ${topic} in learner-friendly ${lang}. It uses clear sentences and a few repeated words so you can listen, read, and practise speaking.`},
  ]);
}

async function aiAnalyze(mode,payload,{timeoutMs=0}={}){
  const controller=timeoutMs?new AbortController():null;
  const timer=timeoutMs?setTimeout(()=>controller.abort(),timeoutMs):null;
  try{ const r=await fetch("/api/analyze",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},signal:controller?.signal,body:JSON.stringify({mode,...payload})});
    if(!r.ok) return null; return await r.json(); }catch(e){ return null; }
  finally{ if(timer) clearTimeout(timer); }
}

const CACHEABLE_ANALYSIS=new Set(["translate","explain","grammar","quiz","focus"]);

async function cachedAiAnalyze(mode,payload){
  if(!CACHEABLE_ANALYSIS.has(mode)) return aiAnalyze(mode,payload);
  const key="analysis:"+mode+":"+stableHash(payload);
  const cached=DB.get(key,null);
  if(cached) return cached;
  const fresh=await aiAnalyze(mode,payload);
  if(fresh) DB.set(key,fresh);
  return fresh;
}

export { CACHEABLE_ANALYSIS, CHAT_FALLBACK, aiAnalyze, cachedAiAnalyze, chatFallback, pickFallbackMaterials, sampleMaterials };
