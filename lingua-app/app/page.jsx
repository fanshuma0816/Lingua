"use client";
import { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import { analyzeDifficulty, materialId as cefrMaterialId, cefrIdx as cefrIndex } from "../lib/cefr.mjs";



const DB={ get(k,d){try{return JSON.parse(localStorage.getItem("lingua:"+k))??d}catch(e){return d}},
  set(k,v){localStorage.setItem("lingua:"+k,JSON.stringify(v))},
  clearAll(){Object.keys(localStorage).filter(x=>x.startsWith("lingua:")).forEach(x=>localStorage.removeItem(x))} };

const UI_TEXT={
  en:{
    interfaceLanguage:"Interface language", english:"English", chinese:"中文", languageNames:{Dutch:"Dutch"}, clearLocalData:"Clear local data", clearConfirm:"Clear all local learning data (draft, notes, ratings, progress)?", newMaterial:"New material",
    continue:"Continue", previous:"Previous", back:"Back", next:"Next", finish:"Finish", exitSession:"Exit session", play:"Play", stop:"Stop", restart:"restart",
    playAll:"Play page · read along", syncHint:"Each line lights up as it's read · tap any line to replay", pageOf:(a,b)=>`Page ${a} of ${b}`, previousPage:"Previous page", nextPage:"Next page",
    fullSourceAudio:"Full source audio", fullSourceRead:"Full-source read-aloud", audioUnsupported:"Audio not supported in this browser",
    audioLeft:(s)=>`${s} left`, audioTime:(a,b)=>`${a} / ${b}`,
    buildingTitle:"Building your lesson…",
    buildingSteps:["Reading your text…","Splitting it into sentences…","Translating each line…","Finding the key words…","Writing fresh examples…","Preparing your quiz…","Almost ready…"],
    buildingNote:"A real AI is translating your text and writing the lesson — this usually takes 20–40 seconds. Thanks for your patience!",
    loginTitle:"Learn any language through content you love", loginSub:"Paste a text, transcript, or article excerpt, and it becomes a complete guided learning session.",
    email:"Email", noPassword:"No password needed for this test build. Your learning stays on this device.",
    inputTitle:"Bring your material", inputSub:"Paste a short excerpt, or upload a .txt file. Best results: 1,000–3,000 characters with normal punctuation.",
    startTitle:"Choose how you'd like to learn today.", startSub:"Start with your own material, or let AI help you find something matched to your level and goals.",
    startMaterialTitle:"I already have learning material", startMaterialSub:"Turn my textbook, transcript or article into an AI lesson.", startMaterialAction:"Use my material",
    startFindTitle:"Help me find something to learn", startFindSub:"AI recommends learning materials based on my language, level and learning goals.", startFindAction:"Find material",
    findTitle:"Find something to learn", findSub:"Tell us what you are learning, and AI will recommend a few materials that fit your level and goal.",
    duration:"Full lesson time", interests:"Topics you like", generateMaterials:"Generate materials", generatingMaterials:"Finding good options…", chooseMaterial:"Choose one to study", useThisText:"Use this text", switchAnytime:"Pick any option below. You can switch before starting the lesson.",
    durationPlans:[
      {label:"10-15 min",icon:"🌱",length:"40-70 words",vocab:"~4-6 new words"},
      {label:"25-35 min",icon:"📗",length:"90-150 words",vocab:"~7-12 new words"},
      {label:"45-60 min",icon:"📘",length:"140-240 words",vocab:"~10-18 new words"},
    ],
    interestOptions:["Daily life","News","Culture","Travel","Work & study","Food","Technology","Society"],
    materialTipsTitle:"Need ideas?", materialTips:[
      {icon:"🎬",key:"YouTube",detail:"vlogs, explainers, street interviews",links:[
        {label:"Easy Dutch",url:"https://www.easy-languages.org/easy-dutch"},
        {label:"NOS op 3",url:"https://www.youtube.com/@nosop3"},
        {label:"Het Klokhuis",url:"https://www.youtube.com/@hetklokhuis"},
        {label:"Enzo Knol",url:"https://www.youtube.com/@EnzoKnol"},
      ]},
      {icon:"🎧",key:"Podcasts",detail:"natural speech with short excerpts",links:[
        {label:"Easy Dutch Podcast",url:"https://www.easydutch.fm/"},
        {label:"Echt Gebeurd",url:"https://echtgebeurd.net/"},
        {label:"Lang verhaal kort",url:"https://www.npo3fm.nl/podcasts/lang-verhaal-kort"},
      ]},
      {icon:"📰",key:"News",detail:"short, concrete Dutch stories",links:[
        {label:"NOS Jeugdjournaal",url:"https://jeugdjournaal.nl/"},
        {label:"NOS Nieuws",url:"https://nos.nl/"},
        {label:"NU.nl",url:"https://www.nu.nl/"},
      ]},
      {icon:"📄",key:"Your sources",detail:"material you already use",links:[
        {label:"Course notes",url:null},
        {label:"Transcript snippets",url:null},
        {label:"Emails or messages",url:null},
      ]},
    ],
    sourceHint:"Use a short excerpt you can study, not a full copyrighted work.",
    showIdeas:"Show ideas", hideIdeas:"Hide ideas",
    materialMeta:(mins,words,vocab)=>`~${mins} min full lesson · ${words} words · ~${vocab} possible new words`,
    yourText:"Your text", uploadTxt:"Upload .txt", textPlaceholder:"Paste an article, podcast transcript, newsletter excerpt, dialogue…",
    cleanNote:"Timestamps, noisy symbols, broken line breaks and spacing are lightly cleaned.", targetLanguage:"Target language *", select:"Select…",
    currentLevel:"Your current level", sessionGoal:"Session goal", overLimit:"Over the 1,200-character limit — split this into smaller chunks. Short sections usually learn better.",
    splitTitle:"This may be too much for one session", splitText:(mins)=>`This looks like a long text. For a focused lesson under 60 minutes, split it into a smaller excerpt.`,
    chooseTarget:"Choose your target language to continue.", analyzeText:"Analyze text",
    goals:["General fluency","Conversation & speaking","Reading comprehension","Vocabulary building","Exam preparation"],
    levels:["A1 — Beginner","A2 — Elementary","B1 — Intermediate","B2 — Upper-intermediate","C1 — Advanced"],
    previewTitle:"Here's your text", previewSub:"A quick read on your material before we begin.", topics:"Topics:", previewTextTitle:"Full text", previewTextHint:"Read it once before you start. Go back if you'd like a different text.",
    recommendedLevel:"Recommended level", estimatedTime:"Estimated time", vocabulary:"Vocabulary", characters:"Characters", chars:"chars",
    wordCount:(n)=>`${n} words`, diffLabels:["","Comfortable review","An easy read","Right at your level","A gentle stretch","Challenging"],
    difficultyForYou:"Difficulty for you", basedOnLevel:(a,b)=>`Based on your level (${a}) vs the text's (${b}).`,
    session:"The session", stepsInBlocks:(s,b)=>`${s} steps in ${b} blocks`, start:(m)=>`Start · ~${m} min`,
    planNames:["Learning","Grammar & Vocabulary","Practicing","Using"],
    planItems:[["Listen","Watch in your language"],["Sentence-by-sentence study"],["With subtitles","No subtitles","Recall from English"],["Write & talk with AI"]],
    heavy:(n)=>`This one has ${n} new words — quite a few. For it to really stick, try each block at least twice, and don't be shy about repeating an earlier step if it feels heavy.`,
    stepPhases:["Learning","Learning","Grammar & Vocabulary","Practicing","Practicing","Practicing","Using"],
    stepTitles:["Listen","Watch · your language","Grammar & Vocabulary","Practice · with subtitles","Practice · no subtitles","Recall from English","Practice with AI"],
    stepOf:(n,total)=>`Step ${n} of ${total}`, min:(m)=>`~${m} min`,
    lockedGrammar:"Work through each sentence to unlock Continue.", lockedRecall:"Try each recall prompt before continuing.", lockedAI:"Get feedback in Part 1 and finish the Part 2 chat to unlock Finish.",
    translatingTitle:"Translating the lines", lookingUpTitle:"Looking up word meanings", aboutRemaining:(s)=>`about ${s}s left`, lineTranslating:(i,n)=>`Translating line ${i} of ${n}`, translationUnavailable:"translation unavailable",
    lookingUpWord:"Finding the short meaning and a quick detail…", studyUsage:"Study how it's used here, then try it in your own example.",
    simpleMeaning:"Simple meaning", detail:"More detail", example:"Example",
    quizLoading:"Writing a few questions about your text…", whichHeard:"Which sentence did you hear?", whichMatches:"Which sentence matches the text?",
    niceRight:"Nice — that's right.", notQuite:"Not quite — the highlighted one is it. Try replaying above.",
    selfLow:"0% · nothing yet", selfHigh:"100% · all of it",
    sr:{teacher:"Trust your ears. Play each line, then choose the sentence you heard.",purpose:"This sharpens the bridge between sound and meaning, one small decision at a time.",check:"Nailing these? Great ear. A few tricky? Replay and try once more — no rush."},
    understand:{teacher:(lang)=>`One last full listen. Play it through with ${lang} text — it should feel clear now.`,purpose:"You have met the meaning, the sound, and the useful patterns. This pass helps everything settle together.",check:"Feels clearer than the first time? That's your progress showing."},
    timed:{title:(subs)=>`Practice · ${subs?"with subtitles":"no subtitles"}`,teacherSubs:"This is shadowing. Each sentence plays on its own — read along out loud at the same time, matching the voice's rhythm.",teacherNoSubs:"Shadowing, ears only. Each sentence plays on its own — repeat it out loud right after. Reveal the text only if you get stuck.",purpose:"Speaking along with the voice gives your mouth a path to follow, so the language starts to feel usable.",how:"How this works",tips:["Each sentence plays automatically — just start speaking along with the voice.","Use Play again or slow audio to echo it a few more times.","Move on with Next whenever you're ready — Back is always there too."],ready:"Start shadowing",breath:"Each line plays by itself — read along out loud, no buttons needed.",done:(n)=>`You shadowed all ${n} sentences. Press Continue when you're ready.`,again:"Shadow again",doneCheck:"Read each one out loud? That's exactly it. Another round never hurts.",shadow:"Read along out loud",listen:"Listen first",yourTurn:"Your turn — read aloud",hide:"Hide text",reveal:"Reveal text",replay:"Play again",slow:"Slow",next:"Next",finishRound:"Finish",startSpeaking:"Start speaking",pause:"Pause",resume:"Resume",skip:"Skip"},
    aiUse:{title:"Practice with AI",teacher:"Let's actually use it. First write a little, then have a short chat — all with today's words.",purpose:"This turns the lesson into something you can say back, gently and in context.",writeTab:"Part 1 · Write",chatTab:"Part 2 · Talk",unlock:"Finish unlocks once you've got feedback in Part 1 and completed the Part 2 chat.",feedback:"Get feedback",reading:"Reading…",teacherReading:"Your teacher is reading your writing…",checking:"Checking grammar, vocabulary and sentence flow — just a few seconds.",nextTalk:"Next · talk with the AI",writePlaceholder:(lang)=>`Write your answer in ${lang}…`,question:(topic,lang)=>`Based on the passage — "${topic}" — what's your view? Write 3–4 sentences in ${lang} using today's words.`,saved:(n)=>`${n} words · saved locally`,feedbackTitle:(sim)=>`Feedback & suggested revision${sim?" · simulated":""}`,grammar:"Grammar",vocab:"Vocabulary",sentence:"Sentence construction",revision:"Suggested revision",mockGrammar:"Tenses look consistent. Check subject–verb agreement in your longer sentence.",mockVocab:"Nice reuse of today's words — add one connective phrase to link ideas.",mockSentence:"Clear structure. Try varying sentence length to sound more natural.",mockNote:"Showing sample feedback — the live AI check didn't respond just now, so try again in a moment for specific notes and a corrected draft."},
    focus:{title:"Today's focus",teacher:"A few things are especially worth carrying through the lesson today.",vocab:"Top vocabulary",grammar:"Top grammar",level:"Level",loading:"Choosing today's focus…"},
    recall:{title:"Recall from English",teacher:"Now make your brain reach back for the Dutch. Read the English cue, then say or type the original idea before checking.",purpose:"This forces active output, so the text becomes something you can produce, not only recognize.",englishCue:"English cue",yourDutch:"Your Dutch",placeholder:"Type the Dutch you remember…",speak:"Speak",check:"Check original",original:"Original",tryFirst:"Say or type your answer first.",done:"You tried every recall prompt.",progress:(a,b)=>`Prompt ${a} of ${b}`},
    chat:{notice:(name,lang,n)=>`You're talking with ${name}, face to face, in ${lang}. ${name} speaks first — listen, then answer out loud or type. About ${n} exchanges.`,thinking:"thinking",speaking:"speaking",yourTurn:"listening — your turn",sayAgain:"Say it again",exchange:(n,total)=>`Exchange ${n} of ${total}`,listening:"Listening — tap when done",speakAnswer:"Hold the floor · speak your answer",speakIn:(lang)=>`Speak in ${lang}. Your words appear below — edit if you like, then reply.`,typeIn:(lang)=>`Type your reply in ${lang} below (voice input works in Chrome/Edge).`,placeholder:(lang)=>`Your reply in ${lang}…`,looksGood:"Looks good",shortSentence:"Say at least a short sentence",replyTo:(name)=>`Reply to ${name}`,showTranscript:"Show transcript",feedbackTitle:(sim)=>`Conversation feedback${sim?" · simulated":""}`,fluency:"Fluency",mockDone:(lang)=>`You held a voice exchange in ${lang} using today's words — exactly the goal.`},
    done:{friend:"friend",title:(name)=>`You did it, ${name}!`,sub:(n)=>`You stayed with it through all ${n} steps. Showing up and finishing is the hard part — and you just did.`,explored:(topics)=>`Today you explored ${topics}`,more:"Bring a few more texts and we'll start to see which topics you love most — and where you spend your time.",steps:"Steps",words:"Words",sentences:"Sentences",blocks:"Blocks",comp:"Your comprehension · before vs after",rate:"One more time — how much can you understand now?",reveal:"Reveal my progress",before:"Before",after:"After",gain:(d)=>`+${d}% understanding — look at you go!`,again:"A second pass will lift this — you've got it",take:"What you're taking with you",review:"Review this lesson",new:"Bring new material"},
    refTitle:"Research basis", refText:"This flow is based on the Delft Method: understand a meaningful text first, absorb frequent words and grammar in context, then move toward conversation.", refSources:"Sources: Montens & Sciarone, Nederlands voor buitenlanders: de Delftse methode; TU Delft Centre for Languages.",
    grammarFocus:["Verb position in main clauses","Useful tense patterns","Connectors and sentence flow"],
    listen:{teacher:"Let's just listen first. Play it once and let the sound wash over you — no need to catch every word.",purpose:"Your brain starts by noticing rhythm, familiar sounds, and the shape of the language before it has to explain anything.",player:"Complete material",sub:"Full audio · no subtitles",rate:"Before we dig in — how much can you understand right now?",check:"Caught the mood or a few words? Perfect — that's all we need here. We'll check your growth at the end."},
    watch:{teacher:"Now let's make sense of it. Play along and read the meaning in a language you already know.",purpose:"Meaning comes first here, so the text feels less like a puzzle and more like a story you can follow.",check:"Does the story make sense now? If a line still feels murky, tap it again — take your time."},
    read:{teacher:(lang)=>`Let's connect sound to spelling. Read along in ${lang} while you listen.`,purpose:"Seeing the words while hearing them helps your eyes and ears agree on what is happening.",check:"Following along comfortably? Lovely. If not, replay a line or two before we move on."},
    comp:{teacher:"Quick check — no pressure at all. Pick the sentence that matches what you read.",purpose:"A small check gives you a clear signal: either you are ready to go deeper, or one more listen will help.",check:"Got them? Wonderful. Missed one? Pop back to Listen & Read — that's exactly how it's meant to work."},
    gram:{title:"Under the microscope",teacher:"Let's slow right down — one sentence at a time. We'll unpack what matters here, like a teacher sitting beside you.",purpose:"You are learning patterns from your own text, so grammar stays connected to meaning instead of floating around as rules.",sentence:(i,n)=>`Sentence ${i} of ${n}`,grammarCoach:"Grammar to notice",grammarLoading:"Reading the sentence like a teacher…",wordOrder:"Word order",slow:"Take it slow — just this one sentence for now.",noWords:"No standout new words in this sentence — enjoy the breather.",summaryTitle:"Let's pull it together",summaryTeacher:"Great work going through each sentence. Here's everything in one place to lock it in.",allVocab:"All key vocabulary",patterns:"Grammar patterns you met",examples:"Examples",translation:"Translation",showExplanation:"Show explanation",hideExplanation:"Hide explanation",review:"Review from Sentence 1",summaryCheck:"Feeling shaky on a sentence? No problem — head back to Sentence 1 and walk through again. Repetition is the whole idea.",next:"Next sentence",previous:"Previous sentence",seeSummary:"See summary"},
    nav:{
      mods:{diag:"Diagnosis",learn:"Learning",shadow:"Shadowing",recall:"Recall",use:"Using"},
      steps:{d1:"Reading check",d2:"Blind listening",d3:"Diagnosis",l1:"Watch · your language",l2:"Under the microscope",s1:"Shadow · with subtitles",s2:"Shadow · no subtitles",r1:"Recall from English",u1:"Practice with AI"},
      ctx:"Your learning path", ctxSession:(lang,level)=>`${lang} · ${level}`, backHome:"Back to home", previewHint:"Preview of your path",
    },
    diagnosis:{
      readEyebrow:"Diagnosis · Step 1", readTitle:"How much can you read?",
      readTeacher:"Tap every word you already understand — honest is best.",
      readTextLbl:(lvl)=>`The text · ${lvl}`, readWordsLbl:"Words at your level +1", gradingWords:"Grading words by level…",
      readNote:"Reading coverage updates live — unchecked words are treated as unknown and highlighted later.", coverage:"Reading coverage",
      listenEyebrow:"Diagnosis · Step 2", listenTitle:"Listen",
      listenTeacher:"Let's just listen first. Play it once and let the sound wash over you — no need to catch every word.",
      listenPurpose:"Your brain starts by noticing rhythm and the shape of the language before it has to explain anything.",
      catch:"How much did you catch?", catchHint:"One tap. The bars show roughly how much you understood.",
      tiers:[{pct:"<60%",label:"Barely",desc:"A few familiar sounds"},{pct:"~75%",label:"The gist",desc:"Main idea, missed details"},{pct:"~90%",label:"Most of it",desc:"Clear, missed a few"},{pct:"100%",label:"All of it",desc:"Effortless"}],
      diagEyebrow:"Diagnosis · Step 3", diagTitle:"Your diagnosis",
      reading:"Reading", listening:"Listening", ofWords:"of words understood", byEar:(p)=>`caught ${p} by ear`, tapFirst:"Tap a listening result on the previous step first.",
      cases:{
        golden:{emoji:"✅",kicker:"Optimal flow",name:"Perfect match — golden flow zone",body:"Your vocabulary fits the text and your ear kept up — the i+1 sweet spot.",tip:"👉 Keep this level. Go straight to shadowing & speaking."},
        acoustic:{emoji:"🎧",kicker:"Acoustic gap",name:"You read it, but your ear lagged",body:"You understand the words on the page, but the sound moved faster than your ear.",tip:"👉 Keep the text — replay the audio and drill listening before speaking."},
        overload:{emoji:"🌊",kicker:"Overload",name:"A bit much for one pass",body:"Several words were new, so meaning had to fight through the unknowns.",tip:"👉 A shorter or simpler text would land better — aim for ~70% understood."},
        comfort:{emoji:"🚀",kicker:"Comfort zone",name:"Almost too easy",body:"You breezed through reading and listening — there's little new to stretch you here.",tip:"👉 Level up next time: pick something one step harder."},
      },
    },
    celebrate:{explored:(n)=>`Today you explored ${n} new words`},
  },
  zh:{
    interfaceLanguage:"界面语言", english:"English", chinese:"中文", languageNames:{Dutch:"荷兰语"}, clearLocalData:"清除本地数据", clearConfirm:"清除所有本地学习数据（草稿、笔记、评分和进度）？", newMaterial:"新材料",
    continue:"继续", previous:"上一步", back:"返回", next:"下一步", finish:"完成", exitSession:"退出学习", play:"播放", stop:"停止", restart:"重新开始",
    playAll:"播放本页 · 跟读", syncHint:"朗读时对应句子会高亮 · 点击任意句子可重播", pageOf:(a,b)=>`第 ${a} / ${b} 页`, previousPage:"上一页", nextPage:"下一页",
    fullSourceAudio:"完整原文音频", fullSourceRead:"完整朗读", audioUnsupported:"当前浏览器不支持音频",
    audioLeft:(s)=>`剩余 ${s}`, audioTime:(a,b)=>`${a} / ${b}`,
    buildingTitle:"正在生成你的课程…",
    buildingSteps:["读取文本…","切分句子…","逐句翻译…","寻找关键词…","生成新例句…","准备小测验…","快好了…"],
    buildingNote:"AI 正在翻译文本并生成课程，通常需要 20–40 秒。谢谢耐心等待！",
    loginTitle:"用你喜欢的内容学习任何语言", loginSub:"粘贴一段文本、字幕或文章节选，它会变成一节完整的引导式学习课。",
    email:"邮箱", noPassword:"这个测试版本不需要密码。学习记录只保存在这台设备上。",
    inputTitle:"导入你的材料", inputSub:"粘贴一小段文本，或上传 .txt 文件。建议使用 1,000–3,000 字符、标点正常的内容。",
    startTitle:"今天你想怎样开始学习？", startSub:"你可以用自己的材料开始，也可以让 AI 按水平和目标帮你找内容。",
    startMaterialTitle:"我已经有学习材料", startMaterialSub:"把教材、字幕或文章变成一节 AI 课程。", startMaterialAction:"使用我的材料",
    startFindTitle:"帮我找一段内容来学", startFindSub:"AI 会根据语言、水平和学习目标推荐材料。", startFindAction:"寻找材料",
    findTitle:"寻找学习材料", findSub:"告诉我们你在学什么，AI 会推荐适合你水平和目标的材料。",
    duration:"完整课程时长", interests:"感兴趣的话题", generateMaterials:"生成学习材料", generatingMaterials:"正在寻找合适内容…", chooseMaterial:"选择一段来学习", useThisText:"使用这段文本", switchAnytime:"在开始课程前，你可以在下面几段材料之间切换。",
    durationPlans:[
      {label:"10-15 分钟",icon:"🌱",length:"40-70 个词",vocab:"约 4-6 个生词"},
      {label:"25-35 分钟",icon:"📗",length:"90-150 个词",vocab:"约 7-12 个生词"},
      {label:"45-60 分钟",icon:"📘",length:"140-240 个词",vocab:"约 10-18 个生词"},
    ],
    interestOptions:["日常生活","新闻","文化","旅行","工作与学习","食物","科技","社会"],
    materialTipsTitle:"找材料灵感", materialTips:[
      {icon:"🎬",key:"YouTube",detail:"vlog、解释类视频、街访",links:[
        {label:"Easy Dutch",url:"https://www.easy-languages.org/easy-dutch"},
        {label:"NOS op 3",url:"https://www.youtube.com/@nosop3"},
        {label:"Het Klokhuis",url:"https://www.youtube.com/@hetklokhuis"},
        {label:"Enzo Knol",url:"https://www.youtube.com/@EnzoKnol"},
      ]},
      {icon:"🎧",key:"Podcast",detail:"自然语速，适合截取短段落",links:[
        {label:"Easy Dutch Podcast",url:"https://www.easydutch.fm/"},
        {label:"Echt Gebeurd",url:"https://echtgebeurd.net/"},
        {label:"Lang verhaal kort",url:"https://www.npo3fm.nl/podcasts/lang-verhaal-kort"},
      ]},
      {icon:"📰",key:"新闻",detail:"短、具体、主题清楚",links:[
        {label:"NOS Jeugdjournaal",url:"https://jeugdjournaal.nl/"},
        {label:"NOS Nieuws",url:"https://nos.nl/"},
        {label:"NU.nl",url:"https://www.nu.nl/"},
      ]},
      {icon:"📄",key:"自己的材料",detail:"你已经在看的内容",links:[
        {label:"课堂笔记",url:null},
        {label:"字幕片段",url:null},
        {label:"邮件或聊天记录",url:null},
      ]},
    ],
    sourceHint:"只粘贴你可以学习使用的短节选，不要整篇搬运受版权保护的内容。",
    showIdeas:"展开灵感", hideIdeas:"收起灵感",
    materialMeta:(mins,words,vocab)=>`约 ${mins} 分钟完整课程 · ${words} 个词 · 约 ${vocab} 个可能生词`,
    yourText:"你的文本", uploadTxt:"上传 .txt", textPlaceholder:"粘贴文章、播客字幕、 newsletter 节选、对话…",
    cleanNote:"时间戳、乱码符号、断行和多余空格会被轻量清理。", targetLanguage:"目标语言 *", select:"请选择…",
    currentLevel:"当前水平", sessionGoal:"学习目标", overLimit:"超过 1,200 字符限制。建议拆成小段学习，效果会更好。",
    splitTitle:"这段可能不适合一次学完", splitText:(mins)=>`这段文本偏长。为了把单次学习控制在 60 分钟以内，建议先截取更小的一段。`,
    chooseTarget:"请选择目标语言后继续。", analyzeText:"分析文本",
    goals:["综合流利度","对话与口语","阅读理解","词汇积累","考试准备"],
    levels:["A1 — 入门","A2 — 初级","B1 — 中级","B2 — 中高级","C1 — 高级"],
    previewTitle:"这是你的文本概览", previewSub:"开始前先快速了解这份材料。", topics:"主题：", previewTextTitle:"完整文本", previewTextHint:"开始前先通读一遍。如果想换一段，可以返回。",
    recommendedLevel:"推荐水平", estimatedTime:"预计时间", vocabulary:"词汇", characters:"字符数", chars:"字符",
    wordCount:(n)=>`${n} 个词`, diffLabels:["","舒适复习","比较轻松","正适合你","温和挑战","有挑战"],
    difficultyForYou:"对你的难度", basedOnLevel:(a,b)=>`基于你的水平（${a}）和文本水平（${b}）估算。`,
    session:"学习流程", stepsInBlocks:(s,b)=>`${s} 个步骤，分成 ${b} 个模块`, start:(m)=>`开始 · 约 ${m} 分钟`,
    planNames:["学习","语法与词汇","练习","使用"],
    planItems:[["听一遍","看懂意思"],["逐句学习"],["带字幕练习","无字幕练习","英文提示回忆原文"],["和 AI 写作/对话"]],
    heavy:(n)=>`这篇材料有 ${n} 个新词，数量不少。为了真正记住，建议每个模块至少练两遍；觉得吃力时可以随时回到前面的步骤。`,
    stepPhases:["学习","学习","语法与词汇","练习","练习","练习","使用"],
    stepTitles:["听一遍","看懂意思","语法与词汇","带字幕练习","无字幕练习","英文提示回忆","和 AI 练习"],
    stepOf:(n,total)=>`第 ${n} / ${total} 步`, min:(m)=>`约 ${m} 分钟`,
    lockedGrammar:"完成逐句学习后才能继续。", lockedRecall:"请先尝试每个回忆提示再继续。", lockedAI:"完成 Part 1 反馈和 Part 2 对话后才能结束。",
    translatingTitle:"正在翻译句子", lookingUpTitle:"正在查询单词含义", aboutRemaining:(s)=>`预计还需 ${s} 秒`, lineTranslating:(i,n)=>`正在翻译第 ${i} / ${n} 句`, translationUnavailable:"暂时没有翻译",
    lookingUpWord:"正在生成简短释义和补充说明…", studyUsage:"先看它在句子里的用法，再试着自己造句。",
    simpleMeaning:"简单意思", detail:"详细说明", example:"例句",
    quizLoading:"正在根据文本生成几个问题…", whichHeard:"你听到的是哪一句？", whichMatches:"哪一句符合文本意思？",
    niceRight:"答对了，很好。", notQuite:"还差一点，高亮的是正确答案。可以重播后再试。",
    selfLow:"0% · 还不太懂", selfHigh:"100% · 全部理解",
    sr:{teacher:"相信你的耳朵。播放每一句，然后选择你听到的句子。",purpose:"这个小判断会把声音和意思连起来，一次只练一个清晰选择。",check:"做得顺的话很好；如果有几句难，重播再试一次，不急。"},
    understand:{teacher:(lang)=>`最后完整听一遍。配合 ${lang} 原文播放，现在应该清楚很多。`,purpose:"你已经见过意思、声音和常用结构了。最后这一遍会帮它们自然合在一起。",check:"比第一次清楚了吗？这就是你的进步。"},
    timed:{title:(subs)=>`练习 · ${subs?"带字幕":"无字幕"}`,teacherSubs:"这是影子跟读。每句话会自动播放——同时跟着大声读出来，尽量贴合语音的节奏。",teacherNoSubs:"影子跟读，只用耳朵。每句话会自动播放——听完立刻大声复述。卡住时再显示文本。",purpose:"跟着语音一起说，会给嘴巴一条可循的路，语言会慢慢变成你能说出口的东西。",how:"练习方式",tips:["每句话会自动播放——直接跟着语音一起开口。","可以用“再播放”或慢速多跟读几遍。","准备好了就点“下一句”；“返回”也一直可用。"],ready:"开始跟读",breath:"每句话会自动播放——跟着大声读就行，不用点按钮。",done:(n)=>`你已经跟读完 ${n} 个句子。准备好后点继续。`,again:"再跟读一遍",doneCheck:"每一句都大声读出来了吗？就是这样。多来一轮也很好。",shadow:"跟着大声读",listen:"先听",yourTurn:"轮到你 · 读出来",hide:"隐藏文本",reveal:"显示文本",replay:"再播放",slow:"慢速",next:"下一句",finishRound:"完成",startSpeaking:"开始朗读",pause:"暂停",resume:"继续",skip:"跳过"},
    aiUse:{title:"和 AI 练习",teacher:"现在真正用起来。先写一点，再进行一段短对话，尽量用今天的词。",purpose:"这一步把课程变成你能回应、能表达的内容，轻一点，但要真的开口。",writeTab:"Part 1 · 写作",chatTab:"Part 2 · 对话",unlock:"完成 Part 1 反馈和 Part 2 对话后，就可以结束课程。",feedback:"获取反馈",reading:"阅读中…",teacherReading:"老师正在阅读你的写作…",checking:"正在检查语法、词汇和句子流畅度，几秒钟就好。",nextTalk:"下一步 · 和 AI 对话",writePlaceholder:(lang)=>`用 ${lang} 写下你的回答…`,question:(topic,lang)=>`根据这段材料 “${topic}”，你怎么看？请用 ${lang} 写 3–4 句，并尽量用今天的词。`,saved:(n)=>`${n} 个词 · 已本地保存`,feedbackTitle:(sim)=>`反馈和建议修改${sim?" · 模拟":""}`,grammar:"语法",vocab:"词汇",sentence:"句子结构",revision:"建议修改",mockGrammar:"时态整体一致。较长句子里可以再检查主语和动词是否对应。",mockVocab:"今天的词用得不错，可以再加一个连接短语让意思更连贯。",mockSentence:"结构清楚。试着变化一下句子长度，会更自然。",mockNote:"正在显示示例反馈；实时 AI 刚才没有响应，稍后可再试一次获得更具体的修改。"},
    focus:{title:"今日重点",teacher:"今天有几处特别值得一路带着学。",vocab:"重点词汇",grammar:"重点语法",level:"等级",loading:"正在提炼今日重点…"},
    recall:{title:"英文提示回忆",teacher:"现在让大脑主动把荷兰语找回来。先看英文提示，然后说出或写出原文意思，再查看答案。",purpose:"这一步会强迫主动输出，让文本不只是能看懂，也能说出来。",englishCue:"英文提示",yourDutch:"你的荷兰语",placeholder:"写下你记得的荷兰语…",speak:"语音输入",check:"查看原文",original:"原文",tryFirst:"请先说出或写下你的答案。",done:"每个回忆提示都尝试过了。",progress:(a,b)=>`第 ${a} / ${b} 题`},
    chat:{notice:(name,lang,n)=>`你正在和 ${name} 面对面用 ${lang} 对话。${name} 会先说，听完后你可以开口回答，也可以打字。大约 ${n} 轮。`,thinking:"思考中",speaking:"正在说话",yourTurn:"正在听你说",sayAgain:"再说一遍",exchange:(n,total)=>`第 ${n} / ${total} 轮`,listening:"正在听 · 说完后点击",speakAnswer:"轮到你 · 说出回答",speakIn:(lang)=>`请用 ${lang} 说。你的话会出现在下面，可以修改后再发送。`,typeIn:(lang)=>`请在下面用 ${lang} 打字回复（Chrome/Edge 支持语音输入）。`,placeholder:(lang)=>`用 ${lang} 回复…`,looksGood:"看起来不错",shortSentence:"至少说一个短句",replyTo:(name)=>`回复 ${name}`,showTranscript:"显示对话记录",feedbackTitle:(sim)=>`对话反馈${sim?" · 模拟":""}`,fluency:"流利度",mockDone:(lang)=>`你已经用 ${lang} 完成了一段语音交流，并且用到了今天的词，这正是目标。`},
    done:{friend:"同学",title:(name)=>`${name}，你完成了！`,sub:(n)=>`你完整走完了 ${n} 个学习步骤。真正难的是开始并坚持到最后，而你已经做到了。`,explored:(topics)=>`今天你学习了 ${topics}`,more:"多带几段文本来，我们会慢慢看出你喜欢哪些主题、常在哪些地方投入时间。",steps:"步骤",words:"词汇",sentences:"句子",blocks:"模块",comp:"理解度 · 前后对比",rate:"最后再问一次：现在你大概能理解多少？",reveal:"查看我的进步",before:"之前",after:"之后",gain:(d)=>`理解度 +${d}% ，很漂亮`,again:"再来一遍会继续提升，你已经在路上了",take:"你带走的内容",review:"复习这节课",new:"导入新材料"},
    refTitle:"研究依据", refText:"这套流程基于 Delft Method：先理解一段有意义的文本，再在上下文里吸收高频词和语法，最后过渡到真实表达。", refSources:"来源：Montens & Sciarone《Nederlands voor buitenlanders: de Delftse methode》；TU Delft Centre for Languages。",
    grammarFocus:["主句里的动词位置","文本里的常见时态","连接词和句子衔接"],
    listen:{teacher:"先只听一遍。播放后让声音自然进入耳朵，不需要每个词都听懂。",purpose:"大脑会先捕捉节奏、熟悉的声音和语言轮廓，不必马上解释每个细节。",player:"完整材料",sub:"完整音频 · 无字幕",rate:"正式学习前，你现在大概能理解多少？",check:"听出了大意或几个词就很好。最后我们会再对比一次你的进步。"},
    watch:{teacher:"现在先把意思看懂。边播放边读你已经熟悉的语言里的含义。",purpose:"先有意思，文本就不再像谜题，而更像一段你能跟上的故事。",check:"现在故事更清楚了吗？如果某一句还模糊，点它再听一次，慢慢来。"},
    read:{teacher:(lang)=>`把声音和拼写连起来。听的时候一起阅读 ${lang} 原文。`,purpose:"同时听到和看到单词，会更容易记住。",check:"能跟上了吗？如果还不稳，先重播一两句再继续。"},
    comp:{teacher:"快速检查一下，没有压力。选择和文本意思相符的句子。",purpose:"一个小检查会给你清楚的信号：可以继续深入，或者先多听一遍。",check:"完成了吗？很好。错了一题也没关系，回到“听读结合”再过一遍就对了。"},
    gram:{title:"逐句拆解",teacher:"我们放慢速度，一次只看一句。只拆这句里真正值得注意的地方，像老师坐在旁边。",purpose:"你会从自己的文本里学结构，所以语法不会漂在空中，而是一直连着意思。",sentence:(i,n)=>`第 ${i} / ${n} 句`,grammarCoach:"这句的语法重点",grammarLoading:"正在像老师一样读这句话…",wordOrder:"语序",slow:"慢慢来，现在只专注这一句。",noWords:"这一句没有特别突出的新词，轻松一下。",summaryTitle:"整理一下",summaryTeacher:"逐句学完了，很棒。这里把重点放在一起，帮助你巩固。",allVocab:"全部重点词汇",patterns:"遇到的语法模式",examples:"例句",translation:"翻译",showExplanation:"展开解释",hideExplanation:"收起解释",review:"从第 1 句复习",summaryCheck:"如果某一句还不稳，回到第 1 句再走一遍。重复本来就是学习的一部分。",next:"下一句",previous:"上一句",seeSummary:"查看总结"},
    nav:{
      mods:{diag:"诊断",learn:"学习",shadow:"跟读",recall:"回忆",use:"使用"},
      steps:{d1:"阅读检测",d2:"盲听",d3:"诊断",l1:"看懂意思",l2:"逐句拆解",s1:"带字幕跟读",s2:"无字幕跟读",r1:"英文提示回忆",u1:"和 AI 练习"},
      ctx:"你的学习路径", ctxSession:(lang,level)=>`${lang} · ${level}`, backHome:"返回首页", previewHint:"路径预览",
    },
    diagnosis:{
      readEyebrow:"诊断 · 第 1 步", readTitle:"你能读懂多少？",
      readTeacher:"把你已经认识的词都点一下——诚实最好。",
      readTextLbl:(lvl)=>`文本 · ${lvl}`, readWordsLbl:"你水平 +1 的词", gradingWords:"正在按等级给词打分…",
      readNote:"阅读理解度会实时更新——没点的词会被当作生词，之后重点高亮。", coverage:"阅读理解度",
      listenEyebrow:"诊断 · 第 2 步", listenTitle:"听一遍",
      listenTeacher:"先只听一遍。播放一次，让声音自然进入耳朵，不用每个词都听懂。",
      listenPurpose:"大脑会先捕捉节奏和语言的轮廓，然后才需要解释含义。",
      catch:"你听懂了多少？", catchHint:"点一下就好。信号条大致表示你听懂的比例。",
      tiers:[{pct:"<60%",label:"几乎听不懂",desc:"只有几个熟悉的音"},{pct:"~75%",label:"抓住大意",desc:"懂主旨，漏了细节"},{pct:"~90%",label:"大部分",desc:"清楚，漏了几个"},{pct:"100%",label:"全部",desc:"毫不费力"}],
      diagEyebrow:"诊断 · 第 3 步", diagTitle:"你的诊断",
      reading:"阅读", listening:"听力", ofWords:"的词能读懂", byEar:(p)=>`听力约 ${p}`, tapFirst:"请先在上一步点选一个听力结果。",
      cases:{
        golden:{emoji:"✅",kicker:"最佳区间",name:"完美匹配——黄金流畅区",body:"你的词汇量与文本相符，耳朵也跟得上——正是 i+1 的甜蜜点。",tip:"👉 保持这个难度，直接进入跟读与口语。"},
        acoustic:{emoji:"🎧",kicker:"听力缺口",name:"能读懂，但耳朵慢半拍",body:"纸面上的词你都懂，但声音比你的耳朵快。",tip:"👉 保留文本——先重播音频、加练听力再开口。"},
        overload:{emoji:"🌊",kicker:"信息过载",name:"一次有点太多了",body:"生词偏多，意思得从未知里挤出来。",tip:"👉 换更短或更简单的文本会更合适——目标约 70% 理解。"},
        comfort:{emoji:"🚀",kicker:"舒适区",name:"有点太简单了",body:"阅读和听力都很轻松——这里没什么能拉伸你的新东西。",tip:"👉 下次升级：选难一档的内容。"},
      },
    },
    celebrate:{explored:(n)=>`今天你学了 ${n} 个新词`},
  }
};
const UIContext=createContext({uiLang:"en",setUiLang:()=>{},t:UI_TEXT.en});
function useUI(){ return useContext(UIContext); }
function langName(t,lang){ return (t.languageNames&&t.languageNames[lang])||lang; }
function useElapsed(active){
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{ if(!active){ setElapsed(0); return; } const t=setInterval(()=>setElapsed(s=>s+1),1000); return ()=>clearInterval(t); },[active]);
  return elapsed;
}
function progressPct(elapsed,estimate){ return Math.min(92,Math.max(12,Math.round((elapsed/Math.max(1,estimate))*100))); }
function fmtTime(sec){
  const s=Math.max(0,Math.round(sec||0)); const m=Math.floor(s/60); const r=String(s%60).padStart(2,"0");
  return `${m}:${r}`;
}
function scrollToTop(){
  if(typeof window==="undefined") return;
  requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:"auto"}));
}
function durationSpec(label){
  const nums=String(label||"").match(/\d+/g)?.map(Number)||[];
  // Full-lesson time is capped at 60 min, so no tier can exceed it.
  const min=Math.min(60,nums[0]||45), max=Math.min(60,nums[1]||min);
  let words=[140,240], vocab=[10,18];
  if(max<=15){ words=[40,70]; vocab=[4,6]; }
  else if(max<=35){ words=[90,150]; vocab=[7,12]; }
  return {min,max,target:Math.round((min+max)/2),words,vocab,label:`${min}-${max}`};
}
function clampToDuration(mins,label){
  const spec=durationSpec(label);
  return Math.max(spec.min,Math.min(spec.max,mins||spec.target));
}
function estimateAudioSeconds(text,rate=1){
  const wc=words(text||"").length;
  return Math.max(8,Math.round((wc/1.9)/(rate||1)));
}
function stableHash(input){
  const s=typeof input==="string"?input:JSON.stringify(input);
  let h=2166136261;
  for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
  return (h>>>0).toString(36);
}
function normalizePoint(s){ return String(s||"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim(); }
function hasCjk(s){ return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(String(s||"")); }
function safeDutchMaterial(m){
  if(!m||!m.text) return false;
  return !hasCjk(m.title)&&!hasCjk(m.text);
}
function meaningParts(e){
  if(!e) return {simple:null,detail:null};
  const raw=(e.meaning||"").trim();
  const simple=(e.simpleMeaning||e.simple||"").trim() || raw.split(/[—:.;,]/)[0].split(/\s+/).slice(0,3).join(" ");
  const detail=(e.detail||e.explanation||"").trim() || (raw && raw!==simple ? raw : "");
  return {simple:simple||null,detail:detail||null};
}
function grammarExamples(g){
  if(!g) return [];
  if(Array.isArray(g.examples)) return g.examples.map(x=>typeof x==="string"?{sentence:x,translation:""}:x).filter(x=>x&&x.sentence).slice(0,3);
  if(g.example) return [{sentence:g.example,translation:g.translation||""}];
  return [];
}
function compactQuote(s,max=92){
  const clean=String(s||"").replace(/\s+/g," ").trim();
  return clean.length>max ? clean.slice(0,max).replace(/\s+\S*$/,"")+"…" : clean;
}
function practiceQuestion(lesson,shownLang,uiLang){
  const sents=lesson.sents||[];
  const anchor=compactQuote(sents[Math.min(1,Math.max(0,sents.length-1))]||sents[0]||lesson.topics?.[0]||"the text",110);
  const focusWords=(lesson.focus&&Array.isArray(lesson.focus.vocab)?lesson.focus.vocab.map(x=>x.word).filter(Boolean):[]);
  const v=(focusWords.length?focusWords:(lesson.vocab||[]).map(x=>x.word)).slice(0,3).join(", ");
  const easy=levelIdx(lesson.level)<=1;
  if(uiLang==="zh"){
    return easy
      ? `围绕这句 “${anchor}”，用 ${shownLang} 写 2–3 个短句：发生了什么？你会怎么回应？${v?`尽量用到：${v}。`:""}`
      : `围绕文本里的这个重点 “${anchor}”，用 ${shownLang} 写 3–5 句：先概括发生了什么，再说你的看法或类似经历。${v?`尽量自然用到：${v}。`:""}`;
  }
  return easy
    ? `Use this part of the text — “${anchor}”. Write 2–3 short sentences in ${shownLang}: what happens, and how would you respond?${v?` Try to use: ${v}.`:""}`
    : `Use this moment from the text — “${anchor}”. Write 3–5 sentences in ${shownLang}: first explain what happens, then add your opinion or a similar experience.${v?` Try to reuse: ${v}.`:""}`;
}

const LANG_CODE={Dutch:"nl-NL"};
// A friendly conversation partner per language — gives the chat a human face.
const PARTNER={Spanish:{name:"Lucía",face:"👩🏻"},French:{name:"Camille",face:"👩🏼"},German:{name:"Lena",face:"👩🏼"},
  Italian:{name:"Giulia",face:"👩🏻"},Portuguese:{name:"Sofia",face:"👩🏽"},Dutch:{name:"Sanne",face:"👩🏼"},
  Japanese:{name:"Yuki",face:"🧑🏻"},Korean:{name:"Minji",face:"👩🏻"},"Mandarin Chinese":{name:"Mei",face:"👩🏻"},
  Arabic:{name:"Layla",face:"🧕🏽"},Russian:{name:"Anna",face:"👩🏼"},English:{name:"Alex",face:"🧑🏼"},_:{name:"your partner",face:"🧑"}};
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
function sampleMaterials(lang,level,goal,duration,topics){
  const topic=(topics&&topics[0])||"daily life";
  if(lang==="Dutch") return [
    {title:"Een rustige ochtend in de stad",source:"Daily story",level:level.slice(0,2),text:"Elke ochtend fietst Noor langs de gracht naar haar werk. Vandaag is de lucht helder en de stad voelt langzaam wakker. Bij de bakker koopt ze een klein broodje en praat ze kort met de man achter de toonbank. Hij vertelt dat het drukker wordt sinds de zon weer schijnt. Noor glimlacht, stapt op haar fiets en merkt dat ze deze gewone ochtend eigenlijk heel fijn vindt."},
    {title:"Waarom steeds meer mensen de trein nemen",source:"Short news explainer",level:levelIdx(level)<=1?"B1":level.slice(0,2),text:"In Nederland kiezen steeds meer mensen voor de trein als ze naar een andere stad reizen. De reis is vaak rustig, en reizigers kunnen onderweg lezen, werken of naar muziek luisteren. Toch zijn er ook klachten: soms zijn treinen vol of te laat. Volgens vervoersbedrijven blijft de trein belangrijk, vooral voor mensen die duurzamer willen reizen."},
    {title:"Een gesprek over weekendplannen",source:"Dialogue",level:level.slice(0,2),text:"Sanne: Wat ga jij dit weekend doen?\nAmir: Ik wil naar een markt in Utrecht, omdat ik nieuwe kazen wil proeven en misschien een cadeau zoek voor mijn zus.\nSanne: Dat klinkt gezellig. Zullen we samen gaan?\nAmir: Goed idee. We spreken af bij het station en drinken daarna ergens koffie."},
  ];
  if(lang==="Japanese") return [
    {title:"朝の電車",source:"Daily story",text:"毎朝、ゆきは電車で学校へ行きます。今日は少し雨が降っていますが、駅はとてもにぎやかです。電車の中で、ゆきは短いニュースを読みます。となりの人は静かに音楽を聞いています。学校に着くころには、雨が止んで、空が少し明るくなりました。"},
    {title:"週末の予定",source:"Dialogue",text:"金曜日の午後、たけしは友だちに週末の予定を聞きました。友だちは新しいカフェに行きたいと言いました。そのカフェは駅の近くにあって、抹茶のケーキが有名です。二人は土曜日の午後に会うことにしました。"},
    {title:"小さなニュース",source:"Short news explainer",text:"最近、町の図書館を使う人が増えています。学生だけでなく、仕事をしている人や親子も来ます。図書館では本を読むだけではなく、勉強したり、イベントに参加したりできます。静かな場所で時間を過ごしたい人に人気があります。"},
  ];
  return [
    {title:`A simple ${lang} story about ${topic}`,source:"Daily story",text:`This is a short learning text for a ${level} learner of ${lang}. It is about ${topic}. The sentences are simple, practical, and useful for ${goal}. Use this as a placeholder material when live AI recommendations are unavailable.`},
    {title:`A short ${lang} dialogue`,source:"Dialogue",text:`Two people talk about ${topic} in clear ${lang}. One person asks a simple question, and the other answers with everyday words. The text is designed for a ${duration} study session.`},
    {title:`A mini ${lang} explainer`,source:"Explainer",text:`This short text explains one idea about ${topic} in learner-friendly ${lang}. It uses clear sentences and a few repeated words so you can listen, read, and practise speaking.`},
  ];
}
const TTS_OK=typeof window!=="undefined" && "speechSynthesis" in window;
// High-quality AI voice via /api/tts, with the browser voice as fallback.
// ttsMode caches the outcome so we don't re-probe the API on every click.
let ttsMode=null;            // null=unknown, "api", "browser"
let ttsFailStreak=0;         // consecutive API failures; we only fall back permanently after several
let activeHandle=null;
function browserSpeak(handle,text,lang,rate){
  if(!("speechSynthesis" in window)){ if(handle.onend)handle.onend(); return; }
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance((text||"").slice(0,4500)); u.lang=LANG_CODE[lang]||"en-US"; u.rate=rate;
  u.onend=()=>{ if(!handle._cancelled&&handle.onend)handle.onend(); };
  handle._synth=true; window.speechSynthesis.speak(u);
}
// ---- audio cache: never pay twice for the same clip ----
const audioMem = (typeof window!=="undefined") ? new Map() : null; // key -> objectURL (this session)
const IDB={
  open(){ return new Promise((res,rej)=>{ if(typeof indexedDB==="undefined") return rej(); const r=indexedDB.open("lingua-audio",1);
    r.onupgradeneeded=()=>r.result.createObjectStore("clips"); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  async get(k){ try{ const db=await this.open(); return await new Promise(res=>{ const q=db.transaction("clips","readonly").objectStore("clips").get(k); q.onsuccess=()=>res(q.result||null); q.onerror=()=>res(null); }); }catch(e){ return null; } },
  async put(k,blob){ try{ const db=await this.open(); db.transaction("clips","readwrite").objectStore("clips").put(blob,k); }catch(e){} },
};
function cacheKey(text,lang,rate,voiceRole){ return lang+"|"+rate+"|"+(voiceRole||"default")+"|"+(text||"").slice(0,4000); }
function playUrl(handle,url){ if(handle._cancelled) return; const a=new Audio(url); handle._audio=a;
  a.onloadedmetadata=()=>{ if(!handle._cancelled&&isFinite(a.duration)&&handle.onmeta)handle.onmeta(a.duration); };
  a.ontimeupdate=()=>{ if(!handle._cancelled&&handle.onprogress)handle.onprogress(a.currentTime,a.duration); };
  a.onended=()=>{ if(!handle._cancelled&&handle.onend)handle.onend(); }; a.play().catch(()=>{}); }

// Fetch one clip from the high-quality API, retrying once on a transient failure.
async function fetchTTSBlob(text,lang,rate,voiceRole,tries=2){
  for(let i=0;i<tries;i++){
    try{
      const res=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:(text||"").slice(0,4000),lang,rate,voiceRole})});
      if(res.ok && (res.headers.get("content-type")||"").includes("audio")) return await res.blob();
    }catch(e){ /* retry */ }
  }
  return null;
}
function speak(text,lang,rate=1,voiceRole){
  stopSpeak();
  const handle={_cancelled:false,onend:null};
  activeHandle=handle;
  // Only give up on the high-quality voice after several consecutive API failures,
  // so one transient hiccup on a long line never swaps the whole session to the
  // lower-quality browser voice (which is what made words and passages sound different).
  if(ttsMode==="browser"){ browserSpeak(handle,text,lang,rate); return handle; }
  const key=cacheKey(text,lang,rate,voiceRole);
  (async()=>{
    // 1) in-memory cache (this session) — free & instant
    let url=audioMem && audioMem.get(key);
    // 2) IndexedDB cache (persists across reloads) — free
    if(!url){ const blob=await IDB.get(key); if(blob){ url=URL.createObjectURL(blob); audioMem&&audioMem.set(key,url); } }
    if(url){ ttsMode="api"; ttsFailStreak=0; playUrl(handle,url); return; }
    // 3) not cached → call the API (the ONLY path that costs money)
    const blob=await fetchTTSBlob(text,lang,rate,voiceRole,2);
    if(handle._cancelled) return;
    if(blob){
      ttsMode="api"; ttsFailStreak=0;
      IDB.put(key,blob);                                   // save for next time
      const u2=URL.createObjectURL(blob); audioMem&&audioMem.set(key,u2);
      playUrl(handle,u2);
      return;
    }
    // This clip failed — use the browser voice just for this play. Latch to the
    // browser voice only if the API keeps failing (e.g. no key configured).
    if(++ttsFailStreak>=3) ttsMode="browser";
    if(!handle._cancelled) browserSpeak(handle,text,lang,rate);
  })();
  return handle;
}
function stopSpeak(){
  if(activeHandle){ activeHandle._cancelled=true; if(activeHandle._audio){ try{activeHandle._audio.pause();}catch(e){} } activeHandle=null; }
  if(typeof window!=="undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

const REPORTING_LABEL_WORDS=new Set("de het een bij op in aan naar van voor met zonder door hij zij ze ik we wij jij je zegt zei vragen vraagt vroeg antwoordt antwoordde koopt geeft gaat komt staat loopt wil wilt kan kunt moet mag heeft heb betaal betaalt".split(" "));
const ROLE_LABELS=new Set("man vrouw meneer mevrouw jongen meisje klant verkoper verkoopster kassier kassière caissière receptionist receptioniste ober serveerster docent leraar lerares teacher cashier customer".split(" "));
function speakerKey(line){
  const m=String(line||"").match(/^\s*([\p{Lu}][\p{L}'-]{1,24}(?:\s+[\p{Lu}][\p{L}'-]{1,24}){0,2}|[\p{Lu}][\p{L}'-]{1,24}):\s+/u);
  if(!m) return null;
  const label=m[1].trim();
  const lower=label.toLowerCase();
  const parts=lower.split(/\s+/);
  const rawParts=label.split(/\s+/);
  if(parts.some(w=>REPORTING_LABEL_WORDS.has(w)) && !ROLE_LABELS.has(lower)) return null;
  if(parts.length>1 && !rawParts.every(w=>/^\p{Lu}/u.test(w)) && !ROLE_LABELS.has(lower)) return null;
  return lower;
}
function isDashTurn(line){ return /^\s*[-–—]\s+\S/.test(String(line||"")); }
function spokenTextForLine(line){
  const s=String(line||"");
  const key=speakerKey(s);
  return (key?s.replace(/^\s*[\p{L}][\p{L} .'-]{0,40}:\s+/u,""):s).replace(/^\s*[-–—]\s+/,"").trim() || s;
}
function itemText(item){ return typeof item==="string" ? item : (item&&item.s)||""; }
function dialogueLike(items){
  const lines=(items||[]).map(itemText).filter(Boolean);
  const labelled=lines.filter(speakerKey);
  if(labelled.length>=2) return true;
  return lines.filter(isDashTurn).length>=2;
}
const FEMALE_NAMES=new Set("sanne lisa eva noor anna sophie sofia sara emma julia julie lotte femke anne anouk marieke lieke fleur kim inez ines lucia camille lena giulia layla mei minji yuki".split(" "));
const MALE_NAMES=new Set("amir mark jan peter pieter tom thomas lucas luuk sem tim bas daan bram jasper niels jeroen koen sam max takashi".split(" "));
function genderForSpeaker(name,line){
  const key=String(name||"").toLowerCase().split(/\s+/)[0];
  if(FEMALE_NAMES.has(key)) return "female";
  if(MALE_NAMES.has(key)) return "male";
  const s=String(line||"").toLowerCase();
  if(/\b(hij|zijn|meneer|vader|broer|man|jongen|opa|oom)\b/.test(s)) return "male";
  if(/\b(zij|ze|haar|mevrouw|moeder|zus|vrouw|meisje|oma|tante)\b/.test(s)) return "female";
  return null;
}
function voiceRoleForLine(line,index,items=[]){
  const lines=(items||[]).map(itemText).filter(Boolean);
  if(!dialogueLike(lines)) return undefined;
  const names=[...new Set(lines.map(speakerKey).filter(Boolean))];
  const key=speakerKey(line);
  if(names.length){
    const gender=genderForSpeaker(key,line);
    if(gender) return gender;
    const pos=key ? Math.max(0,names.indexOf(key)) : index;
    return pos%2===0 ? "female" : "male";
  }
  return index%2===0 ? "female" : "male";
}
function dialogueSegments(text){
  const normalized=String(text||"").replace(/\r/g,"\n").replace(/\s+(?=[\p{Lu}][\p{L}'-]{1,24}(?:\s+[\p{Lu}][\p{L}'-]{1,24}){0,2}:\s+)/gu,"\n");
  const lines=normalized.split(/\n+/).map(s=>s.trim()).filter(Boolean);
  if(!dialogueLike(lines)) return [];
  return lines.map((line,i)=>({text:spokenTextForLine(line),voiceRole:voiceRoleForLine(line,i,lines)})).filter(s=>s.text);
}

function cleanText(raw){ let t=String(raw||"").normalize("NFKC");
  t=t.replace(/[\uFFFD\u200B-\u200D\uFEFF]/g,"");
  t=t.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'");
  t=t.replace(/[“”„]/g,'"').replace(/[‘’‚]/g,"'").replace(/[‐‑‒–—―]/g,"-");
  t=t.replace(/^\s*WEBVTT[^\n]*$/gim," ");
  t=t.replace(/^\s*(kind:\s*captions|language:\s*\w+|subscribe|like and subscribe|advertentie|reclame)\s*$/gim," ");
  t=t.replace(/\[(music|muziek|applause|applaus|laughter|gelach|inaudible|onverstaanbaar|crosstalk|silence)\]/gi," ");
  t=t.replace(/\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?\s*(?:-->|-\s*>|→)\s*\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?/g," ");
  t=t.replace(/\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d+)?/g," ");
  t=t.replace(/^\s*\d+\s*$/gm," ").replace(/-->/g," ");
  t=t.replace(/([a-zà-ÿ])-\s*\n\s*([a-zà-ÿ])/giu,"$1$2");
  t=t.replace(/[ \t]*\n[ \t]*/g,"\n").replace(/[ \t]{2,}/g," ");
  t=t.replace(/\s+([,.;:!?])/g,"$1").replace(/([¿¡])\s+/g,"$1");
  t=t.replace(/([!?]){3,}/g,"$1$1").replace(/([,;:]){2,}/g,"$1").replace(/\.{4,}/g,"...");
  const lines=t.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const out=[];
  for(const line of lines){
    if(out.length && !/[.!?。！？:;]$/.test(out[out.length-1]) && /^[\p{Ll}'"]/u.test(line)) out[out.length-1]+=" "+line;
    else out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g,"\n\n").trim(); }

/* ---------- MOCK AI (swap for real OpenAI later) ---------- */
const STOP=new Set(("the a an and or but of to in on for with at by from as is are was were be been being this that these those it its i you he she we they my your our their not no so if then than into about over under out up down el la los las de que y a en un una por con para se su lo le les des du le la un une et ou de à dans pour qui ne pas ce cette der die das und ist im den").split(" "));
function words(text){return (text.toLowerCase().match(/[\p{L}][\p{L}'’-]{2,}/gu)||[]);}
function pickVocab(text,n){ const ws=words(text); const freq={};
  ws.forEach(w=>{if(!STOP.has(w)&&w.length>3)freq[w]=(freq[w]||0)+1;});
  const uniq=[...new Set(ws)].filter(w=>!STOP.has(w)&&w.length>3);
  uniq.sort((a,b)=>(b.length+(freq[b]||0))-(a.length+(freq[a]||0)));
  return uniq.slice(0,n); }
const ABBR="Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|vs|etc|e\\.g|i\\.e|bijv|enz|nr|resp|approx|no|No|Inc|Ltd|Co";
function sentencesOf(text){
  if(!text) return [];
  let t=text.replace(/\s*[•·▪‣◦]\s*/g,"\n").replace(/\r/g,"\n");
  const out=[];
  const abbrRe=new RegExp("\\b(?:"+ABBR+")\\.$","i");
  let buf="",quote=null;
  const push=()=>{ const p=buf.replace(/\s+/g," ").trim(); if(p) out.push(p); buf=""; };
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    buf+=ch;
    if(ch==="\""||ch==="“"||ch==="”"){
      const closing=!!quote;
      quote=closing ? null : ch;
      if(closing && /[.!?…。！？]/u.test(t[i-1]||"") && /^\s+[A-ZÀ-ÖØ-Þ]/.test(t.slice(i+1))) push();
      continue;
    }
    if(ch==="\n"){ push(); quote=null; continue; }
    if(quote) continue;
    if(/[.!?…。！？]/u.test(ch)){
      const prev=buf.trim();
      if(ch==="."&&abbrRe.test(prev)) continue;
      const rest=t.slice(i+1);
      const m=rest.match(/^\s+([\s\S]?)/u);
      if(!m) continue;
      const next=m[1]||"";
      if(/[A-ZÀ-ÖØ-Þ"“'(\[]/.test(next)) push();
    }else if(/[;；]/u.test(ch)){
      const rest=t.slice(i+1);
      if(/^\s+[A-ZÀ-ÖØ-Þ]/.test(rest)) push();
    }
  }
  push();
  const merged=[];
  for(const s of out){ if(s.length<10&&merged.length) merged[merged.length-1]+=" "+s; else merged.push(s); }
  return merged.filter(s=>s.length>3);
}
function contextFor(word,sents){ const s=sents.find(x=>x.toLowerCase().includes(word.toLowerCase())); return s||null; }
function expressionsInSentence(s){ const ws=words(s); const out=[]; for(let i=0;i<ws.length-1;i++){ const a=ws[i],b=ws[i+1];
  if(a.length>3&&b.length>3&&!STOP.has(a)&&!STOP.has(b)){ out.push(a+" "+b); } } return out.slice(0,2); }
const POS=["noun","verb","adjective","adverb","phrase"];
const DUTCH_HINTS={
  koopt:{pos:"verb",en:"buys",zh:"买",detailEn:"third-person singular of kopen",detailZh:"kopen 的第三人称单数"},
  koop:{pos:"verb",en:"buy",zh:"买"}, kopen:{pos:"verb",en:"to buy",zh:"买"},
  brood:{pos:"noun",en:"bread",zh:"面包"}, kaas:{pos:"noun",en:"cheese",zh:"奶酪"}, fruit:{pos:"noun",en:"fruit",zh:"水果"},
  kassa:{pos:"noun",en:"cash register",zh:"收银台"}, caissière:{pos:"noun",en:"cashier",zh:"女收银员"}, kassier:{pos:"noun",en:"cashier",zh:"收银员"},
  zegt:{pos:"verb",en:"says",zh:"说"}, zeggen:{pos:"verb",en:"to say",zh:"说"},
  betaal:{pos:"verb",en:"pay",zh:"付款"}, betaalt:{pos:"verb",en:"pays",zh:"付款"}, contant:{pos:"adverb",en:"in cash",zh:"用现金"},
  geld:{pos:"noun",en:"money",zh:"钱"}, geeft:{pos:"verb",en:"gives",zh:"给"}, geven:{pos:"verb",en:"to give",zh:"给"},
  dank:{pos:"phrase",en:"thanks",zh:"谢谢"}, dankjewel:{pos:"phrase",en:"thank you",zh:"谢谢你"}, bedankt:{pos:"phrase",en:"thanks",zh:"谢谢"},
  goedenavond:{pos:"phrase",en:"good evening",zh:"晚上好"}, goedemorgen:{pos:"phrase",en:"good morning",zh:"早上好"}, alstublieft:{pos:"phrase",en:"please",zh:"请/给您"},
  ziens:{pos:"phrase",en:"goodbye",zh:"再见"}, avond:{pos:"noun",en:"evening",zh:"晚上"}, prettige:{pos:"adjective",en:"pleasant",zh:"愉快的"},
  huis:{pos:"noun",en:"home",zh:"家"}, gaat:{pos:"verb",en:"goes",zh:"去"}, gaan:{pos:"verb",en:"to go",zh:"去"},
  kookt:{pos:"verb",en:"cooks",zh:"做饭"}, koken:{pos:"verb",en:"to cook",zh:"做饭"}, lekker:{pos:"adjective",en:"tasty",zh:"好吃的"}, avondeten:{pos:"noun",en:"dinner",zh:"晚饭"},
  supermarkt:{pos:"noun",en:"supermarket",zh:"超市"}, meneer:{pos:"noun",en:"mister",zh:"先生"}, mevrouw:{pos:"noun",en:"madam",zh:"女士"},
};
function inferDutchPos(word){
  const w=String(word||"").toLowerCase();
  if(DUTCH_HINTS[w]?.pos) return DUTCH_HINTS[w].pos;
  if(/(en)$/.test(w)) return "verb";
  if(/(t|dt)$/.test(w)) return "verb";
  if(/(ig|lijk|isch|e)$/.test(w)) return "adjective";
  return "noun";
}
function fallbackWordInfo(word,lang,uiLang="en"){
  const w=String(word||"").toLowerCase();
  const h=lang==="Dutch" ? DUTCH_HINTS[w] : null;
  if(!h) return {word,pos:lang==="Dutch"?inferDutchPos(w):"phrase",simpleMeaning:word,detail:null};
  const zh=uiLang==="zh";
  return {word,pos:h.pos||inferDutchPos(w),simpleMeaning:zh?(h.zh||h.en):(h.en||h.zh),detail:zh?(h.detailZh||h.detailEn||null):(h.detailEn||h.detailZh||null)};
}
function displayWordInfo(word,lang,uiLang,base,ai){
  const fallback=fallbackWordInfo(word,lang,uiLang);
  return {...(base||{}),...fallback,...(ai||{}),word:(base&&base.word)||word};
}
const LEVELS=["A1 — Beginner","A2 — Elementary","B1 — Intermediate","B2 — Upper-intermediate","C1 — Advanced"];
function levelIdx(l){ const p=(l||"").slice(0,2); return Math.max(0,LEVELS.findIndex(x=>x.startsWith(p))); }
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

function clamp(n,min,max){ return Math.max(min,Math.min(max,n)); }
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

/* ---------- flow + Delft teaching notes ---------- */
// Five modules (hub-and-spoke). All original step content is preserved — just
// regrouped, with a new 3-step Diagnosis flow at the front.
const MODULES=[
  {id:"diag",icon:"target"},
  {id:"learn",icon:"book"},
  {id:"shadow",icon:"mic"},
  {id:"recall",icon:"recall"},
  {id:"use",icon:"chat"},
];
const STEPS=[
  {id:"d1",mod:"diag",kind:"reading",min:3},
  {id:"d2",mod:"diag",kind:"listen",min:2},
  {id:"d3",mod:"diag",kind:"diag",min:1},
  {id:"l1",mod:"learn",kind:"watch",min:3},
  {id:"l2",mod:"learn",kind:"grammar",min:7},
  {id:"s1",mod:"shadow",kind:"subs",min:5},
  {id:"s2",mod:"shadow",kind:"nosubs",min:5},
  {id:"r1",mod:"recall",kind:"recall",min:4},
  {id:"u1",mod:"use",kind:"ai",min:6},
];
const TOTAL_MIN=STEPS.reduce((a,s)=>a+s.min,0);
function stepIndex(id){ return STEPS.findIndex(s=>s.id===id); }
/* collapsed plan blocks used only on the pre-session preview screen */
const PLAN_BLOCKS=[
  {name:"Learning",icon:"🎧",items:["Listen","Watch in your language"],min:6},
  {name:"Grammar & Vocabulary",icon:"🔍",items:["Sentence-by-sentence study"],min:7},
  {name:"Practicing",icon:"🗣️",items:["With subtitles","No subtitles","Recall from English"],min:14},
  {name:"Using",icon:"💬",items:["Write & talk with AI"],min:6},
];

// ---- inline icons (shell + sidebar) ----
const ICONS={
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  book:'<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  mic:'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>',
  recall:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  chat:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  panel:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  panelClose:'<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
};
function Svg({n}){ return <svg className="i" viewBox="0 0 24 24" dangerouslySetInnerHTML={{__html:ICONS[n]||""}}/>; }

/* ---------- shared ---------- */
function Loading(){
  const {t}=useUI();
  const steps=t.buildingSteps;
  const [i,setI]=useState(0);
  useEffect(()=>{ const t=setInterval(()=>setI(x=>Math.min(x+1,steps.length-1)),3200); return ()=>clearInterval(t); },[]);
  return (<div className="center" style={{textAlign:"center"}}>
    <div className="tface pulse" style={{margin:"0 auto 18px",width:56,height:56,fontSize:28}}>📖</div>
    <div style={{fontWeight:600,fontSize:18}}>{t.buildingTitle}</div>
    <div className="muted" style={{marginTop:10,minHeight:22,fontSize:15}}>{steps[i]}</div>
    <div className="track" style={{maxWidth:280,margin:"18px auto 0"}}><span style={{width:((i+1)/steps.length*100)+"%",transition:"width .6s ease"}}/></div>
    <div className="tiny muted" style={{marginTop:16,maxWidth:340,marginLeft:"auto",marginRight:"auto",lineHeight:1.6}}>
      {t.buildingNote}
    </div>
  </div>);
}
const Brand=()=>(<div className="brand"><div className="logo">L</div>Lingua</div>);
function LanguageSwitch(){
  const {uiLang,setUiLang,t}=useUI();
  return (<label className="lang-switch">
    <span>{t.interfaceLanguage}</span>
    <select value={uiLang} onChange={e=>setUiLang(e.target.value)}>
      <option value="en">{t.english}</option>
      <option value="zh">{t.chinese}</option>
    </select>
  </label>);
}
const Stat=({k,v})=>(<div className="stat"><div className="k">{k}</div><div className="v">{v}</div></div>);
function Stars({n}){ return <span>{[1,2,3,4,5].map(i=><span key={i} className={"star"+(i<=n?"":" off")}>★</span>)}</span>; }
function Teacher({children}){ return <div className="teacher"><div className="tface">👩‍🏫</div><div className="tmsg">{children}</div></div>; }
function Purpose({children}){ return <div className="purpose">{children}</div>; }
function CheckIn({children}){ return <div className="checkin"><span>💛</span><span>{children}</span></div>; }

function FullPlayer({text,lang,label,sub}){
  const {t}=useUI();
  const [playing,setPlaying]=useState(false); const [rate,setRate]=useState(1);
  const [pos,setPos]=useState(0); const [dur,setDur]=useState(()=>estimateAudioSeconds(text,1));
  const seq=useRef(0);
  const timer=useRef(null);
  function clearTimer(){ if(timer.current){clearInterval(timer.current);timer.current=null;} }
  function attachProgress(u,estimated){
    setPos(0); setDur(estimated);
    clearTimer();
    const started=Date.now();
    timer.current=setInterval(()=>setPos(p=>Math.min(estimated,(Date.now()-started)/1000)),500);
    if(u){
      u.onmeta=(d)=>{ if(d&&isFinite(d))setDur(d); };
      u.onprogress=(p,d)=>{ clearTimer(); if(d&&isFinite(d))setDur(d); setPos(p||0); };
    }
  }
  useEffect(()=>()=>{seq.current++;clearTimer();stopSpeak();},[]);
  function start(r=rate){
    const run=++seq.current;
    const segments=dialogueSegments(text);
    const estimated=estimateAudioSeconds(text,r);
    attachProgress(null,estimated);
    if(segments.length>1){
      setPlaying(true);
      clearTimer();
      const known=segments.map(seg=>estimateAudioSeconds(seg.text,r));
      const total=()=>known.reduce((a,b)=>a+b,0);
      let doneDur=0;
      setPos(0); setDur(total());
      const playSegment=(i)=>{
        if(run!==seq.current) return;
        if(i>=segments.length){clearTimer();setPos(total());setPlaying(false);return;}
        const seg=segments[i];
        const u=speak(seg.text,lang,r,seg.voiceRole);
        if(!u){setPlaying(false);return;}
        u.onmeta=(d)=>{ if(d&&isFinite(d)){ known[i]=d; setDur(total()); } };
        u.onprogress=(p,d)=>{ if(d&&isFinite(d)){ known[i]=d; setDur(total()); } setPos(Math.min(total(),doneDur+(p||0))); };
        u.onend=()=>{ doneDur+=known[i]||estimateAudioSeconds(seg.text,r); setPos(Math.min(total(),doneDur)); setTimeout(()=>playSegment(i+1),220); };
      };
      playSegment(0);
      return;
    }
    const u=speak(text,lang,r);
    attachProgress(u,estimated);
    if(u){u.onend=()=>{clearTimer();setPos(estimated);setPlaying(false);};setPlaying(true);}
  }
  function toggle(){ if(playing){seq.current++;clearTimer();stopSpeak();setPlaying(false);return;} start(rate); }
  function setR(r){ setRate(r); if(playing){seq.current++;clearTimer();stopSpeak();start(r);} else {setDur(estimateAudioSeconds(text,r));setPos(0);} }
  const pct=dur?Math.min(100,Math.max(0,pos/dur*100)):0;
  return (<div className="player">
    <button className="playbtn" onClick={toggle}>{playing?"❚❚":"▶"}</button>
    <div style={{flex:1}}><div style={{fontWeight:600}}>{label||t.fullSourceAudio}</div>
      <div className="tiny muted">{TTS_OK?(sub||t.fullSourceRead):t.audioUnsupported}</div>
      <div className="audio-progress"><span style={{width:pct+"%"}}/></div>
      <div className="tiny muted row" style={{justifyContent:"space-between",gap:8}}>
        <span>{t.audioTime(fmtTime(pos),fmtTime(dur))}</span><span>{t.audioLeft(fmtTime(Math.max(0,dur-pos)))}</span>
      </div></div>
    <div className="row" style={{gap:6}}>{[0.75,1,1.25].map(r=><button key={r} className={"rate"+(rate===r?" on":"")} onClick={()=>setR(r)}>{r}×</button>)}
      <button className="sbtn" title={t.restart} onClick={()=>setR(rate)}>↺</button></div>
  </div>);
}
function Say({text,lang,rate=1,voiceRole}){ const {t}=useUI(); return <button className="sbtn saybtn" title={t.play} aria-label={t.play} onClick={(e)=>{e.stopPropagation();speak(voiceRole?spokenTextForLine(text):text,lang,rate,voiceRole);}}><span>▶</span><span>{t.play}</span></button>; }

// Small per-section AI call. Returns parsed JSON or null (never throws).
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

function SyncReader({items,lang,level,translation,rate=1,gap=0}){
  const {t,uiLang}=useUI();
  const [active,setActive]=useState(-1); const [playing,setPlaying]=useState(false); const stop=useRef(false);
  const [trs,setTrs]=useState(()=>items.map(it=>uiLang==="en" ? (it.tr||null) : null));
  const [loadingTr,setLoadingTr]=useState(false);
  const [page,setPage]=useState(0);
  const pageSize=5;
  const pageCount=Math.max(1,Math.ceil(items.length/pageSize));
  const start=page*pageSize;
  const pageItems=items.slice(start,start+pageSize);
  const estimateSec=Math.max(8,Math.ceil(items.length*1.6));
  const elapsed=useElapsed(loadingTr);
  const remaining=Math.max(1,estimateSec-elapsed);
  useEffect(()=>{ setPage(0); setActive(-1); stopSpeak(); },[items.length]);
  useEffect(()=>{ if(translation) setTrs(items.map(()=>null)); },[uiLang,translation,items.length]);
  useEffect(()=>{ let cancel=false;
    if(!translation) return;
    const missing=pageItems.map((it,i)=>({it,i:start+i})).filter(({it,i})=>!((uiLang==="en"&&it.tr)||trs[i]));
    if(!missing.length) return;
    setLoadingTr(true);
    cachedAiAnalyze("translate",{sentences:missing.map(x=>x.it.s),lang,level,translationLanguage:uiLang==="zh"?"Chinese":"English"}).then(d=>{
      if(cancel) return; setLoadingTr(false);
      if(d&&Array.isArray(d.translations)) setTrs(prev=>{ const next=[...prev]; missing.forEach((m,i)=>{next[m.i]=(uiLang==="en"&&m.it.tr)||d.translations[i]||null;}); return next; });
    });
    return ()=>{cancel=true;};
  },[translation,uiLang,page,items.length]);
  useEffect(()=>()=>{stop.current=true;stopSpeak();},[]);
  function playFrom(i){ if(stop.current||i>=items.length){setPlaying(false);setActive(-1);return;}
    const nextPage=Math.floor(i/pageSize);
    if(nextPage!==page) setPage(Math.max(0,Math.min(pageCount-1,nextPage)));
    const role=voiceRoleForLine(items[i].s,i,items);
    setActive(i); const u=speak(role?spokenTextForLine(items[i].s):items[i].s,lang,rate,role); if(!u){setPlaying(false);return;}
    u.onend=()=>{ if(!stop.current) setTimeout(()=>{ if(!stop.current) playFrom(i+1); }, gap); }; }
  function playAll(){ stop.current=false; setPlaying(true); playFrom(start); }
  function halt(){ stop.current=true; stopSpeak(); setPlaying(false); setActive(-1); }
  function one(i){ stop.current=true; stopSpeak(); setActive(i); const role=voiceRoleForLine(items[i].s,i,items); const u=speak(role?spokenTextForLine(items[i].s):items[i].s,lang,rate,role); if(u)u.onend=()=>setActive(-1); }
  function changePage(next){ halt(); setPage(Math.max(0,Math.min(pageCount-1,next))); }
  return (<div>
    <div className="row" style={{marginBottom:12}}>
      <button className="btn btn-primary btn-sm" onClick={playing?halt:playAll}>{playing?`❚❚ ${t.stop}`:`▶ ${t.playAll}`}</button>
      <span className="tiny muted">{t.syncHint}</span>
    </div>
    {translation && loadingTr && <div className="status-strip" style={{marginBottom:12}}>
      <div className="row" style={{justifyContent:"space-between",alignItems:"baseline"}}>
        <b>{t.translatingTitle}</b><span className="tiny muted">{t.aboutRemaining(remaining)}</span>
      </div>
      <div className="mini-track"><span style={{width:progressPct(elapsed,estimateSec)+"%"}}/></div>
    </div>}
    <div className="reader-pager">
      <button className="btn btn-outline btn-sm" disabled={page===0} onClick={()=>changePage(page-1)}>← {t.previousPage}</button>
      <span className="tiny muted">{t.pageOf(page+1,pageCount)} · {start+1}-{Math.min(items.length,start+pageItems.length)} / {items.length}</span>
      <button className="btn btn-outline btn-sm" disabled={page>=pageCount-1} onClick={()=>changePage(page+1)}>{t.nextPage} →</button>
    </div>
    <div className="card card-p">
      {pageItems.map((it,j)=>{ const i=start+j; const translated=(uiLang==="en"&&it.tr)||trs[i]; return (<div key={i} className={"sline"+(active===i?" on":"")} onClick={()=>one(i)} style={{marginBottom:translation?10:2}}>
        <div className="sentence-source">{it.s}</div>
        {translation && <div className={"translation-line"+(!translated&&loadingTr?" loading":"")}>{translated?("→ "+translated):(loadingTr?`→ ${t.lineTranslating(i+1,items.length)}`:`→ ${t.translationUnavailable}`)}</div>}
      </div>); })}
    </div>
  </div>);
}

function Quiz({items,lang,audio}){
  const {t}=useUI();
  const [ans,setAns]=useState({});
  return (<div>{items.map((q,qi)=>{ const chosen=ans[qi];
    return (<div key={qi} className="card card-p" style={{marginBottom:14}}>
      <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontWeight:600}}>{q.q?q.q:(audio?t.whichHeard:t.whichMatches)}</div>
        {audio && <button className="btn btn-outline btn-sm" onClick={()=>{const role=voiceRoleForLine(q.correct,qi,items.map(x=>x.correct)); speak(role?spokenTextForLine(q.correct):q.correct,lang,1,role);}}>▶ {t.play}</button>}</div>
      {q.options.map((o,oi)=>{ let cls="opt"; if(chosen!=null){if(o.ok)cls+=" correct";else if(oi===chosen)cls+=" wrong";}
        return (<div key={oi} className={cls} onClick={()=>chosen==null&&setAns({...ans,[qi]:oi})}>
          <span className="mk">{chosen!=null&&o.ok?"✓":chosen===oi?"✕":String.fromCharCode(65+oi)}</span><span>{o.t}</span></div>); })}
      {chosen!=null && <div className="tiny muted" style={{marginTop:4}}>{q.options[chosen].ok?t.niceRight:t.notQuite}</div>}
    </div>); })}</div>);
}
// Comprehension quiz written by the AI in the target language (falls back to the
// built-in sentence-match quiz if the call fails).
function AIQuiz({lesson}){
  const {t}=useUI();
  const {lang,level,sents,comprehension}=lesson;
  const [items,setItems]=useState(comprehension);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{ let cancel=false;
    cachedAiAnalyze("quiz",{lang,level,sentences:sents.slice(0,10),count:3}).then(d=>{
      if(cancel) return; setLoading(false);
      if(d&&Array.isArray(d.items)&&d.items.length) setItems(d.items);
    });
    return ()=>{cancel=true;};
  },[]);
  return (<div>
    {loading && <div className="tiny muted" style={{marginBottom:8}}>{t.quizLoading}</div>}
    <Quiz items={items} lang={lang} audio={false}/>
  </div>);
}
function SelfRate({value,onChange,prompt}){
  const {t}=useUI();
  return (<div><div style={{fontWeight:600,marginBottom:12}}>{prompt}</div>
    <input type="range" min="0" max="100" step="5" value={value} onChange={e=>onChange(Number(e.target.value))} style={{width:"100%"}}/>
    <div className="row" style={{justifyContent:"space-between",marginTop:6}}>
      <span className="tiny muted">{t.selfLow}</span><span className="badge">{value}%</span><span className="tiny muted">{t.selfHigh}</span></div></div>);
}

/* ---------- login / input / preview ---------- */
function Login({onDone}){ const {t}=useUI(); const [email,setEmail]=useState(DB.get("email","")); const ok=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  return (<div className="center">
    <div style={{display:"flex",justifyContent:"center",marginBottom:14}}><LanguageSwitch/></div>
    <div style={{textAlign:"center",marginBottom:24}}><div style={{display:"inline-flex"}}><Brand/></div></div>
    <div className="card card-p"><h1 style={{fontSize:21}}>{t.loginTitle}</h1>
      <p className="sub" style={{marginBottom:18}}>{t.loginSub}</p>
      <label className="fld">{t.email}</label>
      <input className="input" value={email} placeholder="you@example.com" onChange={e=>setEmail(e.target.value)}/>
      <button className="btn btn-primary" style={{width:"100%",marginTop:14}} disabled={!ok} onClick={()=>{DB.set("email",email);onDone(email);}}>{t.continue}</button>
      <p className="tiny muted" style={{textAlign:"center",marginTop:14}}>{t.noPassword}</p></div>
  </div>);
}
const LANGS=Object.keys(LANG_CODE).sort();
const GOALS=["General fluency","Conversation & speaking","Reading comprehension","Vocabulary building","Exam preparation"];

function SourceIdeas({tips,hint}){
  const {t}=useUI();
  const [open,setOpen]=useState(false);
  const [active,setActive]=useState(0);
  const current=tips[active]||tips[0];
  return (<div className={"source-tips compact"+(open?" open":"")}>
    <button className="ideas-toggle" onClick={()=>setOpen(o=>!o)} aria-expanded={open}>
      <span><b>{t.materialTipsTitle}</b><small>{hint}</small></span>
      <span>{open?t.hideIdeas:t.showIdeas}</span>
    </button>
    {open && <div className="ideas-body">
      <div className="idea-tabs">{tips.map((tip,i)=><button key={tip.key} className={active===i?"on":""} onClick={()=>setActive(i)}>
        <span>{tip.icon}</span><span>{tip.key}</span>
      </button>)}</div>
      {current && <div className="idea-panel">
        <div>
          <b>{current.key}</b>
          <p>{current.detail}</p>
        </div>
        <div className="source-links">{(current.links||[]).map((link,i)=>link.url
          ? <a key={i} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
          : <span key={i}>{link.label}</span>)}</div>
      </div>}
    </div>}
  </div>);
}

function InputScreen({onNext}){
  const {t}=useUI();
  const [mode,setMode]=useState(null);
  const [raw,setRaw]=useState(DB.get("draft","")); const cleaned=cleanText(raw); const count=cleaned.length; const LIMIT=1200; const over=count>LIMIT;
  const savedLang=DB.get("lang","Dutch");
  const [lang,setLang]=useState(LANG_CODE[savedLang]?savedLang:"Dutch"); const [level,setLevel]=useState(DB.get("level",LEVELS[1])); const [goal,setGoal]=useState(DB.get("goal",GOALS[0]));
  const [durationIdx,setDurationIdx]=useState(1);
  const [topicIdxs,setTopicIdxs]=useState([0]);
  const [materials,setMaterials]=useState([]);
  const [selectedMaterial,setSelectedMaterial]=useState(0);
  const [generating,setGenerating]=useState(false);
  const fileRef=useRef(null);
  const recentTitles=useRef([]);   // anti-repeat memory across regenerations
  function onFile(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>setRaw(String(r.result));r.readAsText(f);}
  const ready=count>40&&!over&&lang;
  const liveStats=count>40?materialStats(cleaned,level):null;
  const shouldSplit=liveStats&&(liveStats.mins>=60||count>1050||liveStats.words>240);
  const durationPlans=t.durationPlans||[];
  const selectedDuration=durationPlans[durationIdx]?.label||"45-60 min";
  const topics=topicIdxs.map(i=>t.interestOptions[i]).filter(Boolean);
  useEffect(()=>{ scrollToTop(); },[mode]);
  function toggleTopic(index){ setTopicIdxs(prev=>prev.includes(index)?prev.filter(x=>x!==index):[...prev,index].slice(0,3)); }
  async function generateMaterials(){
    if(!lang) return;
    setGenerating(true);
    const spec=durationSpec(selectedDuration);
    // Anti-repeat: tell the server which topics/titles we just showed, plus a nonce.
    const avoid=[...recentTitles.current,...topics].slice(0,12);
    const nonce=Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,8);
    const d=await aiAnalyze("materials",{lang,level,goal,duration:selectedDuration,topics,avoid,nonce});
    let generated=d&&Array.isArray(d.materials)?d.materials.filter(safeDutchMaterial):[];
    if(generated.length){
      generated=generated.map(m=>({...m,duration:m.duration||selectedDuration,targetMinutes:m.targetMinutes||spec.target}));
    } else {
      // Offline / AI-unavailable fallback: annotate + level-check + shuffle the
      // static samples with the SAME analyzer, so a beginner never sees an
      // over-level fallback and the order at least changes on regenerate.
      generated=sampleMaterials(lang,level,goal,selectedDuration,topics)
        .map(m=>{ const text=cleanText(m.text||""); const a=analyzeDifficulty(text,level);
          return {...m,text,id:cefrMaterialId(text),validatedTextLevel:a.validatedTextLevel,level:a.validatedTextLevel,
            targetUserLevel:level.slice(0,2),difficultyTier:a.difficultyTier,hardWordRatio:a.hardWordRatio,
            vocabularyAnnotations:a.annotations,duration:selectedDuration,targetMinutes:m.targetMinutes||spec.target,resultSource:"fallback"}; })
        .filter(m=>cefrIndex(m.validatedTextLevel)<=cefrIndex(level)+1)
        .sort(()=>Math.random()-0.5);
    }
    const items=generated.slice(0,3);
    recentTitles.current=[...items.map(m=>m.title).filter(Boolean),...recentTitles.current].slice(0,12);
    setMaterials(items); setSelectedMaterial(0); setGenerating(false);
  }
  function startGenerated(){
    const m=materials[selectedMaterial]; if(!m) return;
    const text=cleanText(m.text||""); DB.set("draft",m.text||""); DB.set("lang",lang); DB.set("level",level); DB.set("goal",goal);
    const targetMin=m.targetMinutes||durationSpec(selectedDuration).target;
    // Pass the stored material analysis forward so card = preview = diagnosis.
    const material={ id:m.id||cefrMaterialId(text), title:m.title||null, source:m.source||null,
      targetUserLevel:m.targetUserLevel||level.slice(0,2), validatedTextLevel:m.validatedTextLevel||m.level||level.slice(0,2),
      difficultyTier:m.difficultyTier||null, hardWordRatio:m.hardWordRatio??null,
      vocabularyAnnotations:Array.isArray(m.vocabularyAnnotations)?m.vocabularyAnnotations:[], estimatedLessonTime:targetMin };
    onNext({text,lang,level,goal,targetMin,material});
  }
  if(!mode) return (<div className="start-screen">
    <div className="start-head">
      <h1>{t.startTitle}</h1>
      <p className="sub">{t.startSub}</p>
    </div>
    <div className="entry-grid">
      <button className="entry-card" onClick={()=>setMode("material")}>
        <span className="entry-icon">📄</span>
        <span className="entry-copy">
          <span className="entry-title">{t.startMaterialTitle}</span>
          <span className="entry-sub">{t.startMaterialSub}</span>
          <span className="entry-action">{t.startMaterialAction} →</span>
        </span>
      </button>
      <button className="entry-card" onClick={()=>setMode("find")}>
        <span className="entry-icon">✨</span>
        <span className="entry-copy">
          <span className="entry-title">{t.startFindTitle}</span>
          <span className="entry-sub">{t.startFindSub}</span>
          <span className="entry-action">{t.startFindAction} →</span>
        </span>
      </button>
    </div>
  </div>);

  if(mode==="find") return (<div>
    <button className="btn btn-ghost btn-sm" style={{marginBottom:16}} onClick={()=>setMode(null)}>← {t.back}</button>
    <h1>{t.findTitle}</h1><p className="sub">{t.findSub}</p>
    <div className="card card-p">
      <div className="grid3">
        <div><label className="fld">{t.targetLanguage}</label><select value={lang} onChange={e=>setLang(e.target.value)}>{LANGS.map(l=><option key={l} value={l}>{langName(t,l)}</option>)}</select></div>
        <div><label className="fld">{t.currentLevel}</label><select value={level} onChange={e=>setLevel(e.target.value)}>{LEVELS.map((l,i)=><option key={l} value={l}>{t.levels[i]||l}</option>)}</select></div>
        <div><label className="fld">{t.sessionGoal}</label><select value={goal} onChange={e=>setGoal(e.target.value)}>{GOALS.map((l,i)=><option key={l} value={l}>{t.goals[i]||l}</option>)}</select></div>
      </div>
      <div className="grid2" style={{marginTop:16}}>
        <div><label className="fld">{t.duration}</label><div className="duration-options">{durationPlans.map((plan,i)=><button key={plan.label} className={"duration-card"+(durationIdx===i?" on":"")} onClick={()=>setDurationIdx(i)}>
          <span className="duration-icon">{plan.icon}</span>
          <span><b>{plan.label}</b><small>{plan.length} · {plan.vocab}</small></span>
        </button>)}</div></div>
        <div><label className="fld">{t.interests}</label><div className="topic-pills">{t.interestOptions.map((topic,i)=><button key={topic} className={topicIdxs.includes(i)?"on":""} onClick={()=>toggleTopic(i)}>{topic}</button>)}</div></div>
      </div>
      <div className="row" style={{justifyContent:"space-between",marginTop:18}}>
        {!lang && <span className="tiny muted">{t.chooseTarget}</span>}
        <span/>
        <button className="btn btn-primary" disabled={!lang||generating} onClick={generateMaterials}>{generating?t.generatingMaterials:t.generateMaterials}</button>
      </div>
      {generating && <div className="track" style={{marginTop:14,overflow:"hidden"}}><span className="indet"/></div>}
    </div>
    {materials.length>0 && <div className="material-results">
      <div className="row" style={{justifyContent:"space-between",marginBottom:10}}>
        <div><h2 style={{margin:0}}>{t.chooseMaterial}</h2><div className="tiny muted">{t.switchAnytime}</div></div>
        <button className="btn btn-primary btn-sm" onClick={startGenerated}>{t.useThisText} →</button>
      </div>
      <div className="generated-grid">
        {materials.map((m,i)=>{ const stats=materialStats(m.text,level,m.duration||selectedDuration); return <button key={i} className={"generated-card"+(selectedMaterial===i?" on":"")} onClick={()=>setSelectedMaterial(i)}>
          <span className="row wrap" style={{gap:6}}><span className="badge badge-outline">{sourceIcon(m.source)} {m.source||"AI text"}</span><span className="badge badge-warm">{m.validatedTextLevel||m.level||level.slice(0,2)}</span></span>
          <b>{m.title}</b>
          <span className="generated-meta">{t.materialMeta(stats.mins,stats.words,stats.vocab)}</span>
          <span>{(m.text||"").slice(0,190)}{(m.text||"").length>190?"…":""}</span>
        </button>; })}
      </div>
    </div>}
  </div>);

  return (<div>
    <button className="btn btn-ghost btn-sm" style={{marginBottom:16}} onClick={()=>setMode(null)}>← {t.back}</button>
    <h1>{t.inputTitle}</h1><p className="sub">{t.inputSub}</p>
    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",marginBottom:10}}>
        <label className="fld" style={{margin:0}}>{t.yourText}</label>
        <button className="btn btn-outline btn-sm" onClick={()=>fileRef.current.click()}>{t.uploadTxt}</button>
        <input ref={fileRef} type="file" accept=".txt,.md" onChange={onFile} style={{display:"none"}}/></div>
      <SourceIdeas tips={t.materialTips} hint={t.sourceHint}/>
      <textarea style={{minHeight:220}} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={t.textPlaceholder}/>
      <div className="row" style={{justifyContent:"space-between",marginTop:10}}>
        <span className="tiny muted">{t.cleanNote}</span>
        <span className="tiny" style={{fontWeight:600,color:over?"hsl(0 72% 45%)":"hsl(var(--muted-foreground))"}}>{count.toLocaleString()} / {LIMIT.toLocaleString()} {t.chars}</span></div>
      {shouldSplit && <div className="split-warning">
        <b>{t.splitTitle}</b>
        <span>{t.splitText(liveStats.mins)}</span>
      </div>}
    </div>
    <div className="grid3" style={{marginTop:16}}>
      <div><label className="fld">{t.targetLanguage}</label><select value={lang} onChange={e=>setLang(e.target.value)}>{LANGS.map(l=><option key={l} value={l}>{langName(t,l)}</option>)}</select></div>
      <div><label className="fld">{t.currentLevel}</label><select value={level} onChange={e=>setLevel(e.target.value)}>{LEVELS.map((l,i)=><option key={l} value={l}>{t.levels[i]||l}</option>)}</select></div>
      <div><label className="fld">{t.sessionGoal}</label><select value={goal} onChange={e=>setGoal(e.target.value)}>{GOALS.map((l,i)=><option key={l} value={l}>{t.goals[i]||l}</option>)}</select></div>
    </div>
    {over && <p className="tiny" style={{color:"hsl(0 72% 45%)",marginTop:12}}>{t.overLimit}</p>}
    {!lang && <p className="tiny muted" style={{marginTop:12}}>{t.chooseTarget}</p>}
    <div style={{display:"flex",justifyContent:"flex-end",marginTop:20}}>
      <button className="btn btn-primary" disabled={!ready} onClick={()=>{DB.set("draft",raw);DB.set("lang",lang);DB.set("level",level);DB.set("goal",goal);onNext({text:cleaned,lang,level,goal});}}>{t.analyzeText} →</button>
    </div>
  </div>);
}

function Preview({lesson,text,onStart,onBack}){
  const {t}=useUI();
  const heavy=lesson.vocabCount>12;
  const total=lesson.estMin||TOTAL_MIN; const scale=total/TOTAL_MIN;
  const diffLabel=t.diffLabels[lesson.diff];
  const fullText=(text&&text.trim())?text:((lesson.sents||[]).join("\n"));
  // The material's CEFR comes from the ONE stored analysis — not a recompute.
  const matLevel=(lesson.material&&lesson.material.validatedTextLevel)||lesson.recommended.split(" — ")[0];
  return (<div>
    <h1>{t.previewTitle}</h1><p className="sub">{t.previewSub}</p>
    <div className="row wrap" style={{gap:7,marginBottom:16}}>
      <span className="tiny muted" style={{fontWeight:600}}>{t.topics}</span>
      {lesson.topics.map(t=><span key={t} className="badge badge-warm">{t}</span>)}
    </div>
    <div className="card card-p" style={{marginBottom:16}}>
      <div className="row" style={{justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
        <h3 className="lbl" style={{margin:0}}>{t.previewTextTitle}</h3>
        <span className="tiny muted">{lesson.charCount.toLocaleString()} {t.chars}</span>
      </div>
      <div className="tiny muted" style={{marginBottom:10}}>{t.previewTextHint}</div>
      <div style={{maxHeight:280,overflowY:"auto",whiteSpace:"pre-wrap",lineHeight:1.7,fontSize:15,padding:"2px 2px"}}>{fullText}</div>
    </div>
    <div className="grid4" style={{marginBottom:14}}>
      <Stat k={t.recommendedLevel} v={matLevel}/>
      <Stat k={t.estimatedTime} v={t.min(total)}/>
      <Stat k={t.vocabulary} v={t.wordCount(lesson.vocabCount)}/>
      <Stat k={t.characters} v={lesson.charCount.toLocaleString()}/>
    </div>
    {(lesson.charCount>1050||lesson.vocabCount>18) && <div className="split-warning" style={{marginBottom:14}}>
      <b>{t.splitTitle}</b>
      <span>{t.splitText(total)}</span>
    </div>}
    <div className="card card-p" style={{marginBottom:16}}>
      <div className="row" style={{justifyContent:"space-between"}}>
        <div><div className="stat-k" style={{fontSize:11,fontWeight:600,color:"hsl(var(--muted-foreground))",textTransform:"uppercase",letterSpacing:".05em"}}>{t.difficultyForYou}</div>
          <div style={{marginTop:5}}><Stars n={lesson.diff}/> <span style={{fontWeight:600,marginLeft:6}}>{diffLabel}</span></div></div>
        <div className="tiny muted" style={{textAlign:"right",maxWidth:230}}>{t.basedOnLevel(lesson.level.split(" — ")[0],matLevel)}</div>
      </div>
    </div>
    <DailyFocus lesson={lesson}/>
    <div className="card card-p">
      <h3 className="lbl">{t.session} · {t.stepsInBlocks(STEPS.length,PLAN_BLOCKS.length)}</h3>
      {PLAN_BLOCKS.map((b,i)=>(<div className="plan-row" key={b.name}>
        <span className="row" style={{gap:11}}><span style={{fontSize:18}}>{b.icon}</span>
          <span><div style={{fontWeight:600}}>{t.planNames[i]||b.name}</div><div className="tiny muted">{(t.planItems[i]||b.items).join(" · ")}</div></span></span>
        <span className="tiny muted">~{Math.max(1,Math.round(b.min*scale))} min</span></div>))}
      <div className="ref">
        <b>{t.refTitle}.</b> {t.refText}<br/>
        {t.refSources}
      </div>
    </div>
    {heavy && <div className="checkin" style={{marginTop:16,background:"hsl(var(--warm)/.08)",borderColor:"hsl(var(--warm)/.3)"}}><span>💡</span>
      <span>{t.heavy(lesson.vocabCount)}</span></div>}
    <div className="row" style={{justifyContent:"space-between",marginTop:22}}>
      <button className="btn btn-ghost" onClick={onBack}>← {t.back}</button>
      <button className="btn btn-primary" onClick={onStart}>{t.start(total)} →</button></div>
  </div>);
}

function DailyFocus({lesson}){
  const {t}=useUI();
  const focus=lesson.focus||null;
  if(!focus) return <div className="card card-p" style={{marginBottom:16}}>
    <h3 className="lbl">{t.focus.title}</h3>
    <div className="tiny muted">{t.focus.loading}</div>
  </div>;
  const vocab=Array.isArray(focus.vocab)?focus.vocab.slice(0,8):[];
  const grammar=Array.isArray(focus.grammar)?focus.grammar.slice(0,3):[];
  return (<div className="card card-p" style={{marginBottom:16}}>
    <h3 className="lbl">{t.focus.title}</h3>
    <Teacher>{t.focus.teacher}</Teacher>
    {!!vocab.length && <div style={{marginBottom:12}}>
      <div className="tiny muted" style={{fontWeight:700,marginBottom:7}}>{t.focus.vocab}</div>
      <div className="row wrap" style={{gap:7}}>{vocab.map((v,i)=><span key={(v.word||"")+i} className="badge">{v.word}<span className="muted">{v.level||""}</span></span>)}</div>
    </div>}
    {!!grammar.length && <div>
      <div className="tiny muted" style={{fontWeight:700,marginBottom:7}}>{t.focus.grammar}</div>
      <div className="row wrap" style={{gap:7}}>{grammar.map((g,i)=><span key={(g.point||"")+i} className="badge badge-outline">{g.point}<span className="muted">{g.level||""}</span></span>)}</div>
    </div>}
  </div>);
}

/* ---------- lesson shell ---------- */
// The learnbar + centered content + footnav for an active session. Step nav is
// owned by App (so the sidebar path panel and the footnav stay in sync).
function SessionView({lesson,text,step,onPrev,onContinue,diag,setDiag}){
  const {t}=useUI();
  const S=STEPS[step]; const M=MODULES.find(m=>m.id===S.mod);
  const pct=Math.round(((step+1)/STEPS.length)*100);
  const stepMin=Math.max(1,Math.round(S.min*((lesson.estMin||TOTAL_MIN)/TOTAL_MIN)));
  const last=step===STEPS.length-1;
  return (<div>
    <div className="learnbar">
      <div className="track"><span style={{width:pct+"%"}}/></div>
      <div className="learnmeta">
        <span className="tiny muted">{t.nav.mods[M.id]} · {t.nav.steps[S.id]}</span>
        <span className="tiny muted">{t.min(stepMin)}</span></div>
    </div>
    <div className="stage"><StepBody step={S} lesson={lesson} text={text} diag={diag} setDiag={setDiag}/></div>
    <div className="footnav">
      <button className="btn btn-outline btn-sm focusable" disabled={step===0} onClick={onPrev}>← {t.previous}</button>
      <button className="btn btn-primary btn-sm focusable" onClick={onContinue}>{last?`${t.finish} ✓`:`${t.continue} →`}</button>
    </div>
  </div>);
}

function StepBody({step,lesson,text,diag,setDiag}){
  const {t}=useUI();
  const {lang}=lesson; const sents=lesson.sents;
  switch(step.kind){
    case "reading": return <ReadingCheck lesson={lesson} text={text} diag={diag} setDiag={setDiag}/>;
    case "listen":  return <BlindListen lesson={lesson} text={text} diag={diag} setDiag={setDiag}/>;
    case "diag":    return <DiagnosisMatrix lesson={lesson} diag={diag}/>;
    case "watch": return (<div>
      <div className="eyebrow">{t.nav.mods.learn}</div><h2>{t.nav.steps.l1}</h2>
      <Teacher>{t.watch.teacher}</Teacher>
      <Purpose>{t.watch.purpose}</Purpose>
      <SyncReader key="watch-reader" items={sents.map((s)=>({s,tr:(lesson.watch||[]).find(x=>x.s===s)?.tr||null}))} lang={lang} level={lesson.level} translation={true}/>
      <CheckIn>{t.watch.check}</CheckIn>
    </div>);
    case "grammar": return <GrammarStep lesson={lesson} onComplete={()=>{}}/>;
    case "subs":    return <TimedPractice key="subs" sents={sents} lang={lang} withSubs={true}/>;
    case "nosubs":  return <TimedPractice key="nosubs" sents={sents} lang={lang} withSubs={false}/>;
    case "recall":  return <RecallStep lesson={lesson} onComplete={()=>{}}/>;
    default:        return <PracticeAI lesson={lesson} onComplete={()=>{}}/>;
  }
}

/* ---------- Diagnosis module ---------- */
// Step 1 — Reading check. Reuses the ONE stored material analysis (CEFR-graded
// vocabulary annotations) — it does NOT re-ask the model to grade words. The
// learner taps the ones they know; coverage = 1 − unknown/total tokens.
function ReadingCheck({lesson,text,diag,setDiag}){
  const {t}=useUI();
  const {level}=lesson;
  const src=(text&&text.trim())?text:((lesson.sents||[]).join("\n"));
  // Candidate hard words come straight from the stored analysis (words above the
  // learner's level). Fall back to a local, deterministic analysis if absent.
  const annotations=useMemo(()=>{
    const stored=lesson.material&&Array.isArray(lesson.material.vocabularyAnnotations)?lesson.material.vocabularyAnnotations:null;
    const list=(stored&&stored.length)?stored:analyzeDifficulty(src,level).annotations;
    return list.slice(0,20);
  },[lesson.material,src,level]);
  const totalTokens=Math.max(1,words(src).length);
  const matLevel=(lesson.material&&lesson.material.validatedTextLevel)||LEVELS[levelIdx(level)].slice(0,2);
  const [known,setKnown]=useState(()=>new Set());
  const unknownWords=annotations.filter(g=>!known.has((g.lemma||g.surface||"").toLowerCase())).map(g=>g.surface||g.lemma);
  const coverage=Math.max(40,Math.min(99,Math.round((1-unknownWords.length/totalTokens)*100)));
  useEffect(()=>{ setDiag(d=>({...d,coverage,total:totalTokens,unknown:unknownWords}));
    DB.set("unknownWords",unknownWords);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[coverage,annotations.length,known.size]);
  function toggle(w){ const lc=w.toLowerCase(); setKnown(prev=>{ const n=new Set(prev); n.has(lc)?n.delete(lc):n.add(lc); return n; }); }
  return (<div>
    <div className="eyebrow">{t.diagnosis.readEyebrow}</div><h2>{t.diagnosis.readTitle}</h2>
    <Teacher>{t.diagnosis.readTeacher}</Teacher>
    <div className="card card-p" style={{marginBottom:14}}>
      <h3 className="lbl">{t.diagnosis.readTextLbl(matLevel)}</h3>
      <div style={{lineHeight:1.85,fontSize:15,whiteSpace:"pre-wrap",maxHeight:220,overflowY:"auto"}}>{src}</div>
    </div>
    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
        <h3 className="lbl" style={{margin:0}}>{t.diagnosis.readWordsLbl}</h3>
        <span className="tiny muted">{t.diagnosis.coverage}: <b>{coverage}%</b></span></div>
      {annotations.length===0
        ? <div className="tiny muted">{t.diagnosis.gradingWords}</div>
        : <div className="row wrap" style={{gap:8}}>{annotations.map((g,i)=>{ const w=g.surface||g.lemma; const on=known.has((g.lemma||w).toLowerCase());
            return <button key={(g.lemma||w)+i} className={"vchip focusable"+(on?" known":"")} onClick={()=>toggle(g.lemma||w)}>
              <span className="box">✓</span>{w}<span className="badge badge-outline" style={{padding:"0 5px"}}>{g.cefr}</span></button>; })}</div>}
      <div className="tiny muted" style={{marginTop:14}}>{t.diagnosis.readNote}</div>
    </div>
  </div>);
}

// Step 2 — Blind listening: full audio, no text, a single 4-tier tap.
function BlindListen({lesson,text,diag,setDiag}){
  const {t}=useUI();
  const {lang}=lesson;
  const tiers=t.diagnosis.tiers;
  return (<div>
    <div className="eyebrow">{t.diagnosis.listenEyebrow}</div><h2>{t.diagnosis.listenTitle}</h2>
    <Teacher>{t.diagnosis.listenTeacher}</Teacher>
    <Purpose>{t.diagnosis.listenPurpose}</Purpose>
    <FullPlayer text={text} lang={lang} label={t.listen.player} sub={t.listen.sub}/>
    <div className="card card-p" style={{marginTop:18}}>
      <div style={{fontWeight:700,marginBottom:3}}>{t.diagnosis.catch}</div>
      <div className="tiny muted" style={{marginBottom:13}}>{t.diagnosis.catchHint}</div>
      <div className="tier-grid">
        {tiers.map((tr,i)=>(<button key={i} className={"tier focusable"+(diag.tier===i?" on":"")} data-fill={i+1} onClick={()=>setDiag(d=>({...d,tier:i}))}>
          <span className="tpct">{tr.pct}</span>
          <div className="bars"><i/><i/><i/><i/></div>
          <div className="tlabel">{tr.label}</div><div className="tdesc">{tr.desc}</div></button>))}
      </div>
    </div>
  </div>);
}

// Step 3 — Diagnosis matrix: reading × listening → one of 4 plain-language cases.
function diagnosisCase(coverage,tier){
  if(coverage!=null&&coverage<75) return "overload";
  if(tier!=null&&tier<=0) return "acoustic";
  if(coverage!=null&&coverage>=95&&tier!=null&&tier>=3) return "comfort";
  return "golden";
}
function DiagnosisMatrix({lesson,diag}){
  const {t}=useUI();
  const tiers=t.diagnosis.tiers;
  const cov=diag.coverage; const tier=diag.tier;
  const key=diagnosisCase(cov,tier);
  const c=t.diagnosis.cases[key];
  const cls=key==="overload"?"warn":(key==="acoustic"||key==="comfort")?"info":"";
  const listenLabel=tier!=null?tiers[tier].label:"—";
  return (<div>
    <div className="eyebrow">{t.diagnosis.diagEyebrow}</div><h2>{t.diagnosis.diagTitle}</h2>
    <div className="row wrap" style={{gap:12,margin:"6px 0 16px"}}>
      <div className="mini-metric"><div className="k">{t.diagnosis.reading}</div><div className="v">{cov!=null?cov+"%":"—"}</div><div className="tiny muted" style={{marginTop:2}}>{t.diagnosis.ofWords}</div></div>
      <div className="mini-metric"><div className="k">{t.diagnosis.listening}</div><div className="v">{listenLabel}</div><div className="tiny muted" style={{marginTop:2}}>{tier!=null?t.diagnosis.byEar(tiers[tier].pct):t.diagnosis.tapFirst}</div></div>
    </div>
    <div className={"diag-card "+cls}>
      <div className="row" style={{gap:11}}><span style={{fontSize:26}}>{c.emoji}</span>
        <span><div className="tiny muted" style={{fontWeight:700,textTransform:"uppercase",letterSpacing:".05em"}}>{c.kicker}</div>
        <div className="diag-name">{c.name}</div></span></div>
      <div style={{fontSize:14,lineHeight:1.55}}>{c.body}</div>
      <div style={{background:"hsl(var(--background)/.6)",borderRadius:8,padding:"11px 13px",fontSize:14}}>{c.tip}</div>
    </div>
  </div>);
}

/* ---------- step 5 grammar: one sentence at a time, then a summary card ---------- */
function GrammarStep({lesson,onComplete}){
  const {t,uiLang}=useUI();
  const {lang,sents,vocab,vlist,level,recommended}=lesson;
  const N=sents.length;
  const [gi,setGi]=useState(0); const [view,setView]=useState("study"); // study | summary
  const [expl,setExpl]=useState({});     // word(lc) -> {meaning, example, pos} from AI
  const [loadingKw,setLoadingKw]=useState(false);
  const [trs,setTrs]=useState({});
  const [loadingTr,setLoadingTr]=useState(false);
  const [grammar,setGrammar]=useState({});
  const [loadingGrammar,setLoadingGrammar]=useState(false);
  const lookupElapsed=useElapsed(loadingKw);
  useEffect(()=>{ if(gi>=N-1 && onComplete) onComplete(); },[gi,N]);
  useEffect(()=>{ setTrs({}); setGrammar({}); },[uiLang]);
  const vmap=Object.fromEntries((vocab||[]).map(v=>[v.word.toLowerCase(),v]));
  // Salient words to unpack: vocab words first, then longer words.
  function seenWordsBefore(index){ return new Set(sents.slice(0,index).flatMap(x=>words(x)).map(w=>w.toLowerCase())); }
  function keyWordsIn(s,index=gi){ const seen=seenWordsBefore(index);
    const ws=[...new Set(words(s))].filter(w=>w.length>3&&!STOP.has(w.toLowerCase())&&!seen.has(w.toLowerCase()));
    ws.sort((a,b)=>{
      const av=vmap[a.toLowerCase()]?20:0, bv=vmap[b.toLowerCase()]?20:0;
      return (bv+b.length)-(av+a.length);
    });
    return ws.slice(0,6); }
  // Ask the AI to translate the current sentence when this step needs it.
  useEffect(()=>{ let cancel=false;
    const sen=sents[gi]||"";
    const existing=uiLang==="en" ? (lesson.watch||[]).find(x=>x.s===sen)?.tr : null;
    if(existing){ setTrs(prev=>prev[gi]?prev:{...prev,[gi]:existing}); return; }
    if(trs[gi] || !sen){ setLoadingTr(false); return; }
    setLoadingTr(true);
    cachedAiAnalyze("translate",{sentences:[sen],lang,level,translationLanguage:uiLang==="zh"?"Chinese":"English"}).then(d=>{
      if(cancel) return; setLoadingTr(false);
      const tr=d&&Array.isArray(d.translations)?d.translations[0]:null;
      if(tr) setTrs(prev=>({...prev,[gi]:tr}));
    });
    return ()=>{cancel=true;};
  },[gi,uiLang,trs[gi]]);
  // Ask the AI to explain this sentence's key words in context (meaning + example).
  useEffect(()=>{ let cancel=false;
    const sen=sents[gi]||""; const kws=keyWordsIn(sen,gi).filter(w=>!expl[w.toLowerCase()]);
    if(!kws.length){ setLoadingKw(false); return; }
    setLoadingKw(true);
    cachedAiAnalyze("explain",{lang,level,items:kws.map(w=>({word:w,context:sen})),explanationLanguage:uiLang==="zh"?"Chinese":"English"}).then(d=>{
      if(cancel) return; setLoadingKw(false);
      if(d&&Array.isArray(d.items)){ setExpl(prev=>{ const n={...prev};
        d.items.forEach(it=>{ if(it&&it.word) n[String(it.word).toLowerCase()]={meaning:it.meaning||null,simpleMeaning:it.simpleMeaning||null,detail:it.detail||null,example:it.example||null,exampleTranslation:it.exampleTranslation||null,pos:it.pos||null}; });
        kws.forEach(w=>{ const k=w.toLowerCase(); if(!n[k]) n[k]={simpleMeaning:w,detail:null,example:null,pos:null}; });
        return n; }); }
      else setExpl(prev=>{ const n={...prev}; kws.forEach(w=>{ const k=w.toLowerCase(); if(!n[k]) n[k]={simpleMeaning:w,detail:null,example:null,pos:null}; }); return n; });
    });
    return ()=>{cancel=true;};
  },[gi,view]);
  useEffect(()=>{ let cancel=false;
    const sen=sents[gi]||"";
    if(grammar[gi] || !sen){ setLoadingGrammar(false); return; }
    setLoadingGrammar(true);
    const covered=Object.values(grammar).flat().map(g=>g&&g.point).filter(Boolean);
    cachedAiAnalyze("grammar",{lang,level,sentence:sen,translation:trs[gi]||null,covered,feedbackLanguage:uiLang==="zh"?"Chinese":"English"}).then(d=>{
      if(cancel) return; setLoadingGrammar(false);
      const prior=new Set(Object.entries(grammar).filter(([k])=>Number(k)<gi).flatMap(([,items])=>(items||[]).map(g=>normalizePoint(g.point))));
      const raw=d&&Array.isArray(d.items)&&d.items.length?d.items:fallbackGrammarItems(sen,level,uiLang);
      const items=raw.filter(g=>!prior.has(normalizePoint(g.point))).slice(0,2);
      setGrammar(prev=>({...prev,[gi]:items}));
    });
    return ()=>{cancel=true;};
  },[gi,trs[gi],uiLang]);
  function usageNote(w){ return loadingKw ? t.lookingUpWord : t.studyUsage; }
  const s=sents[gi]||""; const tr=trs[gi]; const kw=keyWordsIn(s,gi); const grammarItems=grammar[gi]||fallbackGrammarItems(s,level,uiLang);
  const studyWords=(()=>{ const seen=new Set(), out=[];
    const focusWords=(lesson.focus&&Array.isArray(lesson.focus.vocab)?lesson.focus.vocab.map(x=>x.word).filter(Boolean):[]);
    focusWords.forEach(w=>{ const k=String(w).toLowerCase(); if(!seen.has(k)){seen.add(k); out.push(w);} });
    sents.slice(0,N).forEach((sen,i)=>keyWordsIn(sen,i).forEach(w=>{ const k=w.toLowerCase(); if(!seen.has(k)&&expl[k]){seen.add(k); out.push(w);} }));
    return out;
  })();
  const allGrammarItems=(()=>{ const seen=new Set(), out=[];
    sents.slice(0,N).forEach((sen,i)=>{
      const items=grammar[i]||fallbackGrammarItems(sen,level,uiLang);
      items.forEach(g=>{ const k=(g.point||"")+"|"+(g.explain||""); if(!seen.has(k)){seen.add(k); out.push(g);} });
    });
    return out;
  })();
  const lookupEstimate=Math.max(6,kw.length*2+2);
  const lookupRemaining=Math.max(1,lookupEstimate-lookupElapsed);

  if(view==="summary") return (<div>
    <div className="eyebrow">{t.stepPhases[2]}</div><h2>{t.gram.summaryTitle}</h2>
    <Teacher>{t.gram.summaryTeacher}</Teacher>
    <div className="summary-stack">
      <h3 className="lbl">{t.gram.allVocab}</h3>
      {studyWords.map((w,j)=>{ const base=vmap[w.toLowerCase()]||vocab.find(v=>v.word.toLowerCase()===w.toLowerCase()); const e=displayWordInfo(w,lang,uiLang,base,expl[w.toLowerCase()]); const parts=meaningParts(e); return (
        <details className="summary-card" key={w}>
          <summary>
            <span className="row" style={{gap:9}}><b>{w}</b><span className="badge badge-outline">{(e&&e.pos)||POS[j%POS.length]}</span></span>
            <span className="row" style={{gap:8}}><span className="meaning-simple inline">{parts.simple||w}</span><Say text={w} lang={lang}/></span>
          </summary>
          {parts.detail && <div className="summary-detail">{parts.detail}</div>}
          {e&&e.example && <div className="word-example">“{e.example}”</div>}
          {e&&e.example&&e.exampleTranslation && <div className="word-example-translation">→ {e.exampleTranslation}</div>}
        </details>
      ); })}
      <h3 className="lbl" style={{marginTop:16}}>{t.gram.patterns}</h3>
      {allGrammarItems.map((g,j)=><div className="grammar-card" key={j}>
        <b>{g.point||t.gram.wordOrder}</b>
        <p>{g.explain}</p>
        <div className="grammar-examples">
          {grammarExamples(g).map((ex,k)=><div className="grammar-example-row" key={k}>
            <div className="row" style={{justifyContent:"space-between",gap:8}}>
              <span className="grammar-example">{ex.sentence}</span><Say text={ex.sentence} lang={lang}/>
            </div>
            {ex.translation && <div className="grammar-example-translation">→ {ex.translation}</div>}
          </div>)}
        </div>
      </div>)}
    </div>
    <CheckIn>{t.gram.summaryCheck}</CheckIn>
    <div style={{marginTop:14}}><button className="btn btn-outline btn-sm" onClick={()=>{setGi(0);setView("study");}}>↩ {t.gram.review}</button></div>
  </div>);

  return (<div>
    <div className="eyebrow">{t.stepPhases[2]}</div><h2>{t.gram.title}</h2>
    <Teacher>{t.gram.teacher}</Teacher>
    <Purpose>{t.gram.purpose}</Purpose>

    <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
      <span className="badge badge-outline">{t.gram.sentence(gi+1,N)}</span>
      <div className="track" style={{width:160}}><span style={{width:((gi+1)/N*100)+"%"}}/></div>
    </div>

    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontWeight:600,fontSize:16}}>{s}</span><Say text={s} lang={lang} rate={1} voiceRole={voiceRoleForLine(s,gi,sents)}/></div>
      <div className={"translation-line grammar-translation"+(!tr&&loadingTr?" loading":"")}>
        {tr?("→ "+tr):(loadingTr?`→ ${t.lineTranslating(gi+1,N)}`:`→ ${t.translationUnavailable}`)}
      </div>

      <h3 className="lbl">{t.vocabulary}</h3>
      {loadingKw && <div className="status-strip compact" style={{marginBottom:12}}>
        <div className="row" style={{justifyContent:"space-between",alignItems:"baseline"}}>
          <b>{t.lookingUpTitle}</b><span className="tiny muted">{t.aboutRemaining(lookupRemaining)}</span>
        </div>
        <div className="mini-track"><span style={{width:progressPct(lookupElapsed,lookupEstimate)+"%"}}/></div>
      </div>}
      {kw.length?kw.map((w,j)=>{ const e=displayWordInfo(w,lang,uiLang,vmap[w.toLowerCase()],expl[w.toLowerCase()]); const parts=meaningParts(e); return (<div className="wcard" key={j}>
        <div className="row" style={{justifyContent:"space-between"}}>
          <span className="row" style={{gap:9}}><b style={{fontSize:15}}>{w}</b><span className="badge badge-outline">{(e&&e.pos)||POS[j%POS.length]}</span></span>
          <Say text={w} lang={lang} rate={1}/></div>
        {parts.simple ? (<div className="meaning-block">
          <div className="meaning-simple">{parts.simple}</div>
        </div>) : (<div className="meaning-loading">
          <div className="skeleton short"/><div className="skeleton"/>
          <div className="tiny muted" style={{marginTop:7}}>💡 {usageNote(w)}</div>
        </div>)}
        {e&&e.example && <div className="word-example">“{e.example}”</div>}
        {e&&e.example&&e.exampleTranslation && <div className="word-example-translation">→ {e.exampleTranslation}</div>}
      </div>); }):<div className="tiny muted">{t.gram.noWords}</div>}

      <h3 className="lbl" style={{marginTop:16}}>{t.gram.grammarCoach}</h3>
      {loadingGrammar && <div className="tiny muted" style={{marginBottom:8}}>{t.gram.grammarLoading}</div>}
      {grammarItems.length?grammarItems.map((g,j)=><div className="grammar-card" key={j}>
        <div className="row" style={{justifyContent:"space-between",alignItems:"flex-start"}}>
          <div><b>{g.point||t.gram.wordOrder}</b><p>{g.explain}</p></div>
        </div>
        <div className="grammar-examples">
          {grammarExamples(g).map((ex,k)=><div className="grammar-example-row" key={k}>
            <div className="row" style={{justifyContent:"space-between",gap:8}}>
              <span className="grammar-example">{ex.sentence}</span><Say text={ex.sentence} lang={lang} rate={1}/>
            </div>
            {ex.translation && <div className="grammar-example-translation">→ {ex.translation}</div>}
          </div>)}
        </div>
      </div>):<div className="tiny muted">{t.gram.noWords}</div>}
    </div>

    <div className="row" style={{justifyContent:"space-between",marginTop:16}}>
      <button className="btn btn-ghost btn-sm" disabled={gi===0} onClick={()=>setGi(g=>g-1)}>← {t.gram.previous}</button>
      {gi<N-1 ? <button className="btn btn-outline btn-sm" onClick={()=>setGi(g=>g+1)}>{t.gram.next} →</button>
        : <button className="btn btn-primary btn-sm" onClick={()=>setView("summary")}>{t.gram.seeSummary} →</button>}
    </div>
    <div className="tiny muted" style={{textAlign:"center",marginTop:10}}>{t.gram.sentence(gi+1,N)}</div>
  </div>);
}

/* ---------- shadowing practice: each line auto-plays, learner reads along ---------- */
function TimedPractice({sents,lang,withSubs}){
  const {t}=useUI();
  const list=sents;
  const [started,setStarted]=useState(false);
  const [idx,setIdx]=useState(0);
  const [done,setDone]=useState(false);
  const [reveal,setReveal]=useState(withSubs);
  const cur=list[idx]||"";
  const phaseIndex=withSubs?3:4;
  const lastPlayed=useRef(-1);

  useEffect(()=>{ setStarted(false); setIdx(0); setDone(false); setReveal(withSubs); lastPlayed.current=-1; stopSpeak(); },[withSubs,list.length]);
  useEffect(()=>()=>stopSpeak(),[]);

  function playLine(rate=1){
    const role=voiceRoleForLine(cur,idx,list);
    speak(role?spokenTextForLine(cur):cur,lang,rate,role);
  }
  // Auto-play the current line whenever we land on a new sentence.
  useEffect(()=>{ if(!started||done) return; if(lastPlayed.current===idx) return;
    lastPlayed.current=idx; setReveal(withSubs);
    const role=voiceRoleForLine(cur,idx,list);
    speak(role?spokenTextForLine(cur):cur,lang,1,role);
  },[started,idx,done]);

  function begin(){ stopSpeak(); setStarted(true); setIdx(0); setDone(false); setReveal(withSubs); lastPlayed.current=-1; scrollToTop(); }
  function goPrev(){ if(idx===0) return; stopSpeak(); setIdx(i=>Math.max(0,i-1)); scrollToTop(); }
  function goNext(){ stopSpeak(); if(idx<list.length-1){ setIdx(i=>i+1); scrollToTop(); } else setDone(true); }

  const head=(<><div className="eyebrow">{t.stepPhases[phaseIndex]}</div><h2>{t.timed.title(withSubs)}</h2></>);

  if(!started) return (<div>{head}
    <Teacher>{withSubs?t.timed.teacherSubs:t.timed.teacherNoSubs}</Teacher>
    <Purpose>{t.timed.purpose}</Purpose>
    <div className="card card-p" style={{marginBottom:16}}>
      <div style={{fontWeight:500,marginBottom:6}}>{t.timed.how}</div>
      <ul className="clean tiny muted">{t.timed.tips.map((tip,i)=><li key={i}>{tip}</li>)}</ul>
    </div>
    <button className="btn btn-primary" onClick={begin}>▶ {t.timed.ready}</button>
    <div className="tiny muted" style={{marginTop:10}}>{t.timed.breath}</div>
  </div>);

  if(done) return (<div>{head}
    <div className="card bigcard"><div style={{fontSize:34}}>✓</div>
      <div className="bigsent" style={{fontSize:18}}>{t.timed.done(list.length)}</div>
      <button className="btn btn-outline btn-sm" onClick={begin}>↺ {t.timed.again}</button></div>
    <CheckIn>{t.timed.doneCheck}</CheckIn>
  </div>);

  return (<div>{head}
    <div className="card bigcard">
      <div className="row" style={{gap:8}}><span className="badge badge-outline">{idx+1} / {list.length}</span>
        <span className="phaselab" style={{color:"hsl(var(--success))"}}>🗣️ {t.timed.shadow}</span></div>
      {(withSubs||reveal) ? <div className="bigsent">{cur}</div> : <div className="bigsent muted" style={{opacity:.4}}>• • •</div>}
      {!withSubs && <button className="btn btn-outline btn-sm" onClick={()=>setReveal(r=>!r)}>{reveal?t.timed.hide:t.timed.reveal}</button>}
    </div>
    <div className="row" style={{justifyContent:"center",gap:8,marginTop:16}}>
      <button className="btn btn-ghost btn-sm" disabled={idx===0} onClick={goPrev}>← {t.back}</button>
      <button className="btn btn-outline btn-sm" onClick={()=>playLine(1)}>▶ {t.timed.replay}</button>
      <button className="btn btn-outline btn-sm" onClick={()=>playLine(.75)}>▶ {t.timed.slow} 0.75×</button>
      <button className="btn btn-primary btn-sm" onClick={goNext}>{idx<list.length-1?`${t.timed.next} →`:`${t.timed.finishRound} ✓`}</button>
    </div>
  </div>);
}

function RecallStep({lesson,onComplete}){
  const {t,uiLang}=useUI();
  const {lang,level,sents,focus}=lesson;
  const chosen=(focus&&Array.isArray(focus.recallSentences)&&focus.recallSentences.length?focus.recallSentences:sents.filter(s=>s.length<180)).slice(0,10);
  const list=chosen.length?chosen:sents.slice(0,Math.min(10,sents.length));
  const [idx,setIdx]=useState(0);
  const [answers,setAnswers]=useState(()=>DB.get("recallAnswers",{}));
  const [shown,setShown]=useState(()=>DB.get("recallShown",{}));
  const [trs,setTrs]=useState({});
  const [loading,setLoading]=useState(false);
  const [listening,setListening]=useState(false);
  const recRef=useRef(null);
  const cur=list[idx]||"";
  const doneCount=Object.keys(shown).filter(k=>shown[k]).length;
  useEffect(()=>{ DB.set("recallAnswers",answers); },[answers]);
  useEffect(()=>{ DB.set("recallShown",shown); if(doneCount>=list.length&&onComplete) onComplete(); },[shown,doneCount,list.length]);
  useEffect(()=>{ let cancel=false;
    const missing=list.map((s,i)=>({s,i})).filter(x=>!trs[x.i]);
    if(!missing.length) return;
    setLoading(true);
    cachedAiAnalyze("translate",{sentences:missing.map(x=>x.s),lang,level,translationLanguage:"English"}).then(d=>{
      if(cancel) return; setLoading(false);
      if(d&&Array.isArray(d.translations)) setTrs(prev=>{ const next={...prev}; missing.forEach((m,i)=>{next[m.i]=d.translations[i]||m.s;}); return next; });
    });
    return ()=>{cancel=true;};
  },[list.length,uiLang]);
  const SR=typeof window!=="undefined" && (window.SpeechRecognition||window.webkitSpeechRecognition);
  function startMic(){ if(!SR) return; stopSpeak(); const r=new SR(); r.lang=LANG_CODE[lang]||"nl-NL"; r.interimResults=false; r.maxAlternatives=1;
    r.onresult=e=>setAnswers(a=>({...a,[idx]:((a[idx]||"")+" "+e.results[0][0].transcript).trim()}));
    r.onend=()=>setListening(false); r.onerror=()=>setListening(false); recRef.current=r; try{r.start();setListening(true);}catch(e){setListening(false);} }
  function stopMic(){ if(recRef.current){ try{recRef.current.stop();}catch(e){} recRef.current=null; } setListening(false); }
  useEffect(()=>()=>stopMic(),[]);
  const answer=(answers[idx]||"").trim();
  const canCheck=answer.split(/\s+/).filter(Boolean).length>=2;
  function check(){ if(!canCheck) return; setShown(s=>({...s,[idx]:true})); }
  function move(next){ stopMic(); setIdx(Math.max(0,Math.min(list.length-1,next))); }
  return (<div>
    <div className="eyebrow">{t.stepPhases[5]}</div><h2>{t.recall.title}</h2>
    <Teacher>{t.recall.teacher}</Teacher>
    <Purpose>{t.recall.purpose}</Purpose>
    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
        <span className="badge badge-outline">{t.recall.progress(idx+1,list.length)}</span>
        <div className="track" style={{width:160}}><span style={{width:((doneCount||0)/Math.max(1,list.length)*100)+"%"}}/></div>
      </div>
      <h3 className="lbl">{t.recall.englishCue}</h3>
      <div className="translation-line" style={{marginBottom:16}}>{loading&&!trs[idx]?t.translatingTitle:trs[idx]}</div>
      <h3 className="lbl">{t.recall.yourDutch}</h3>
      <textarea style={{minHeight:88}} value={answers[idx]||""} onChange={e=>setAnswers(a=>({...a,[idx]:e.target.value}))} placeholder={t.recall.placeholder}/>
      <div className="row" style={{justifyContent:"space-between",marginTop:12}}>
        {SR ? <button className={"btn btn-sm "+(listening?"btn-primary":"btn-outline")} onClick={listening?stopMic:startMic}>🎤 {t.recall.speak}</button> : <span className="tiny muted">{t.recall.tryFirst}</span>}
        <button className="btn btn-primary btn-sm" disabled={!canCheck} onClick={check}>{t.recall.check}</button>
      </div>
      {shown[idx] && <div className="card card-p" style={{marginTop:14,background:"hsl(var(--secondary))"}}>
        <h3 className="lbl">{t.recall.original}</h3>
        <div style={{fontWeight:600}}>{cur}</div>
        <div style={{marginTop:10}}><Say text={cur} lang={lang} rate={1} voiceRole={voiceRoleForLine(cur,idx,list)}/></div>
      </div>}
    </div>
    <div className="row" style={{justifyContent:"space-between",marginTop:16}}>
      <button className="btn btn-ghost btn-sm" disabled={idx===0} onClick={()=>move(idx-1)}>← {t.back}</button>
      <span className="tiny muted">{doneCount>=list.length?t.recall.done:t.recall.tryFirst}</span>
      <button className="btn btn-outline btn-sm" disabled={idx>=list.length-1} onClick={()=>move(idx+1)}>{t.next} →</button>
    </div>
  </div>);
}

/* ---------- step 10 Practice with AI: tabbed Part 1 / Part 2 ---------- */
function PracticeAI({lesson,onComplete}){
  const {t}=useUI();
  const [tab,setTab]=useState("write");
  const [wrote,setWrote]=useState(false); const [talked,setTalked]=useState(false);
  useEffect(()=>{ if(wrote&&talked&&onComplete) onComplete(); },[wrote,talked]);
  return (<div>
    <div className="eyebrow">{t.stepPhases[6]}</div><h2>{t.aiUse.title}</h2>
    <Teacher>{t.aiUse.teacher}</Teacher>
    <Purpose>{t.aiUse.purpose}</Purpose>
    <div className="tabs">
      <button className={"tab"+(tab==="write"?" on":"")} onClick={()=>setTab("write")}>{t.aiUse.writeTab} {wrote?"✓":""}</button>
      <button className={"tab"+(tab==="chat"?" on":"")} onClick={()=>{stopSpeak();setTab("chat");}}>{t.aiUse.chatTab} {talked?"✓":""}</button>
    </div>
    {tab==="write" ? <AIWrite lesson={lesson} onNext={()=>setTab("chat")} onDone={()=>setWrote(true)}/> : <AIChat lesson={lesson} onDone={()=>setTalked(true)}/>}
    <div className="tiny muted" style={{marginTop:12}}>{t.aiUse.unlock}</div>
  </div>);
}
function AIWrite({lesson,onNext,onDone}){
  const {t,uiLang}=useUI();
  const {lang,level,vocab,sents,focus}=lesson;
  const focusWords=(focus&&Array.isArray(focus.vocab)?focus.vocab.map(x=>x.word).filter(Boolean):[]);
  const shownLang=langName(t,lang);
  const question=practiceQuestion(lesson,shownLang,uiLang);
  const [textv,setTextv]=useState(DB.get("aiPractice","")); const [fb,setFb]=useState(null); // null | "loading" | {real} | "mock"
  useEffect(()=>DB.set("aiPractice",textv),[textv]);
  async function getFeedback(){
    setFb("loading"); onDone&&onDone();
    try{
      const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"feedback",lang,level,question,text:textv.trim(),feedbackLanguage:uiLang==="zh"?"Chinese":"English"})});
      if(!r.ok) throw new Error("no api");
      const d=await r.json(); setFb(d);
    }catch(e){ setFb("mock"); }
  }
  const real=fb && fb!=="loading" && fb!=="mock";
  return (<div>
    <div className="row wrap" style={{gap:7,marginBottom:14}}>{(focusWords.length?focusWords:vocab.slice(0,8).map(v=>v.word)).slice(0,8).map(w=><span key={w} className="badge">{w}</span>)}</div>
    <div className="card card-p" style={{marginBottom:14}}><div className="row" style={{gap:10}}>
      <div className="tface">👩‍🏫</div><div style={{fontWeight:500}}>{question}</div></div></div>
    <textarea style={{minHeight:130}} value={textv} onChange={e=>setTextv(e.target.value)} placeholder={t.aiUse.writePlaceholder(shownLang)}/>
    <div className="row" style={{justifyContent:"space-between",marginTop:12}}>
      <span className="tiny muted">{t.aiUse.saved(textv.trim().split(/\s+/).filter(Boolean).length)}</span>
      <button className="btn btn-primary btn-sm" disabled={textv.trim().length<12||fb==="loading"} onClick={getFeedback}>{fb==="loading"?t.aiUse.reading:t.aiUse.feedback}</button></div>
    {fb==="loading" && <div className="card card-p" style={{marginTop:16}}>
      <div className="row" style={{gap:11}}><div className="tface pulse">👩‍🏫</div>
        <div><div style={{fontWeight:500}}>{t.aiUse.teacherReading}</div>
          <div className="tiny muted">{t.aiUse.checking}</div></div></div>
      <div className="track" style={{marginTop:12,overflow:"hidden"}}><span className="indet"/></div>
    </div>}
    {(real||fb==="mock") && (<div className="card card-p" style={{marginTop:16}}>
      <h3 className="lbl">{t.aiUse.feedbackTitle(!real)}</h3>
      {real ? (<>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.grammar}.</b> <span className="muted">{fb.grammar}</span></div>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.vocab}.</b> <span className="muted">{fb.vocabulary}</span></div>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.sentence}.</b> <span className="muted">{fb.sentence}</span></div>
        {fb.revision && <div style={{marginTop:10}}><b>{t.aiUse.revision}:</b><div className="card card-p" style={{marginTop:6,background:"hsl(var(--secondary))"}}>{fb.revision}</div></div>}
      </>) : (<>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.grammar}.</b> <span className="muted">{t.aiUse.mockGrammar}</span></div>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.vocab}.</b> <span className="muted">{t.aiUse.mockVocab}</span></div>
        <div style={{marginBottom:8}}>✅ <b>{t.aiUse.sentence}.</b> <span className="muted">{t.aiUse.mockSentence}</span></div>
        <div className="tiny muted" style={{marginTop:8}}>{t.aiUse.mockNote}</div>
      </>)}
      <div style={{marginTop:14}}><button className="btn btn-primary btn-sm" onClick={onNext}>{t.aiUse.nextTalk} →</button></div>
    </div>)}
  </div>);
}

function AIChat({lesson,onDone}){
  const {t,uiLang}=useUI();
  const {lang,level,vocab,topics,grammarFocus,sents,focus}=lesson;
  const shownLang=langName(t,lang);
  const focusWords=(focus&&Array.isArray(focus.vocab)?focus.vocab.map(x=>x.word).filter(Boolean):[]);
  const vwords=(focusWords.length?focusWords:vocab.map(v=>v.word)).slice(0,6);
  const topic=(topics&&topics.join(", "))||"the text";
  const grammar=(grammarFocus&&grammarFocus.join("; "))||"";
  const sample=(sents||[]).slice(0,8).join(" ");
  const partner=PARTNER[lang]||PARTNER._;
  const fallback=chatFallback(lang,vwords[0],sents[0]);
  const [msgs,setMsgs]=useState([]); const [draft,setDraft]=useState("");
  const [busy,setBusy]=useState(false); const [turns,setTurns]=useState(0);
  const [speaking,setSpeaking]=useState(false);
  const [done,setDone]=useState(false); const [evalz,setEvalz]=useState(null); const [listening,setListening]=useState(false);
  const mockRef=useRef(false); const recRef=useRef(null);
  const MAX_TURNS=5;

  // Speak an AI line and reflect the "talking / your turn" state so it feels live.
  function sayAI(line){ setSpeaking(true); const u=speak(line,lang); if(u){ u.onend=()=>setSpeaking(false); } else setSpeaking(false); }

  async function aiReply(history){
    try{ const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"chat",lang,level,vocab:vwords,topic,grammar,sample,history})});
      if(!r.ok) throw new Error("no api"); const d=await r.json(); return d.reply||null;
    }catch(e){ return null; }
  }
  useEffect(()=>{ (async()=>{
    setBusy(true);
    const reply=await aiReply([]);
    if(reply){ mockRef.current=false; setMsgs([{who:"ai",t:reply}]); sayAI(reply); }
    else { mockRef.current=true; setMsgs([{who:"ai",t:fallback[0]}]); sayAI(fallback[0]); }
    setBusy(false);
  })(); return ()=>{stopSpeak(); stopMic();}; },[]);

  const full=draft.trim().split(/\s+/).filter(Boolean).length>=3;
  function toHistory(list){ return list.map(m=>({role:m.who==="ai"?"assistant":"user",content:m.t})); }

  // voice input (speech-to-text) in the target language — Chrome/Edge support this
  const SR = typeof window!=="undefined" && (window.SpeechRecognition||window.webkitSpeechRecognition);
  function startMic(){ if(!SR) return; stopSpeak();
    const r=new SR(); r.lang=LANG_CODE[lang]||"en-US"; r.interimResults=false; r.maxAlternatives=1;
    r.onresult=(e)=>{ const t=e.results[0][0].transcript; setDraft(d=>(d?d+" ":"")+t); };
    r.onend=()=>setListening(false); r.onerror=()=>setListening(false);
    recRef.current=r; try{ r.start(); setListening(true); }catch(e){ setListening(false); } }
  function stopMic(){ if(recRef.current){ try{recRef.current.stop();}catch(e){} recRef.current=null; } setListening(false); }

  async function finish(list){ setDone(true); onDone&&onDone();
    if(mockRef.current) return;
    try{ const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({mode:"evaluate",lang,level,history:toHistory(list),feedbackLanguage:uiLang==="zh"?"Chinese":"English"})});
      if(r.ok) setEvalz(await r.json()); }catch(e){} }

  async function send(){ if(!full||busy) return; stopMic();
    const withMe=[...msgs,{who:"me",t:draft.trim()}]; const nx=turns+1;
    setMsgs(withMe); setDraft(""); setTurns(nx);
    if(nx>=MAX_TURNS){ finish(withMe); return; }
    if(mockRef.current){ const line=fallback[nx]||fallback[fallback.length-1]; setMsgs([...withMe,{who:"ai",t:line}]); sayAI(line); return; }
    setBusy(true);
    const reply=await aiReply(toHistory(withMe));
    const line=reply||"👍"; setMsgs([...withMe,{who:"ai",t:line}]); if(reply) sayAI(line);
    setBusy(false);
  }

  const lastAi=[...msgs].reverse().find(m=>m.who==="ai");
  return (<div>
    <div className="notice" style={{marginBottom:14}}><span>🗣️</span>
      <span>{t.chat.notice(partner.name,shownLang,MAX_TURNS)}</span></div>

    {/* the person you're talking with */}
    <div className="card card-p" style={{textAlign:"center",background:"hsl(var(--secondary))"}}>
      <div style={{fontSize:60,lineHeight:1,filter:speaking?"none":"grayscale(.15)"}}>{partner.face}</div>
      <div style={{fontWeight:700,marginTop:6}}>{partner.name}</div>
      <div className="tiny muted">{busy?"…"+t.chat.thinking:speaking?"🔊 "+t.chat.speaking+"…":t.chat.yourTurn}</div>
      {lastAi && <div style={{fontWeight:500,fontSize:17,margin:"12px auto 0",maxWidth:520}}>{lastAi.t}</div>}
      <div className="row" style={{gap:8,justifyContent:"center",marginTop:10}}>
        {lastAi && <button className="btn btn-outline btn-sm" onClick={()=>sayAI(lastAi.t)}>🔊 {t.chat.sayAgain}</button>}
        <span className="tiny muted">{t.chat.exchange(Math.min(turns+1,MAX_TURNS),MAX_TURNS)}</span>
      </div>
    </div>

    {!done ? (<div style={{marginTop:16}}>
      {/* voice-first reply */}
      {SR ? (<div style={{textAlign:"center"}}>
        <button className={"btn "+(listening?"btn-primary":"btn-outline")} style={{fontSize:17,padding:"14px 26px",borderRadius:999}}
          onClick={listening?stopMic:startMic}>{listening?"● "+t.chat.listening:"🎤 "+t.chat.speakAnswer}</button>
        <div className="tiny muted" style={{marginTop:8}}>{t.chat.speakIn(shownLang)}</div>
      </div>) : <div className="tiny muted" style={{marginBottom:6}}>{t.chat.typeIn(shownLang)}</div>}
      <textarea style={{minHeight:56,marginTop:12}} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={t.chat.placeholder(shownLang)}/>
      <div className="row" style={{justifyContent:"space-between",marginTop:10}}>
        <span className="tiny muted">{full?t.chat.looksGood+" ✓":t.chat.shortSentence}</span>
        <button className="btn btn-primary btn-sm" disabled={!full||busy} onClick={send}>{t.chat.replyTo(partner.name)} →</button></div>

      {/* transcript, tucked below so it feels like a conversation, not a chat log */}
      {msgs.length>1 && <details style={{marginTop:14}}><summary className="tiny muted" style={{cursor:"pointer"}}>{t.chat.showTranscript}</summary>
        <div className="chat" style={{marginTop:8}}>{msgs.map((m,i)=>(<div key={i} className={"bubble "+m.who}>{m.t}</div>))}</div></details>}
    </div>) : (<div className="card card-p" style={{marginTop:14,background:"hsl(var(--secondary))"}}>
        <h3 className="lbl">{t.chat.feedbackTitle(!evalz)}</h3>
        {evalz ? (<div>
          <div style={{marginBottom:8}}>🎉 {evalz.praise}</div>
          <div style={{marginBottom:6}}>✅ <b>{t.aiUse.grammar}.</b> <span className="muted">{evalz.grammar}</span></div>
          <div style={{marginBottom:6}}>✅ <b>{t.aiUse.vocab}.</b> <span className="muted">{evalz.vocabulary}</span></div>
          <div>✅ <b>{t.chat.fluency}.</b> <span className="muted">{evalz.fluency}</span></div>
        </div>) : (<div className="muted">{t.chat.mockDone(shownLang)}</div>)}
      </div>)}
  </div>);
}

/* ---------- celebration ---------- */
// Clean celebration — no before/after slider (kept intentionally minimal).
function Done({lesson,diag,onNew,onReview}){
  const {t}=useUI();
  const name=(DB.get("email","")||"").split("@")[0]||t.done.friend;
  const fromDiag=(diag&&Array.isArray(diag.unknown)&&diag.unknown.length)?diag.unknown:null;
  const fromFocus=(lesson.focus&&Array.isArray(lesson.focus.vocab))?lesson.focus.vocab.map(v=>v.word):[];
  const wordList=(fromDiag||(fromFocus.length?fromFocus:(lesson.vlist||[]))).filter(Boolean).slice(0,6);
  return (<div className="done-wrap">
    <div className="done-emoji">🎉</div>
    <h1 className="done-h1">{t.done.title(name)}</h1>
    <p className="done-sub">{t.done.sub(STEPS.length)}</p>
    <div className="done-card">
      <div className="done-card-emoji">📚✨</div>
      <div className="done-card-title">{t.celebrate.explored(wordList.length)}</div>
      <div className="done-chips">{wordList.map(w=><span className="done-chip" key={w}>{w}</span>)}</div>
      <p className="done-card-note">{t.done.more}</p>
    </div>
    <div className="done-actions">
      <button className="btn btn-outline focusable" onClick={onReview}><Svg n="recall"/> {t.done.review}</button>
      <button className="btn btn-primary focusable" onClick={onNew}>{t.done.new} →</button>
    </div>
  </div>);
}

/* ---------- left path panel (sidebar) ---------- */
function Sidebar({mode,lesson,step,doneSet,openMod,setOpenMod,go,onBackHome}){
  const {t}=useUI();
  const progress=mode==="done"?100:Math.round(doneSet.size/STEPS.length*100);
  const ctx=mode==="home"||!lesson ? t.nav.ctx : t.nav.ctxSession(langName(t,lesson.lang),(lesson.level||"").split(" — ")[0]);
  return (<aside className="sidebar">
    <div className="side-head">
      <div className="side-head-row"><Brand/></div>
      <div className="ctx">{ctx}</div>
      <div className="side-progress" style={{visibility:(mode==="session"||mode==="done")?"visible":"hidden"}}>
        <div className="prog"><span style={{width:progress+"%"}}/></div></div>
    </div>
    <nav className="side-nav" aria-label="Learning modules">
      {MODULES.map(m=>{
        const steps=STEPS.filter(s=>s.mod===m.id);
        const isOpen=openMod===m.id;
        const hasActive=mode==="session"&&STEPS[step]&&STEPS[step].mod===m.id;
        return (<div className="nav-group" key={m.id}>
          <button className="group-trigger focusable" data-hasactive={hasActive} aria-expanded={isOpen}
            onClick={()=>setOpenMod(isOpen?null:m.id)}>
            <span className="gicon"><Svg n={m.icon}/></span>
            <span className="gname">{t.nav.mods[m.id]}</span></button>
          <div className={"group-content"+(isOpen?" open":"")}><div className="inner"><div className="inner-lines">
            {steps.map(s=>{
              const idx=stepIndex(s.id);
              const done=doneSet.has(s.id);
              const cur=mode!=="home"&&idx===step;
              const dis=mode==="home";
              return (<button key={s.id} className="navlink focusable" aria-current={cur} aria-disabled={dis}
                onClick={()=>{ if(!dis) go(s.id); }}>
                <span className={"nmk"+(done?" done":"")}>{done?<Svg n="check"/>:cur?"●":"·"}</span>
                <span>{t.nav.steps[s.id]}</span></button>);
            })}
          </div></div></div>
        </div>);
      })}
    </nav>
    <div className="side-foot">
      {mode!=="home"
        ? <button className="btn btn-outline btn-sm focusable" onClick={onBackHome} title={t.nav.backHome}><Svg n="home"/> {t.nav.backHome}</button>
        : <span className="tiny muted">{t.nav.previewHint}</span>}
    </div>
  </aside>);
}

/* ---------- root ---------- */
function App(){
  const [uiLang,setUiLangState]=useState(DB.get("uiLang","en"));
  const t=UI_TEXT[uiLang]||UI_TEXT.en;
  function setUiLang(next){ setUiLangState(next); DB.set("uiLang",next); }
  useEffect(()=>{ document.documentElement.lang=uiLang==="zh"?"zh-CN":"en"; },[uiLang]);
  const [screen,setScreen]=useState(DB.get("email")?"input":"login");
  const [lesson,setLesson]=useState(null); const [text,setText]=useState("");
  const [theme,setTheme]=useState(DB.get("theme","light"));
  const [pinned,setPinned]=useState(false);
  const [openMod,setOpenMod]=useState("diag");
  const [step,setStep]=useState(0);
  const [doneSet,setDoneSet]=useState(()=>new Set());
  const [diag,setDiag]=useState({coverage:null,tier:null,total:0,unknown:[]});
  const [narrow,setNarrow]=useState(false);
  const autoReveal=useRef(false); const revealTimer=useRef(null);
  const mode=screen==="lesson"?"session":screen==="done"?"done":"home";

  useEffect(()=>{ document.documentElement.classList.toggle("dark",theme==="dark"); },[theme]);
  useEffect(()=>{ stopSpeak(); scrollToTop(); },[screen]);
  useEffect(()=>{ const on=()=>setNarrow(window.innerWidth<1200); on(); window.addEventListener("resize",on); return ()=>window.removeEventListener("resize",on); },[]);

  function toggleTheme(){ setTheme(v=>{ const n=v==="dark"?"light":"dark"; DB.set("theme",n); return n; }); }
  function toggleSide(){ autoReveal.current=false; setPinned(p=>!p); }
  function clearAll(){ if(confirm(t.clearConfirm)){DB.clearAll();location.reload();} }

  // Briefly reveal the path panel on entering a session, then auto-collapse
  // unless the learner reached for it or pinned it.
  function revealThenCollapse(){
    clearTimeout(revealTimer.current);
    if(typeof window!=="undefined"&&window.innerWidth<1200){ setPinned(false); return; }
    autoReveal.current=true; setPinned(true);
    revealTimer.current=setTimeout(()=>{ if(autoReveal.current){ setPinned(false); autoReveal.current=false; } },2400);
  }
  function resetSession(){ setStep(0); setDoneSet(new Set()); setOpenMod("diag"); setDiag({coverage:null,tier:null,total:0,unknown:[]}); }
  function startSession(){ resetSession(); setScreen("lesson"); revealThenCollapse(); }
  function reviewSession(){ resetSession(); setScreen("lesson"); revealThenCollapse(); }
  function go(id){ const idx=stepIndex(id); if(idx<0) return; if(screen==="done") setScreen("lesson"); setStep(idx); setOpenMod(STEPS[idx].mod); if(window.innerWidth<1200) setPinned(false); scrollToTop(); }
  function onContinue(){ const cur=STEPS[step]; setDoneSet(prev=>new Set(prev).add(cur.id));
    if(step===STEPS.length-1){ setScreen("done"); } else { const n=step+1; setStep(n); setOpenMod(STEPS[n].mod); scrollToTop(); } }
  function onPrev(){ const n=Math.max(0,step-1); setStep(n); setOpenMod(STEPS[n].mod); scrollToTop(); }

  async function loadLesson(d){ setText(d.text); DB.set("recallAnswers",{}); DB.set("recallShown",{}); setScreen("loading");
    try{ const r=await fetch("/api/lesson",{method:"POST",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}); if(!r.ok) throw new Error("api"); const L=await r.json(); setLesson(L); setScreen("preview");
      cachedAiAnalyze("focus",{lang:L.lang,level:L.level,sentences:L.sents,vocab:(L.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"}).then(f=>{ if(f) setLesson(cur=>cur?{...cur,focus:f}:cur); });
    }
    catch(e){ const L=generateLesson(d.text,d.lang,d.level,d.goal,d.targetMin||null,d.material||null); setLesson(L); setScreen("preview");
      cachedAiAnalyze("focus",{lang:L.lang,level:L.level,sentences:L.sents,vocab:(L.vocab||[]).map(v=>v.word),feedbackLanguage:uiLang==="zh"?"Chinese":"English"}).then(f=>{ if(f) setLesson(cur=>cur?{...cur,focus:f}:cur); });
    } }

  if(screen==="login") return (<UIContext.Provider value={{uiLang,setUiLang,t}}>
    <main className="main"><Login onDone={()=>setScreen("input")}/></main></UIContext.Provider>);

  return (<UIContext.Provider value={{uiLang,setUiLang,t}}>
    <div className={"shell"+(pinned?" pinned":"")}>
      <div className="path-anchor">
        <div className="chrome-row">
          <button className="bar-toggle focusable" onClick={toggleSide} aria-pressed={pinned} aria-label="Show or hide the learning path"><Svg n={pinned?"panelClose":"panel"}/></button>
          <label className="chrome-select" title={t.interfaceLanguage}><Svg n="globe"/>
            <select value={uiLang} onChange={e=>setUiLang(e.target.value)} aria-label={t.interfaceLanguage}>
              <option value="en">EN</option><option value="zh">中文</option></select></label>
          <button className="chrome-btn focusable" onClick={toggleTheme} title="Toggle light / dark" aria-label="Toggle light / dark">{theme==="dark"?"☀️":"🌙"}</button>
          <button className="chrome-btn focusable" onClick={clearAll} title={t.clearLocalData} aria-label={t.clearLocalData}><Svg n="trash"/></button>
        </div>
        <Sidebar mode={mode} lesson={lesson} step={step} doneSet={doneSet} openMod={openMod} setOpenMod={setOpenMod} go={go} onBackHome={()=>setScreen("input")}/>
      </div>
      <main className="main">
        {screen==="loading" && <Loading/>}
        {screen==="input" && <InputScreen onNext={loadLesson}/>}
        {screen==="preview" && lesson && <Preview lesson={lesson} text={text} onBack={()=>setScreen("input")} onStart={startSession}/>}
        {screen==="lesson" && lesson && <SessionView lesson={lesson} text={text} step={step} onPrev={onPrev} onContinue={onContinue} diag={diag} setDiag={setDiag}/>}
        {screen==="done" && lesson && <Done lesson={lesson} diag={diag} onNew={()=>setScreen("input")} onReview={reviewSession}/>}
      </main>
    </div>
    <div className={"scrim"+((pinned&&narrow)?" on":"")} onClick={()=>setPinned(false)}/>
  </UIContext.Provider>);
}
export default function Page(){ return <App/>; }
