import { levelIdx } from "../config/constants";
import { compactQuote, stableHash } from "../lib/format";
import { DB } from "../lib/storage";

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
  if(lang==="Dutch") return fresh([
    {title:"Een rustige ochtend in de stad",source:"Daily story",level:level.slice(0,2),text:"Elke ochtend fietst Noor langs de gracht naar haar werk. Vandaag is de lucht helder en de stad voelt langzaam wakker. Bij de bakker koopt ze een klein broodje en praat ze kort met de man achter de toonbank. Hij vertelt dat het drukker wordt sinds de zon weer schijnt. Noor glimlacht, stapt op haar fiets en merkt dat ze deze gewone ochtend eigenlijk heel fijn vindt."},
    {title:"Waarom steeds meer mensen de trein nemen",source:"Short news explainer",level:levelIdx(level)<=1?"B1":level.slice(0,2),text:"In Nederland kiezen steeds meer mensen voor de trein als ze naar een andere stad reizen. De reis is vaak rustig, en reizigers kunnen onderweg lezen, werken of naar muziek luisteren. Toch zijn er ook klachten: soms zijn treinen vol of te laat. Volgens vervoersbedrijven blijft de trein belangrijk, vooral voor mensen die duurzamer willen reizen."},
    {title:"Een gesprek over weekendplannen",source:"Dialogue",level:level.slice(0,2),text:"Sanne: Wat ga jij dit weekend doen?\nAmir: Ik wil naar een markt in Utrecht, omdat ik nieuwe kazen wil proeven en misschien een cadeau zoek voor mijn zus.\nSanne: Dat klinkt gezellig. Zullen we samen gaan?\nAmir: Goed idee. We spreken af bij het station en drinken daarna ergens koffie."},
    {title:"Bij de supermarkt",source:"Practical situation",level:level.slice(0,2),text:"Mila gaat na het werk naar de supermarkt. Ze koopt brood, melk, appels en rijst. Bij de kassa zoekt ze haar pas. De vrouw achter haar wacht rustig. Mila zegt sorry en betaalt snel. Buiten stopt ze alles in haar tas en loopt ze naar huis."},
    {title:"Een korte pauze",source:"Daily story",level:level.slice(0,2),text:"Tom werkt vandaag thuis. Om tien uur maakt hij koffie en opent hij het raam. Op straat hoort hij een fietsbel en twee kinderen lachen. Tom leest nog een korte mail. Daarna neemt hij vijf minuten pauze en kijkt hij naar de lichte lucht."},
    {title:"In de bibliotheek",source:"Culture note",level:level.slice(0,2),text:"Sara gaat op woensdag naar de bibliotheek. Ze zoekt een boek met korte verhalen. De medewerker helpt haar en geeft ook een kleine kaart. Op die kaart staan de tijden van een taalgroep. Sara neemt het boek mee en wil volgende week terugkomen."},
    {title:"Een afspraak bij de dokter",source:"Practical situation",level:level.slice(0,2),text:"Daan belt de dokter omdat hij al twee dagen moe is. De assistent vraagt naar zijn naam en geboortedatum. Daan krijgt een afspraak om half drie. Hij schrijft de tijd op papier en legt zijn pas klaar bij de deur."},
    {title:"Koken met een vriend",source:"Dialogue",level:level.slice(0,2),text:"Lisa: Wat eten we vanavond?\nKoen: Ik heb pasta, tomaten en kaas.\nLisa: Dan maken we een simpele saus.\nKoen: Goed idee. Jij snijdt de tomaten, en ik zet het water op.\nLisa: Prima. Daarna eten we samen aan tafel."},
    {title:"Een bericht van school",source:"Practical situation",level:level.slice(0,2),text:"Nora krijgt een bericht van de school van haar zoon. Morgen is er geen les in de ochtend. De kinderen komen pas om twaalf uur. Nora zet het in haar agenda en stuurt een kort bericht naar haar werk."},
  ]);
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

async function aiAnalyze(mode,payload){
  try{ const r=await fetch("/api/analyze",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode,...payload})});
    if(!r.ok) return null; return await r.json(); }catch(e){ return null; }
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

export { CACHEABLE_ANALYSIS, CHAT_FALLBACK, aiAnalyze, cachedAiAnalyze, chatFallback, sampleMaterials };
