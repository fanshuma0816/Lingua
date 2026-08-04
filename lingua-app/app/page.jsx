"use client";
import { useState, useEffect, useRef, createContext, useContext } from "react";



const DB={ get(k,d){try{return JSON.parse(localStorage.getItem("lingua:"+k))??d}catch(e){return d}},
  set(k,v){localStorage.setItem("lingua:"+k,JSON.stringify(v))},
  clearAll(){Object.keys(localStorage).filter(x=>x.startsWith("lingua:")).forEach(x=>localStorage.removeItem(x))} };

const UI_TEXT={
  en:{
    interfaceLanguage:"Interface language", english:"English", chinese:"中文", clearLocalData:"Clear local data", clearConfirm:"Clear all local learning data (draft, notes, ratings, progress)?", newMaterial:"New material",
    continue:"Continue", previous:"Previous", back:"Back", next:"Next", finish:"Finish", exitSession:"Exit session", play:"Play", stop:"Stop", restart:"restart",
    playAll:"Play all · read along", syncHint:"Each line lights up as it's read · tap any line to replay",
    fullSourceAudio:"Full source audio", fullSourceRead:"Full-source read-aloud", audioUnsupported:"Audio not supported in this browser",
    buildingTitle:"Building your lesson…",
    buildingSteps:["Reading your text…","Splitting it into sentences…","Translating each line…","Finding the key words…","Writing fresh examples…","Preparing your quiz…","Almost ready…"],
    buildingNote:"A real AI is translating your text and writing the lesson — this usually takes 20–40 seconds. Thanks for your patience!",
    loginTitle:"Learn any language through content you love", loginSub:"Paste a text, transcript, or article excerpt, and it becomes a complete guided learning session.",
    email:"Email", noPassword:"No password needed for this test build. Your learning stays on this device.",
    inputTitle:"Bring your material", inputSub:"Paste text, or upload a .txt file. Best results: 1,000–3,000 characters with normal punctuation.",
    yourText:"Your text", uploadTxt:"Upload .txt", textPlaceholder:"Paste an article, podcast transcript, newsletter excerpt, dialogue…",
    cleanNote:"Timestamps, [Music] tags and extra breaks are cleaned automatically.", targetLanguage:"Target language *", select:"Select…",
    currentLevel:"Your current level", sessionGoal:"Session goal", overLimit:"Over the 2,000-character free limit — trim your text a little.",
    chooseTarget:"Choose your target language to continue.", analyzeText:"Analyze text",
    goals:["General fluency","Conversation & speaking","Reading comprehension","Vocabulary building","Exam preparation"],
    levels:["A1 — Beginner","A2 — Elementary","B1 — Intermediate","B2 — Upper-intermediate","C1 — Advanced"],
    previewTitle:"Here's your text", previewSub:"A quick read on your material before we begin.", topics:"Topics:",
    recommendedLevel:"Recommended level", estimatedTime:"Estimated time", vocabulary:"Vocabulary", characters:"Characters", chars:"chars",
    wordCount:(n)=>`${n} words`, diffLabels:["","Comfortable review","An easy read","Right at your level","A gentle stretch","Challenging"],
    difficultyForYou:"Difficulty for you", basedOnLevel:(a,b)=>`Based on your level (${a}) vs the text's (${b}).`,
    session:"The session", stepsInBlocks:(s,b)=>`${s} steps in ${b} blocks`, start:(m)=>`Start · ~${m} min`,
    planNames:["Learning","Grammar & Vocabulary","Testing","Practicing","Using"],
    planItems:[["Listen","Watch in your language","Listen & read"],["Sentence-by-sentence study"],["Comprehension check","Sentence recognition"],["With subtitles","No subtitles","Understand everything"],["Write & talk with AI"]],
    heavy:(n)=>`This one has ${n} new words — quite a few. For it to really stick, try each block at least twice, and don't be shy about repeating an earlier step if it feels heavy.`,
    stepPhases:["Learning","Learning","Learning","Testing","Grammar & Vocabulary","Testing","Practicing","Practicing","Practicing","Using"],
    stepTitles:["Listen","Watch · your language","Listen & Read","Comprehension check","Grammar & Vocabulary","Sentence recognition","Practice · with subtitles","Practice · no subtitles","Understand everything","Practice with AI"],
    stepOf:(n,total)=>`Step ${n} of ${total}`, min:(m)=>`~${m} min`,
    lockedGrammar:"Work through each sentence to unlock Continue.", lockedAI:"Get feedback in Part 1 and finish the Part 2 chat to unlock Finish.",
    translatingTitle:"Translating the lines", lookingUpTitle:"Looking up word meanings", aboutRemaining:(s)=>`about ${s}s left`, lineTranslating:(i,n)=>`Translating line ${i} of ${n}`, translationUnavailable:"translation unavailable",
    lookingUpWord:"Finding the short meaning and a quick detail…", studyUsage:"Study how it's used here, then try it in your own example.",
    simpleMeaning:"Simple meaning", detail:"More detail", example:"Example",
    quizLoading:"Writing a few questions about your text…", whichHeard:"Which sentence did you hear?", whichMatches:"Which sentence matches the text?",
    niceRight:"Nice — that's right.", notQuite:"Not quite — the highlighted one is it. Try replaying above.",
    selfLow:"0% · nothing yet", selfHigh:"100% · all of it",
    sr:{teacher:"Trust your ears. Play each line, then choose the sentence you heard.",purpose:"This sharpens the bridge between sound and meaning, one small decision at a time.",check:"Nailing these? Great ear. A few tricky? Replay and try once more — no rush."},
    understand:{teacher:(lang)=>`One last full listen. Play it through with ${lang} text — it should feel clear now.`,purpose:"You have met the meaning, the sound, and the useful patterns. This pass helps everything settle together.",check:"Feels clearer than the first time? That's your progress showing."},
    timed:{title:(subs)=>`Practice · ${subs?"with subtitles":"no subtitles"}`,teacherSubs:"Time to speak. I'll play each line, then it's your turn to read it aloud before the gentle timer moves you on.",teacherNoSubs:"Ears only now. I'll play each line — you repeat it from memory. Reveal the text only if you need to peek.",purpose:"Speaking full sentences gives your mouth a path to follow, so the language starts to feel usable.",how:"How this works",tips:["One sentence fills the screen — just focus on that.","Listen, then read aloud during the countdown.","It auto-advances, but Back, Replay and Pause are always there."],ready:"I'm ready — start",breath:"Take a breath first — it won't start until you press the button.",done:(n)=>`You practised all ${n} sentences. Press Continue when you're ready.`,again:"Practise again",doneCheck:"Said each one out loud? That's exactly it. Another round never hurts.",listen:"Listen",yourTurn:"Your turn — read aloud",hide:"Hide text",reveal:"Reveal text",replay:"Replay",pause:"Pause",resume:"Resume",skip:"Skip"},
    aiUse:{title:"Practice with AI",teacher:"Let's actually use it. First write a little, then have a short chat — all with today's words.",purpose:"This turns the lesson into something you can say back, gently and in context.",writeTab:"Part 1 · Write",chatTab:"Part 2 · Talk",unlock:"Finish unlocks once you've got feedback in Part 1 and completed the Part 2 chat.",feedback:"Get feedback",reading:"Reading…",teacherReading:"Your teacher is reading your writing…",checking:"Checking grammar, vocabulary and sentence flow — just a few seconds.",nextTalk:"Next · talk with the AI",writePlaceholder:(lang)=>`Write your answer in ${lang}…`,question:(topic,lang)=>`Based on the passage — "${topic}" — what's your view? Write 3–4 sentences in ${lang} using today's words.`,saved:(n)=>`${n} words · saved locally`,feedbackTitle:(sim)=>`Feedback & suggested revision${sim?" · simulated":""}`,grammar:"Grammar",vocab:"Vocabulary",sentence:"Sentence construction",revision:"Suggested revision",mockGrammar:"Tenses look consistent. Check subject–verb agreement in your longer sentence.",mockVocab:"Nice reuse of today's words — add one connective phrase to link ideas.",mockSentence:"Clear structure. Try varying sentence length to sound more natural.",mockNote:"Showing sample feedback — the live AI check didn't respond just now, so try again in a moment for specific notes and a corrected draft."},
    chat:{notice:(name,lang,n)=>`You're talking with ${name}, face to face, in ${lang}. ${name} speaks first — listen, then answer out loud or type. About ${n} exchanges.`,thinking:"thinking",speaking:"speaking",yourTurn:"listening — your turn",sayAgain:"Say it again",exchange:(n,total)=>`Exchange ${n} of ${total}`,listening:"Listening — tap when done",speakAnswer:"Hold the floor · speak your answer",speakIn:(lang)=>`Speak in ${lang}. Your words appear below — edit if you like, then reply.`,typeIn:(lang)=>`Type your reply in ${lang} below (voice input works in Chrome/Edge).`,placeholder:(lang)=>`Your reply in ${lang}…`,looksGood:"Looks good",shortSentence:"Say at least a short sentence",replyTo:(name)=>`Reply to ${name}`,showTranscript:"Show transcript",feedbackTitle:(sim)=>`Conversation feedback${sim?" · simulated":""}`,fluency:"Fluency",mockDone:(lang)=>`You held a voice exchange in ${lang} using today's words — exactly the goal.`},
    done:{friend:"friend",title:(name)=>`You did it, ${name}!`,sub:(n)=>`You stayed with it through all ${n} steps. Showing up and finishing is the hard part — and you just did.`,explored:(topics)=>`Today you explored ${topics}`,more:"Bring a few more texts and we'll start to see which topics you love most — and where you spend your time.",steps:"Steps",words:"Words",sentences:"Sentences",blocks:"Blocks",comp:"Your comprehension · before vs after",rate:"One more time — how much can you understand now?",reveal:"Reveal my progress",before:"Before",after:"After",gain:(d)=>`+${d}% understanding — look at you go!`,again:"A second pass will lift this — you've got it",take:"What you're taking with you",review:"Review this lesson",new:"Bring new material"},
    phraseNote:"A natural pairing worth keeping together — try reusing it in a sentence of your own.",
    refTitle:"Research basis", refText:"This flow is based on the Delft Method: understand a meaningful text first, absorb frequent words and grammar in context, then move toward conversation.", refSources:"Sources: Montens & Sciarone, Nederlands voor buitenlanders: de Delftse methode; TU Delft Centre for Languages.",
    grammarFocus:["Common tenses used in the passage","Word order & sentence position","Connective & opinion phrases"],
    listen:{teacher:"Let's just listen first. Play it once and let the sound wash over you — no need to catch every word.",purpose:"Your brain starts by noticing rhythm, familiar sounds, and the shape of the language before it has to explain anything.",player:"Complete material",sub:"Full audio · no subtitles",rate:"Before we dig in — how much can you understand right now?",check:"Caught the mood or a few words? Perfect — that's all we need here. We'll check your growth at the end."},
    watch:{teacher:"Now let's make sense of it. Play along and read the meaning in a language you already know.",purpose:"Meaning comes first here, so the text feels less like a puzzle and more like a story you can follow.",check:"Does the story make sense now? If a line still feels murky, tap it again — take your time."},
    read:{teacher:(lang)=>`Let's connect sound to spelling. Read along in ${lang} while you listen.`,purpose:"Seeing the words while hearing them helps your eyes and ears agree on what is happening.",check:"Following along comfortably? Lovely. If not, replay a line or two before we move on."},
    comp:{teacher:"Quick check — no pressure at all. Pick the sentence that matches what you read.",purpose:"A small check gives you a clear signal: either you are ready to go deeper, or one more listen will help.",check:"Got them? Wonderful. Missed one? Pop back to Listen & Read — that's exactly how it's meant to work."},
    gram:{title:"Under the microscope",teacher:"Let's slow right down — one sentence at a time. We'll unpack the words and phrases together, like a teacher sitting beside you.",purpose:"You are learning patterns from your own text, so grammar stays connected to meaning instead of floating around as rules.",sentence:(i,n)=>`Sentence ${i} of ${n}`,phrases:"Phrases & collocations",wordOrder:"Word order:",wordOrderText:"notice how this sentence is built — that structure repeats across the text.",slow:"Take it slow — just this one sentence for now.",noWords:"No standout new words in this sentence — enjoy the breather.",summaryTitle:"Let's pull it together",summaryTeacher:"Great work going through each sentence. Here's everything in one place to lock it in.",allVocab:"All key vocabulary",patterns:"Grammar patterns you met",review:"Review from Sentence 1",summaryCheck:"Feeling shaky on a sentence? No problem — head back to Sentence 1 and walk through again. Repetition is the whole idea.",next:"Next sentence",previous:"Previous sentence",seeSummary:"See summary"},
  },
  zh:{
    interfaceLanguage:"界面语言", english:"English", chinese:"中文", clearLocalData:"清除本地数据", clearConfirm:"清除所有本地学习数据（草稿、笔记、评分和进度）？", newMaterial:"新材料",
    continue:"继续", previous:"上一步", back:"返回", next:"下一步", finish:"完成", exitSession:"退出学习", play:"播放", stop:"停止", restart:"重新开始",
    playAll:"全部播放 · 跟读", syncHint:"朗读时对应句子会高亮 · 点击任意句子可重播",
    fullSourceAudio:"完整原文音频", fullSourceRead:"完整朗读", audioUnsupported:"当前浏览器不支持音频",
    buildingTitle:"正在生成你的课程…",
    buildingSteps:["读取文本…","切分句子…","逐句翻译…","寻找关键词…","生成新例句…","准备小测验…","快好了…"],
    buildingNote:"AI 正在翻译文本并生成课程，通常需要 20–40 秒。谢谢耐心等待！",
    loginTitle:"用你喜欢的内容学习任何语言", loginSub:"粘贴一段文本、字幕或文章节选，它会变成一节完整的引导式学习课。",
    email:"邮箱", noPassword:"这个测试版本不需要密码。学习记录只保存在这台设备上。",
    inputTitle:"导入你的材料", inputSub:"粘贴文本，或上传 .txt 文件。建议使用 1,000–3,000 字符、标点正常的内容。",
    yourText:"你的文本", uploadTxt:"上传 .txt", textPlaceholder:"粘贴文章、播客字幕、 newsletter 节选、对话…",
    cleanNote:"时间戳、[Music] 标签和多余换行会自动清理。", targetLanguage:"目标语言 *", select:"请选择…",
    currentLevel:"当前水平", sessionGoal:"学习目标", overLimit:"超过 2,000 字符免费限制，请稍微删短一点。",
    chooseTarget:"请选择目标语言后继续。", analyzeText:"分析文本",
    goals:["综合流利度","对话与口语","阅读理解","词汇积累","考试准备"],
    levels:["A1 — 入门","A2 — 初级","B1 — 中级","B2 — 中高级","C1 — 高级"],
    previewTitle:"这是你的文本概览", previewSub:"开始前先快速了解这份材料。", topics:"主题：",
    recommendedLevel:"推荐水平", estimatedTime:"预计时间", vocabulary:"词汇", characters:"字符数", chars:"字符",
    wordCount:(n)=>`${n} 个词`, diffLabels:["","舒适复习","比较轻松","正适合你","温和挑战","有挑战"],
    difficultyForYou:"对你的难度", basedOnLevel:(a,b)=>`基于你的水平（${a}）和文本水平（${b}）估算。`,
    session:"学习流程", stepsInBlocks:(s,b)=>`${s} 个步骤，分成 ${b} 个模块`, start:(m)=>`开始 · 约 ${m} 分钟`,
    planNames:["学习","语法与词汇","测试","练习","使用"],
    planItems:[["听一遍","看懂意思","听读结合"],["逐句学习"],["理解检查","听句辨认"],["带字幕练习","无字幕练习","完全听懂"],["和 AI 写作/对话"]],
    heavy:(n)=>`这篇材料有 ${n} 个新词，数量不少。为了真正记住，建议每个模块至少练两遍；觉得吃力时可以随时回到前面的步骤。`,
    stepPhases:["学习","学习","学习","测试","语法与词汇","测试","练习","练习","练习","使用"],
    stepTitles:["听一遍","看懂意思","听读结合","理解检查","语法与词汇","听句辨认","带字幕练习","无字幕练习","完全听懂","和 AI 练习"],
    stepOf:(n,total)=>`第 ${n} / ${total} 步`, min:(m)=>`约 ${m} 分钟`,
    lockedGrammar:"完成逐句学习后才能继续。", lockedAI:"完成 Part 1 反馈和 Part 2 对话后才能结束。",
    translatingTitle:"正在翻译句子", lookingUpTitle:"正在查询单词含义", aboutRemaining:(s)=>`预计还需 ${s} 秒`, lineTranslating:(i,n)=>`正在翻译第 ${i} / ${n} 句`, translationUnavailable:"暂时没有翻译",
    lookingUpWord:"正在生成简短释义和补充说明…", studyUsage:"先看它在句子里的用法，再试着自己造句。",
    simpleMeaning:"简单意思", detail:"详细说明", example:"例句",
    quizLoading:"正在根据文本生成几个问题…", whichHeard:"你听到的是哪一句？", whichMatches:"哪一句符合文本意思？",
    niceRight:"答对了，很好。", notQuite:"还差一点，高亮的是正确答案。可以重播后再试。",
    selfLow:"0% · 还不太懂", selfHigh:"100% · 全部理解",
    sr:{teacher:"相信你的耳朵。播放每一句，然后选择你听到的句子。",purpose:"这个小判断会把声音和意思连起来，一次只练一个清晰选择。",check:"做得顺的话很好；如果有几句难，重播再试一次，不急。"},
    understand:{teacher:(lang)=>`最后完整听一遍。配合 ${lang} 原文播放，现在应该清楚很多。`,purpose:"你已经见过意思、声音和常用结构了。最后这一遍会帮它们自然合在一起。",check:"比第一次清楚了吗？这就是你的进步。"},
    timed:{title:(subs)=>`练习 · ${subs?"带字幕":"无字幕"}`,teacherSubs:"开始说出来。我会播放每一句，然后轮到你在温和倒计时里朗读。",teacherNoSubs:"现在只靠耳朵。我会播放每一句，你凭记忆复述；需要时可以再显示文本。",purpose:"练完整句会让嘴巴有路可走，语言会慢慢变成你能说出口的东西。",how:"练习方式",tips:["屏幕一次只显示一句，专注这一句就好。","先听，然后在倒计时里读出来。","会自动进入下一句，但返回、重播、暂停一直可用。"],ready:"我准备好了，开始",breath:"先深呼吸，按下按钮前不会开始。",done:(n)=>`你已经练完 ${n} 个句子。准备好后点继续。`,again:"再练一遍",doneCheck:"每一句都说出来了吗？就是这样。多来一轮也很好。",listen:"听",yourTurn:"轮到你 · 读出来",hide:"隐藏文本",reveal:"显示文本",replay:"重播",pause:"暂停",resume:"继续",skip:"跳过"},
    aiUse:{title:"和 AI 练习",teacher:"现在真正用起来。先写一点，再进行一段短对话，尽量用今天的词。",purpose:"这一步把课程变成你能回应、能表达的内容，轻一点，但要真的开口。",writeTab:"Part 1 · 写作",chatTab:"Part 2 · 对话",unlock:"完成 Part 1 反馈和 Part 2 对话后，就可以结束课程。",feedback:"获取反馈",reading:"阅读中…",teacherReading:"老师正在阅读你的写作…",checking:"正在检查语法、词汇和句子流畅度，几秒钟就好。",nextTalk:"下一步 · 和 AI 对话",writePlaceholder:(lang)=>`用 ${lang} 写下你的回答…`,question:(topic,lang)=>`根据这段材料 “${topic}”，你怎么看？请用 ${lang} 写 3–4 句，并尽量用今天的词。`,saved:(n)=>`${n} 个词 · 已本地保存`,feedbackTitle:(sim)=>`反馈和建议修改${sim?" · 模拟":""}`,grammar:"语法",vocab:"词汇",sentence:"句子结构",revision:"建议修改",mockGrammar:"时态整体一致。较长句子里可以再检查主语和动词是否对应。",mockVocab:"今天的词用得不错，可以再加一个连接短语让意思更连贯。",mockSentence:"结构清楚。试着变化一下句子长度，会更自然。",mockNote:"正在显示示例反馈；实时 AI 刚才没有响应，稍后可再试一次获得更具体的修改。"},
    chat:{notice:(name,lang,n)=>`你正在和 ${name} 面对面用 ${lang} 对话。${name} 会先说，听完后你可以开口回答，也可以打字。大约 ${n} 轮。`,thinking:"思考中",speaking:"正在说话",yourTurn:"正在听你说",sayAgain:"再说一遍",exchange:(n,total)=>`第 ${n} / ${total} 轮`,listening:"正在听 · 说完后点击",speakAnswer:"轮到你 · 说出回答",speakIn:(lang)=>`请用 ${lang} 说。你的话会出现在下面，可以修改后再发送。`,typeIn:(lang)=>`请在下面用 ${lang} 打字回复（Chrome/Edge 支持语音输入）。`,placeholder:(lang)=>`用 ${lang} 回复…`,looksGood:"看起来不错",shortSentence:"至少说一个短句",replyTo:(name)=>`回复 ${name}`,showTranscript:"显示对话记录",feedbackTitle:(sim)=>`对话反馈${sim?" · 模拟":""}`,fluency:"流利度",mockDone:(lang)=>`你已经用 ${lang} 完成了一段语音交流，并且用到了今天的词，这正是目标。`},
    done:{friend:"同学",title:(name)=>`${name}，你完成了！`,sub:(n)=>`你完整走完了 ${n} 个学习步骤。真正难的是开始并坚持到最后，而你已经做到了。`,explored:(topics)=>`今天你学习了 ${topics}`,more:"多带几段文本来，我们会慢慢看出你喜欢哪些主题、常在哪些地方投入时间。",steps:"步骤",words:"词汇",sentences:"句子",blocks:"模块",comp:"理解度 · 前后对比",rate:"最后再问一次：现在你大概能理解多少？",reveal:"查看我的进步",before:"之前",after:"之后",gain:(d)=>`理解度 +${d}% ，很漂亮`,again:"再来一遍会继续提升，你已经在路上了",take:"你带走的内容",review:"复习这节课",new:"导入新材料"},
    phraseNote:"这是一个自然搭配，建议把它当成一组一起记，并试着自己造句。",
    refTitle:"研究依据", refText:"这套流程基于 Delft Method：先理解一段有意义的文本，再在上下文里吸收高频词和语法，最后过渡到真实表达。", refSources:"来源：Montens & Sciarone《Nederlands voor buitenlanders: de Delftse methode》；TU Delft Centre for Languages。",
    grammarFocus:["文本里的常见时态","语序和句子位置","连接词与表达观点的短语"],
    listen:{teacher:"先只听一遍。播放后让声音自然进入耳朵，不需要每个词都听懂。",purpose:"大脑会先捕捉节奏、熟悉的声音和语言轮廓，不必马上解释每个细节。",player:"完整材料",sub:"完整音频 · 无字幕",rate:"正式学习前，你现在大概能理解多少？",check:"听出了大意或几个词就很好。最后我们会再对比一次你的进步。"},
    watch:{teacher:"现在先把意思看懂。边播放边读你已经熟悉的语言里的含义。",purpose:"先有意思，文本就不再像谜题，而更像一段你能跟上的故事。",check:"现在故事更清楚了吗？如果某一句还模糊，点它再听一次，慢慢来。"},
    read:{teacher:(lang)=>`把声音和拼写连起来。听的时候一起阅读 ${lang} 原文。`,purpose:"同时听到和看到单词，会更容易记住。",check:"能跟上了吗？如果还不稳，先重播一两句再继续。"},
    comp:{teacher:"快速检查一下，没有压力。选择和文本意思相符的句子。",purpose:"一个小检查会给你清楚的信号：可以继续深入，或者先多听一遍。",check:"完成了吗？很好。错了一题也没关系，回到“听读结合”再过一遍就对了。"},
    gram:{title:"逐句拆解",teacher:"我们放慢速度，一次只看一句。一起拆解词汇和短语，就像老师坐在旁边。",purpose:"你会从自己的文本里学结构，所以语法不会漂在空中，而是一直连着意思。",sentence:(i,n)=>`第 ${i} / ${n} 句`,phrases:"短语与固定搭配",wordOrder:"语序：",wordOrderText:"留意这句话的结构，类似结构会在文本里反复出现。",slow:"慢慢来，现在只专注这一句。",noWords:"这一句没有特别突出的新词，轻松一下。",summaryTitle:"整理一下",summaryTeacher:"逐句学完了，很棒。这里把重点放在一起，帮助你巩固。",allVocab:"全部重点词汇",patterns:"遇到的语法模式",review:"从第 1 句复习",summaryCheck:"如果某一句还不稳，回到第 1 句再走一遍。重复本来就是学习的一部分。",next:"下一句",previous:"上一句",seeSummary:"查看总结"},
  }
};
const UIContext=createContext({uiLang:"en",setUiLang:()=>{},t:UI_TEXT.en});
function useUI(){ return useContext(UIContext); }
function useElapsed(active){
  const [elapsed,setElapsed]=useState(0);
  useEffect(()=>{ if(!active){ setElapsed(0); return; } const t=setInterval(()=>setElapsed(s=>s+1),1000); return ()=>clearInterval(t); },[active]);
  return elapsed;
}
function progressPct(elapsed,estimate){ return Math.min(92,Math.max(12,Math.round((elapsed/Math.max(1,estimate))*100))); }
function meaningParts(e){
  if(!e) return {simple:null,detail:null};
  const raw=(e.meaning||"").trim();
  const simple=(e.simpleMeaning||e.simple||"").trim() || raw.split(/[—:.;,]/)[0].split(/\s+/).slice(0,3).join(" ");
  const detail=(e.detail||e.explanation||"").trim() || (raw && raw!==simple ? raw : "");
  return {simple:simple||null,detail:detail||null};
}

const LANG_CODE={Spanish:"es-ES",French:"fr-FR",German:"de-DE",Italian:"it-IT",Portuguese:"pt-PT",
  Dutch:"nl-NL",English:"en-US",Japanese:"ja-JP",Korean:"ko-KR","Mandarin Chinese":"zh-CN",Arabic:"ar-SA",Russian:"ru-RU"};
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
function chatFallback(lang,word){
  const list=CHAT_FALLBACK[lang]||CHAT_FALLBACK.English;
  return list.map(x=>typeof x==="function"?x(word||"it"):x);
}
const TTS_OK=typeof window!=="undefined" && "speechSynthesis" in window;
// High-quality AI voice via /api/tts, with the browser voice as fallback.
// ttsMode caches the outcome so we don't re-probe the API on every click.
let ttsMode=null;            // null=unknown, "api", "browser"
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
function cacheKey(text,lang,rate){ return lang+"|"+rate+"|"+(text||"").slice(0,4000); }
function playUrl(handle,url){ if(handle._cancelled) return; const a=new Audio(url); handle._audio=a;
  a.onended=()=>{ if(!handle._cancelled&&handle.onend)handle.onend(); }; a.play().catch(()=>{}); }

function speak(text,lang,rate=1){
  stopSpeak();
  const handle={_cancelled:false,onend:null};
  activeHandle=handle;
  if(ttsMode==="browser"){ browserSpeak(handle,text,lang,rate); return handle; }
  const key=cacheKey(text,lang,rate);
  (async()=>{
    // 1) in-memory cache (this session) — free & instant
    let url=audioMem && audioMem.get(key);
    // 2) IndexedDB cache (persists across reloads) — free
    if(!url){ const blob=await IDB.get(key); if(blob){ url=URL.createObjectURL(blob); audioMem&&audioMem.set(key,url); } }
    if(url){ ttsMode="api"; playUrl(handle,url); return; }
    // 3) not cached → call the API (the ONLY path that costs money)
    try{
      const res=await fetch("/api/tts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:(text||"").slice(0,4000),lang,rate})});
      if(res.ok && (res.headers.get("content-type")||"").includes("audio")){
        ttsMode="api";
        const blob=await res.blob();
        IDB.put(key,blob);                                   // save for next time
        const u2=URL.createObjectURL(blob); audioMem&&audioMem.set(key,u2);
        playUrl(handle,u2);
        return;
      }
      ttsMode="browser";
    }catch(e){ /* network/route error → fall back */ }
    if(!handle._cancelled) browserSpeak(handle,text,lang,rate);
  })();
  return handle;
}
function stopSpeak(){
  if(activeHandle){ activeHandle._cancelled=true; if(activeHandle._audio){ try{activeHandle._audio.pause();}catch(e){} } activeHandle=null; }
  if(typeof window!=="undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}

function cleanText(raw){ let t=raw||"";
  t=t.replace(/\[(music|applause|laughter|inaudible|crosstalk|silence)\]/gi," ");
  t=t.replace(/\d{1,2}:\d{2}(:\d{2})?(\.\d+)?/g," ");
  t=t.replace(/^\s*\d+\s*$/gm," ").replace(/-->/g," ")
   .replace(/[ \t]{2,}/g," ").replace(/\n{3,}/g,"\n\n").replace(/[ \t]+\n/g,"\n").replace(/\n[ \t]+/g,"\n");
  return t.trim(); }

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
  let t=text.replace(/\s*[•·▪‣◦]\s*/g,"\n");
  const primary=new RegExp("(?<!\\b(?:"+ABBR+")\\.)(?<=[.!?…。！？])\\s+(?=[\\p{Lu}\"“'(\\[])|\\s*[;；]\\s+(?=[\\p{Lu}])|\\s*\\n+\\s*","u");
  const secondary=/(?<=[\p{Ll})\]])(?<!\b\p{Lu}[\p{Ll}à-ÿ]{2,})\s+(?=[\p{Lu}][\p{Ll}à-ÿ]{3,}\b(?!\s+[\p{Lu}]))/u;
  const MAX=110,out=[];
  for(let p of t.split(primary)){
    if(p==null) continue;
    p=p.replace(/\s+/g," ").trim(); if(!p) continue;
    if(p.length>MAX) p.split(secondary).forEach(x=>{x=x.trim();if(x)out.push(x);});
    else out.push(p);
  }
  const merged=[];
  for(const s of out){ if(s.length<10&&merged.length) merged[merged.length-1]+=" "+s; else merged.push(s); }
  return merged.filter(s=>s.length>3);
}
function contextFor(word,sents){ const s=sents.find(x=>x.toLowerCase().includes(word.toLowerCase())); return s||null; }
function expressionsInSentence(s){ const ws=words(s); const out=[]; for(let i=0;i<ws.length-1;i++){ const a=ws[i],b=ws[i+1];
  if(a.length>3&&b.length>3&&!STOP.has(a)&&!STOP.has(b)){ out.push(a+" "+b); } } return out.slice(0,2); }
const POS=["noun","verb","adjective","adverb","phrase"];
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

function estimateMinutes(chars,sentCount,vocabCount,diff){
  const s=Math.min(8,sentCount||0);
  const base=8 + (chars||0)/500 + (vocabCount||10)*0.4 + s*0.8;
  const mult=0.85 + (diff||3)*0.08;
  return Math.max(8,Math.round(base*mult));
}
function generateLesson(text,lang,level,goal){ const chars=text.length; const sents=sentencesOf(text);
  const vocabCount=Math.min(16,Math.max(8,Math.round(chars/150)));
  const vlist=pickVocab(text,vocabCount);
  const vocab=vlist.map((w,i)=>({word:w.replace(/^./,c=>c.toUpperCase()),pos:POS[i%POS.length],context:contextFor(w,sents)}));
  const recommended=recommendLevel(text,sents);
  const diff=Math.max(1,Math.min(5,3+(levelIdx(recommended)-levelIdx(level))));
  return { lang,level,goal,charCount:chars,sents,vocab,vocabCount,vlist,recommended,diff,
    topics:inferTopics(text),
    estMin:estimateMinutes(chars,sents.length,vocabCount,diff),
    grammarFocus:["Common tenses used in the passage","Word order & sentence position","Connective & opinion phrases"],
    comprehension:quizItems([...sents].sort((a,b)=>a.split(/\s+/).length-b.split(/\s+/).length),vlist,3),
    recognition:quizItems(sents,vlist,3) }; }

/* ---------- flow + Delft teaching notes ---------- */
const STEPS=[
  {phase:"Learning",title:"Listen",min:3},
  {phase:"Learning",title:"Watch · your language",min:3},
  {phase:"Learning",title:"Listen & Read",min:3},
  {phase:"Testing",title:"Comprehension check",min:3},
  {phase:"Grammar & Vocabulary",title:"Grammar & Vocabulary",min:7},
  {phase:"Testing",title:"Sentence recognition",min:3},
  {phase:"Practicing",title:"Practice · with subtitles",min:5},
  {phase:"Practicing",title:"Practice · no subtitles",min:5},
  {phase:"Practicing",title:"Understand everything",min:3},
  {phase:"Using",title:"Practice with AI",min:6},
];
const TOTAL_MIN=STEPS.reduce((a,s)=>a+s.min,0);
/* collapsed plan blocks (grammar kept as its own block) */
const PLAN_BLOCKS=[
  {name:"Learning",icon:"🎧",items:["Listen","Watch in your language","Listen & read"],min:9},
  {name:"Grammar & Vocabulary",icon:"🔍",items:["Sentence-by-sentence study"],min:7},
  {name:"Testing",icon:"✅",items:["Comprehension check","Sentence recognition"],min:6},
  {name:"Practicing",icon:"🗣️",items:["With subtitles","No subtitles","Understand everything"],min:13},
  {name:"Using",icon:"💬",items:["Write & talk with AI"],min:6},
];

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
  useEffect(()=>()=>stopSpeak(),[]);
  function toggle(){ if(playing){stopSpeak();setPlaying(false);return;} const u=speak(text,lang,rate); if(u){u.onend=()=>setPlaying(false);setPlaying(true);} }
  function setR(r){ setRate(r); if(playing){const u=speak(text,lang,r); if(u)u.onend=()=>setPlaying(false);} }
  return (<div className="player">
    <button className="playbtn" onClick={toggle}>{playing?"❚❚":"▶"}</button>
    <div style={{flex:1}}><div style={{fontWeight:600}}>{label||t.fullSourceAudio}</div>
      <div className="tiny muted">{TTS_OK?(sub||t.fullSourceRead):t.audioUnsupported}</div></div>
    <div className="row" style={{gap:6}}>{[0.75,1,1.25].map(r=><button key={r} className={"rate"+(rate===r?" on":"")} onClick={()=>setR(r)}>{r}×</button>)}
      <button className="sbtn" title={t.restart} onClick={()=>setR(rate)}>↺</button></div>
  </div>);
}
function Say({text,lang,rate=1}){ const {t}=useUI(); return <button className="sbtn saybtn" title={t.play} aria-label={t.play} onClick={()=>speak(text,lang,rate)}><span>▶</span><span>{t.play}</span></button>; }

// Small per-section AI call. Returns parsed JSON or null (never throws).
async function aiAnalyze(mode,payload){
  try{ const r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode,...payload})});
    if(!r.ok) return null; return await r.json(); }catch(e){ return null; }
}

function SyncReader({items,lang,level,translation,rate=1,gap=0}){
  const {t}=useUI();
  const [active,setActive]=useState(-1); const [playing,setPlaying]=useState(false); const stop=useRef(false);
  const [trs,setTrs]=useState(()=>items.map(it=>it.tr||null));
  const [loadingTr,setLoadingTr]=useState(false);
  const estimateSec=Math.max(8,Math.ceil(items.length*1.6));
  const elapsed=useElapsed(loadingTr);
  const remaining=Math.max(1,estimateSec-elapsed);
  useEffect(()=>{ let cancel=false;
    if(!translation) return;
    if(!items.some((it,i)=>!(it.tr||trs[i]))) return;   // already have them all
    setLoadingTr(true);
    aiAnalyze("translate",{sentences:items.map(it=>it.s),lang,level}).then(d=>{
      if(cancel) return; setLoadingTr(false);
      if(d&&Array.isArray(d.translations)) setTrs(items.map((it,i)=>it.tr||d.translations[i]||null));
    });
    return ()=>{cancel=true;};
  },[translation]);
  useEffect(()=>()=>{stop.current=true;stopSpeak();},[]);
  function playFrom(i){ if(stop.current||i>=items.length){setPlaying(false);setActive(-1);return;}
    setActive(i); const u=speak(items[i].s,lang,rate); if(!u){setPlaying(false);return;}
    u.onend=()=>{ if(!stop.current) setTimeout(()=>{ if(!stop.current) playFrom(i+1); }, gap); }; }
  function playAll(){ stop.current=false; setPlaying(true); playFrom(0); }
  function halt(){ stop.current=true; stopSpeak(); setPlaying(false); setActive(-1); }
  function one(i){ stop.current=true; stopSpeak(); setActive(i); const u=speak(items[i].s,lang,rate); if(u)u.onend=()=>setActive(-1); }
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
    <div className="card card-p">
      {items.map((it,i)=>{ const translated=it.tr||trs[i]; return (<div key={i} className={"sline"+(active===i?" on":"")} onClick={()=>one(i)} style={{marginBottom:translation?10:2}}>
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
        {audio && <button className="btn btn-outline btn-sm" onClick={()=>speak(q.correct,lang)}>▶ {t.play}</button>}</div>
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
    aiAnalyze("quiz",{lang,level,sentences:sents.slice(0,10),count:3}).then(d=>{
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

function InputScreen({onNext}){
  const {t}=useUI();
  const [raw,setRaw]=useState(DB.get("draft","")); const cleaned=cleanText(raw); const count=cleaned.length; const LIMIT=2000; const over=count>LIMIT;
  const [lang,setLang]=useState(DB.get("lang","")); const [level,setLevel]=useState(DB.get("level",LEVELS[1])); const [goal,setGoal]=useState(DB.get("goal",GOALS[0]));
  const fileRef=useRef(null);
  function onFile(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>setRaw(String(r.result));r.readAsText(f);}
  const ready=count>40&&!over&&lang;
  return (<div>
    <h1>{t.inputTitle}</h1><p className="sub">{t.inputSub}</p>
    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",marginBottom:10}}>
        <label className="fld" style={{margin:0}}>{t.yourText}</label>
        <button className="btn btn-outline btn-sm" onClick={()=>fileRef.current.click()}>{t.uploadTxt}</button>
        <input ref={fileRef} type="file" accept=".txt,.md" onChange={onFile} style={{display:"none"}}/></div>
      <textarea style={{minHeight:220}} value={raw} onChange={e=>setRaw(e.target.value)} placeholder={t.textPlaceholder}/>
      <div className="row" style={{justifyContent:"space-between",marginTop:10}}>
        <span className="tiny muted">{t.cleanNote}</span>
        <span className="tiny" style={{fontWeight:600,color:over?"hsl(0 72% 45%)":"hsl(var(--muted-foreground))"}}>{count.toLocaleString()} / {LIMIT.toLocaleString()} {t.chars}</span></div>
    </div>
    <div className="grid3" style={{marginTop:16}}>
      <div><label className="fld">{t.targetLanguage}</label><select value={lang} onChange={e=>setLang(e.target.value)}><option value="">{t.select}</option>{LANGS.map(l=><option key={l}>{l}</option>)}</select></div>
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

function Preview({lesson,onStart,onBack}){
  const {t}=useUI();
  const heavy=lesson.vocabCount>12;
  const total=lesson.estMin||TOTAL_MIN; const scale=total/TOTAL_MIN;
  const diffLabel=t.diffLabels[lesson.diff];
  return (<div>
    <h1>{t.previewTitle}</h1><p className="sub">{t.previewSub}</p>
    <div className="row wrap" style={{gap:7,marginBottom:16}}>
      <span className="tiny muted" style={{fontWeight:600}}>{t.topics}</span>
      {lesson.topics.map(t=><span key={t} className="badge badge-warm">{t}</span>)}
    </div>
    <div className="grid4" style={{marginBottom:14}}>
      <Stat k={t.recommendedLevel} v={lesson.recommended.split(" — ")[0]}/>
      <Stat k={t.estimatedTime} v={t.min(total)}/>
      <Stat k={t.vocabulary} v={t.wordCount(lesson.vocabCount)}/>
      <Stat k={t.characters} v={lesson.charCount.toLocaleString()}/>
    </div>
    <div className="card card-p" style={{marginBottom:16}}>
      <div className="row" style={{justifyContent:"space-between"}}>
        <div><div className="stat-k" style={{fontSize:11,fontWeight:600,color:"hsl(var(--muted-foreground))",textTransform:"uppercase",letterSpacing:".05em"}}>{t.difficultyForYou}</div>
          <div style={{marginTop:5}}><Stars n={lesson.diff}/> <span style={{fontWeight:600,marginLeft:6}}>{diffLabel}</span></div></div>
        <div className="tiny muted" style={{textAlign:"right",maxWidth:230}}>{t.basedOnLevel(lesson.level.split(" — ")[0],lesson.recommended.split(" — ")[0])}</div>
      </div>
    </div>
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

/* ---------- lesson shell ---------- */
const GATED=new Set([4,9]);
function Lesson({lesson,text,onFinish}){
  const {t}=useUI();
  const [step,setStep]=useState(DB.get("progress",0));
  const [gateOpen,setGateOpen]=useState(!GATED.has(DB.get("progress",0)));
  useEffect(()=>{DB.set("progress",step);stopSpeak();window.scrollTo({top:0,behavior:"smooth"});},[step]);
  function go(ns){ setGateOpen(!GATED.has(ns)); setStep(ns); }
  const S=STEPS[step]; const pct=Math.round(((step+1)/STEPS.length)*100);
  const stepMin=Math.max(1,Math.round(S.min*((lesson.estMin||TOTAL_MIN)/TOTAL_MIN)));
  const locked=GATED.has(step)&&!gateOpen;
  return (<div>
    <div className="learnbar">
      <div className="track"><span style={{width:pct+"%"}}/></div>
      <div className="learnmeta"><span className="tiny muted">{(t.stepPhases&&t.stepPhases[step])||S.phase} · {t.stepOf(step+1,STEPS.length)}</span>
        <span className="row" style={{gap:10}}><span className="tiny muted">{t.min(stepMin)}</span><LanguageSwitch/></span></div>
    </div>
    <div className="stage"><StepBody step={step} lesson={lesson} text={text} onComplete={()=>setGateOpen(true)}/></div>
    <div className="footnav">
      <button className="btn btn-ghost btn-sm" disabled={step===0} onClick={()=>go(Math.max(0,step-1))}>← {t.previous}</button>
      {step<STEPS.length-1 ? <button className="btn btn-outline btn-sm" disabled={locked} onClick={()=>go(step+1)}>{t.continue} →</button>
        : <button className="btn btn-primary btn-sm" disabled={locked} onClick={onFinish}>{t.finish} ✓</button>}
    </div>
    {locked && <div className="tiny muted" style={{textAlign:"center",marginTop:10}}>{step===4?t.lockedGrammar:t.lockedAI}</div>}
    <div style={{textAlign:"center",marginTop:16}}><button className="btn btn-ghost btn-sm muted" onClick={onFinish}>{t.exitSession}</button></div>
  </div>);
}

function StepBody({step,lesson,text,onComplete}){
  const {t}=useUI();
  const {lang}=lesson; const sents=lesson.sents;
  const [before,setBefore]=useState(DB.get("selfBefore",30));

  if(step===0) return (<div>
    <div className="eyebrow">{t.stepPhases[0]}</div><h2>{t.stepTitles[0]}</h2>
    <Teacher>{t.listen.teacher}</Teacher>
    <Purpose>{t.listen.purpose}</Purpose>
    <FullPlayer text={text} lang={lang} label={t.listen.player} sub={t.listen.sub}/>
    <div className="card card-p" style={{marginTop:18}}>
      <SelfRate value={before} prompt={t.listen.rate} onChange={v=>{setBefore(v);DB.set("selfBefore",v);}}/></div>
    <CheckIn>{t.listen.check}</CheckIn>
  </div>);

  if(step===1) return (<div>
    <div className="eyebrow">{t.stepPhases[1]}</div><h2>{t.stepTitles[1]}</h2>
    <Teacher>{t.watch.teacher}</Teacher>
    <Purpose>{t.watch.purpose}</Purpose>
    <SyncReader items={(lesson.watch&&lesson.watch.length?lesson.watch:sents.slice(0,10).map(s=>({s})))} lang={lang} level={lesson.level} translation={true}/>
    <CheckIn>{t.watch.check}</CheckIn>
  </div>);

  if(step===2) return (<div>
    <div className="eyebrow">{t.stepPhases[2]}</div><h2>{t.stepTitles[2]}</h2>
    <Teacher>{t.read.teacher(lang)}</Teacher>
    <Purpose>{t.read.purpose}</Purpose>
    <SyncReader items={sents.slice(0,12).map(s=>({s}))} lang={lang} translation={false} rate={0.75} gap={1500}/>
    <CheckIn>{t.read.check}</CheckIn>
  </div>);

  if(step===3) return (<div>
    <div className="eyebrow">{t.stepPhases[3]}</div><h2>{t.stepTitles[3]}</h2>
    <Teacher>{t.comp.teacher}</Teacher>
    <Purpose>{t.comp.purpose}</Purpose>
    <AIQuiz lesson={lesson}/>
    <CheckIn>{t.comp.check}</CheckIn>
  </div>);

  if(step===4) return <GrammarStep lesson={lesson} onComplete={onComplete}/>;

  if(step===5) return (<div>
    <div className="eyebrow">{t.stepPhases[5]}</div><h2>{t.stepTitles[5]}</h2>
    <Teacher>{t.sr.teacher}</Teacher>
    <Purpose>{t.sr.purpose}</Purpose>
    <Quiz items={lesson.recognition} lang={lang} audio={true}/>
    <CheckIn>{t.sr.check}</CheckIn>
  </div>);

  if(step===6) return <TimedPractice sents={sents} lang={lang} withSubs={true}/>;
  if(step===7) return <TimedPractice sents={sents} lang={lang} withSubs={false}/>;

  if(step===8) return (<div>
    <div className="eyebrow">{t.stepPhases[8]}</div><h2>{t.stepTitles[8]}</h2>
    <Teacher>{t.understand.teacher(lang)}</Teacher>
    <Purpose>{t.understand.purpose}</Purpose>
    <SyncReader items={sents.slice(0,12).map(s=>({s}))} lang={lang} translation={false}/>
    <CheckIn>{t.understand.check}</CheckIn>
  </div>);

  return <PracticeAI lesson={lesson} onComplete={onComplete}/>;
}

/* ---------- step 5 grammar: one sentence at a time, then a summary card ---------- */
function GrammarStep({lesson,onComplete}){
  const {t}=useUI();
  const {lang,sents,vocab,vlist,level,recommended}=lesson;
  const N=Math.min(6,sents.length);
  const [gi,setGi]=useState(0); const [view,setView]=useState("study"); // study | summary
  const [expl,setExpl]=useState({});     // word(lc) -> {meaning, example, pos} from AI
  const [loadingKw,setLoadingKw]=useState(false);
  const lookupElapsed=useElapsed(loadingKw);
  useEffect(()=>{ if(gi>=N-1 && onComplete) onComplete(); },[gi,N]);
  const vset=new Set(vlist);
  const vmap=Object.fromEntries((vocab||[]).map(v=>[v.word.toLowerCase(),v]));
  const depth=levelIdx(recommended)-levelIdx(level); // >0 harder for the learner
  // Salient words to unpack: vocab words first, then longer words.
  function keyWordsIn(s){ const ws=[...new Set(words(s))];
    const inVocab=ws.filter(w=>vmap[w.toLowerCase()]);
    const long=ws.filter(w=>!vmap[w.toLowerCase()]&&w.length>6);
    return [...inVocab,...long].slice(0,4); }
  // Ask the AI to explain this sentence's key words in context (meaning + example).
  useEffect(()=>{ let cancel=false;
    const sen=sents[gi]||""; const kws=keyWordsIn(sen).filter(w=>!expl[w.toLowerCase()]);
    if(!kws.length){ setLoadingKw(false); return; }
    setLoadingKw(true);
    aiAnalyze("explain",{lang,level,items:kws.map(w=>({word:w,context:sen}))}).then(d=>{
      if(cancel) return; setLoadingKw(false);
      if(d&&Array.isArray(d.items)){ setExpl(prev=>{ const n={...prev};
        d.items.forEach(it=>{ if(it&&it.word) n[String(it.word).toLowerCase()]={meaning:it.meaning||null,simpleMeaning:it.simpleMeaning||null,detail:it.detail||null,example:it.example||null,pos:it.pos||null}; });
        return n; }); }
    });
    return ()=>{cancel=true;};
  },[gi,view]);
  function usageNote(w){ return loadingKw ? t.lookingUpWord : t.studyUsage; }
  const s=sents[gi]||""; const kw=keyWordsIn(s); const phrases=expressionsInSentence(s);
  const lookupEstimate=Math.max(6,kw.length*2+2);
  const lookupRemaining=Math.max(1,lookupEstimate-lookupElapsed);

  if(view==="summary") return (<div>
    <div className="eyebrow">{t.stepPhases[4]}</div><h2>{t.gram.summaryTitle}</h2>
    <Teacher>{t.gram.summaryTeacher}</Teacher>
    <div className="card card-p" style={{marginBottom:14}}>
      <h3 className="lbl">{t.gram.allVocab}</h3>
      <div className="row wrap" style={{gap:7,marginBottom:16}}>{vocab.map(v=><span key={v.word} className="badge">{v.word}</span>)}</div>
      <h3 className="lbl">{t.gram.patterns}</h3>
      <ul className="clean">{(t.grammarFocus||lesson.grammarFocus).map((g,i)=><li key={i}>{g}</li>)}</ul>
    </div>
    <CheckIn>{t.gram.summaryCheck}</CheckIn>
    <div style={{marginTop:14}}><button className="btn btn-outline btn-sm" onClick={()=>{setGi(0);setView("study");}}>↩ {t.gram.review}</button></div>
  </div>);

  return (<div>
    <div className="eyebrow">{t.stepPhases[4]}</div><h2>{t.gram.title}</h2>
    <Teacher>{t.gram.teacher}</Teacher>
    <Purpose>{t.gram.purpose}</Purpose>

    <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
      <span className="badge badge-outline">{t.gram.sentence(gi+1,N)}</span>
      <div className="track" style={{width:160}}><span style={{width:((gi+1)/N*100)+"%"}}/></div>
    </div>

    <div className="card card-p">
      <div className="row" style={{justifyContent:"space-between",marginBottom:12}}>
        <span style={{fontWeight:600,fontSize:16}}>{s}</span><Say text={s} lang={lang} rate={0.75}/></div>

      <h3 className="lbl">{t.vocabulary}</h3>
      {loadingKw && <div className="status-strip compact" style={{marginBottom:12}}>
        <div className="row" style={{justifyContent:"space-between",alignItems:"baseline"}}>
          <b>{t.lookingUpTitle}</b><span className="tiny muted">{t.aboutRemaining(lookupRemaining)}</span>
        </div>
        <div className="mini-track"><span style={{width:progressPct(lookupElapsed,lookupEstimate)+"%"}}/></div>
      </div>}
      {kw.length?kw.map((w,j)=>{ const e=expl[w.toLowerCase()]||vmap[w.toLowerCase()]; const parts=meaningParts(e); return (<div className="wcard" key={j}>
        <div className="row" style={{justifyContent:"space-between"}}>
          <span className="row" style={{gap:9}}><b style={{fontSize:15}}>{w}</b><span className="badge badge-outline">{(e&&e.pos)||POS[j%POS.length]}</span></span>
          <Say text={w} lang={lang} rate={0.75}/></div>
        {parts.simple ? (<div className="meaning-block">
          <div className="meaning-label">{t.simpleMeaning}</div>
          <div className="meaning-simple">{parts.simple}</div>
          {parts.detail && <div className="meaning-detail">{parts.detail}</div>}
        </div>) : (<div className="meaning-loading">
          <div className="skeleton short"/><div className="skeleton"/>
          <div className="tiny muted" style={{marginTop:7}}>💡 {usageNote(w)}</div>
        </div>)}
        {e&&e.example && <div className="tiny" style={{fontStyle:"italic",marginTop:8}}>📝 {t.example}: “{e.example}”</div>}
      </div>); }):<div className="tiny muted">{t.gram.noWords}</div>}

      {phrases.length>0 && (<><h3 className="lbl" style={{marginTop:16}}>{t.gram.phrases}</h3>
        {phrases.map((p,j)=>(<div className="wcard" key={j}>
          <div className="row" style={{justifyContent:"space-between"}}><b>{p}</b><Say text={p} lang={lang} rate={0.75}/></div>
          <div className="tiny muted" style={{marginTop:6}}>{t.phraseNote}</div>
        </div>))}</>)}

      <div className="tiny muted" style={{marginTop:14}}><b>{t.gram.wordOrder}</b> {t.gram.wordOrderText}</div>
    </div>

    <div className="row" style={{justifyContent:"space-between",marginTop:16}}>
      <button className="btn btn-ghost btn-sm" disabled={gi===0} onClick={()=>setGi(g=>g-1)}>← {t.gram.previous}</button>
      {gi<N-1 ? <button className="btn btn-outline btn-sm" onClick={()=>setGi(g=>g+1)}>{t.gram.next} →</button>
        : <button className="btn btn-primary btn-sm" onClick={()=>setView("summary")}>{t.gram.seeSummary} →</button>}
    </div>
    <div className="tiny muted" style={{textAlign:"center",marginTop:10}}>{t.gram.slow}</div>
  </div>);
}

/* ---------- steps 6 & 7 timed practice with a ready-buffer ---------- */
function TimedPractice({sents,lang,withSubs}){
  const {t}=useUI();
  const list=sents.slice(0,8);
  const [started,setStarted]=useState(false);
  const [idx,setIdx]=useState(0);
  const [phase,setPhase]=useState("listen"); // listen | speak | done
  const [left,setLeft]=useState(0); const [paused,setPaused]=useState(false);
  const [reveal,setReveal]=useState(withSubs); const [nonce,setNonce]=useState(0);
  const cur=list[idx]||"";
  const secs=Math.min(12,Math.max(4,Math.round(cur.split(/\s+/).filter(Boolean).length*0.9)));

  useEffect(()=>{ if(!started) return; if(idx>=list.length){setPhase("done");return;}
    setReveal(withSubs); setPhase("listen"); stopSpeak(); let done=false;
    const toSpeak=()=>{ if(!done){ done=true; setPhase("speak"); setLeft(secs); } };
    const u=speak(cur,lang,0.75);
    if(u) u.onend=toSpeak;                  // advance to "your turn" only when the audio actually finishes
    const safety=setTimeout(toSpeak,30000); // safety net in case audio never signals
    return ()=>{ done=true; clearTimeout(safety); stopSpeak(); };
  },[idx,nonce,started]);

  useEffect(()=>{ if(!started||phase!=="speak"||paused)return;
    if(left<=0){ if(idx<list.length-1)setIdx(idx+1); else setPhase("done"); return; }
    const t=setTimeout(()=>setLeft(l=>l-1),1000); return ()=>clearTimeout(t);
  },[phase,left,paused,idx,started]);

  function togglePause(){ if(!paused){ stopSpeak(); setPaused(true); } else { setPaused(false); if(phase==="listen") setNonce(n=>n+1); } }

  const head=(<><div className="eyebrow">{t.stepPhases[6]}</div><h2>{t.timed.title(withSubs)}</h2></>);

  if(!started) return (<div>{head}
    <Teacher>{withSubs?t.timed.teacherSubs:t.timed.teacherNoSubs}</Teacher>
    <Purpose>{t.timed.purpose}</Purpose>
    <div className="card card-p" style={{marginBottom:16}}>
      <div style={{fontWeight:500,marginBottom:6}}>{t.timed.how}</div>
      <ul className="clean tiny muted">{t.timed.tips.map((tip,i)=><li key={i}>{tip}</li>)}</ul>
    </div>
    <button className="btn btn-primary" onClick={()=>{setStarted(true);setIdx(0);setNonce(n=>n+1);}}>▶ {t.timed.ready}</button>
    <div className="tiny muted" style={{marginTop:10}}>{t.timed.breath}</div>
  </div>);

  if(phase==="done") return (<div>{head}
    <div className="card bigcard"><div style={{fontSize:34}}>✓</div>
      <div className="bigsent" style={{fontSize:18}}>{t.timed.done(list.length)}</div>
      <button className="btn btn-outline btn-sm" onClick={()=>{setIdx(0);setNonce(n=>n+1);}}>↺ {t.timed.again}</button></div>
    <CheckIn>{t.timed.doneCheck}</CheckIn>
  </div>);

  return (<div>{head}
    <div className="card bigcard">
      <div className="row" style={{gap:8}}><span className="badge badge-outline">{idx+1} / {list.length}</span>
        <span className="phaselab" style={{color:phase==="speak"?"hsl(var(--success))":"hsl(var(--muted-foreground))"}}>{phase==="listen"?`🎧 ${t.timed.listen}`:`🗣️ ${t.timed.yourTurn}`}</span></div>
      {(withSubs||reveal) ? <div className="bigsent">{cur}</div> : <div className="bigsent muted" style={{opacity:.4}}>• • •</div>}
      {phase==="speak" && <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
        <div className="timerbar"><span style={{width:(left/secs*100)+"%"}}/></div><div className="count">{left}s</div></div>}
      {!withSubs && <button className="btn btn-outline btn-sm" onClick={()=>setReveal(r=>!r)}>{reveal?t.timed.hide:t.timed.reveal}</button>}
    </div>
    <div className="row" style={{justifyContent:"center",gap:8,marginTop:16}}>
      <button className="btn btn-ghost btn-sm" disabled={idx===0} onClick={()=>{stopSpeak();setIdx(i=>Math.max(0,i-1));}}>← {t.back}</button>
      <button className="btn btn-outline btn-sm" onClick={()=>setNonce(n=>n+1)}>▶ {t.timed.replay}</button>
      <button className="btn btn-outline btn-sm" onClick={togglePause}>{paused?t.timed.resume:t.timed.pause}</button>
      <button className="btn btn-ghost btn-sm" onClick={()=>{stopSpeak(); if(idx<list.length-1)setIdx(i=>i+1); else setPhase("done");}}>{t.timed.skip} →</button>
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
    <div className="eyebrow">{t.stepPhases[9]}</div><h2>{t.aiUse.title}</h2>
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
  const {lang,level,vocab,sents}=lesson;
  const topic=(sents[0]||"the topic").replace(/[.!?。！？]+$/,"");
  const shortTopic=topic.length>90?topic.slice(0,90)+"…":topic;
  const question=t.aiUse.question(shortTopic,lang);
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
    <div className="row wrap" style={{gap:7,marginBottom:14}}>{vocab.slice(0,8).map(v=><span key={v.word} className="badge">{v.word}</span>)}</div>
    <div className="card card-p" style={{marginBottom:14}}><div className="row" style={{gap:10}}>
      <div className="tface">👩‍🏫</div><div style={{fontWeight:500}}>{question}</div></div></div>
    <textarea style={{minHeight:130}} value={textv} onChange={e=>setTextv(e.target.value)} placeholder={t.aiUse.writePlaceholder(lang)}/>
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
  const {lang,level,vocab,topics,grammarFocus,sents}=lesson;
  const vwords=vocab.slice(0,6).map(v=>v.word);
  const topic=(topics&&topics.join(", "))||"the text";
  const grammar=(grammarFocus&&grammarFocus.join("; "))||"";
  const sample=(sents||[]).slice(0,8).join(" ");
  const partner=PARTNER[lang]||PARTNER._;
  const fallback=chatFallback(lang,vwords[0]);
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
      <span>{t.chat.notice(partner.name,lang,MAX_TURNS)}</span></div>

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
        <div className="tiny muted" style={{marginTop:8}}>{t.chat.speakIn(lang)}</div>
      </div>) : <div className="tiny muted" style={{marginBottom:6}}>{t.chat.typeIn(lang)}</div>}
      <textarea style={{minHeight:56,marginTop:12}} value={draft} onChange={e=>setDraft(e.target.value)} placeholder={t.chat.placeholder(lang)}/>
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
        </div>) : (<div className="muted">{t.chat.mockDone(lang)}</div>)}
      </div>)}
  </div>);
}

/* ---------- celebration ---------- */
function Done({lesson,onNew,onReview}){
  const {t}=useUI();
  const name=(DB.get("email","")||"").split("@")[0]||t.done.friend;
  const before=DB.get("selfBefore",30);
  const [after,setAfter]=useState(DB.get("selfAfter",null)); const [tmp,setTmp]=useState(70);
  const delta=after!=null?after-before:0;
  return (<div>
    <div className="celebrate">
      <div style={{fontSize:52,lineHeight:1}}>🎉</div>
      <h1 style={{marginTop:10}}>{t.done.title(name)}</h1>
      <p className="sub" style={{maxWidth:470,margin:"8px auto 0"}}>{t.done.sub(STEPS.length)}</p>
    </div>

    <div className="card card-p" style={{margin:"18px 0",background:"hsl(var(--warm)/.07)",borderColor:"hsl(var(--warm)/.25)",textAlign:"center"}}>
      <div style={{fontSize:26}}>📚✨</div>
      <div style={{fontWeight:600,marginTop:6}}>{t.done.explored(lesson.topics.slice(0,2).join(" & "))}</div>
      <div className="row wrap" style={{gap:7,justifyContent:"center",marginTop:10}}>{lesson.topics.map(t=><span key={t} className="badge badge-warm">{t}</span>)}</div>
      <div className="tiny muted" style={{marginTop:10}}>{t.done.more}</div>
    </div>

    <div className="grid4" style={{marginBottom:18}}>
      <Stat k={"🏁 "+t.done.steps} v={STEPS.length+" / "+STEPS.length}/>
      <Stat k={"📖 "+t.done.words} v={lesson.vocabCount}/>
      <Stat k={"🗣️ "+t.done.sentences} v={Math.min(8,lesson.sents.length)}/>
      <Stat k={"🧩 "+t.done.blocks} v={PLAN_BLOCKS.length}/>
    </div>

    <div className="card card-p" style={{marginBottom:18}}>
      <h3 className="lbl">📈 {t.done.comp}</h3>
      {after==null ? (<div>
        <SelfRate value={tmp} prompt={t.done.rate} onChange={setTmp}/>
        <div style={{marginTop:14}}><button className="btn btn-outline btn-sm" onClick={()=>{setAfter(tmp);DB.set("selfAfter",tmp);}}>{t.done.reveal} ✨</button></div>
      </div>) : (<div>
        <div style={{marginBottom:12}}>
          <div className="row" style={{justifyContent:"space-between",marginBottom:5}}><span className="tiny muted">{t.done.before}</span><span className="tiny" style={{fontWeight:600}}>{before}%</span></div>
          <div className="gbar"><span className="before" style={{width:before+"%"}}/></div></div>
        <div>
          <div className="row" style={{justifyContent:"space-between",marginBottom:5}}><span className="tiny muted">{t.done.after}</span><span className="tiny" style={{fontWeight:600}}>{after}%</span></div>
          <div className="gbar"><span className="after" style={{width:after+"%"}}/></div></div>
        <div style={{textAlign:"center",marginTop:14}}>
          {delta>0 ? <span className="badge badge-success" style={{fontSize:14,padding:"6px 14px"}}>▲ {t.done.gain(delta)}</span>
            : <span className="badge" style={{fontSize:14,padding:"6px 14px"}}>{t.done.again}</span>}
        </div>
      </div>)}
    </div>

    <div className="card card-p" style={{marginBottom:20}}>
      <h3 className="lbl">🎒 {t.done.take}</h3>
      <div className="row wrap" style={{gap:7}}>{lesson.vocab.map(v=><span key={v.word} className="badge">{v.word}</span>)}</div>
    </div>

    <div className="row" style={{justifyContent:"center",gap:10}}>
      <button className="btn btn-outline" onClick={onReview}>↺ {t.done.review}</button>
      <button className="btn btn-primary" onClick={onNew}>{t.done.new} →</button>
    </div>
  </div>);
}

/* ---------- root ---------- */
function App(){
  const [uiLang,setUiLangState]=useState(DB.get("uiLang","en"));
  const t=UI_TEXT[uiLang]||UI_TEXT.en;
  function setUiLang(next){ setUiLangState(next); DB.set("uiLang",next); }
  useEffect(()=>{ document.documentElement.lang=uiLang==="zh"?"zh-CN":"en"; },[uiLang]);
  const [screen,setScreen]=useState(DB.get("email")?"input":"login");
  const [lesson,setLesson]=useState(null); const [text,setText]=useState("");
  async function loadLesson(d){ setText(d.text); DB.set("progress",0); DB.set("selfAfter",null); setScreen("loading");
    try{ const r=await fetch("/api/lesson",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}); if(!r.ok) throw new Error("api"); const L=await r.json(); setLesson(L); setScreen("preview"); }
    catch(e){ setLesson(generateLesson(d.text,d.lang,d.level,d.goal)); setScreen("preview"); } }
  function clearAll(){ if(confirm(t.clearConfirm)){DB.clearAll();location.reload();} }
  return (<UIContext.Provider value={{uiLang,setUiLang,t}}><div className="app">
    {screen!=="login" && screen!=="lesson" && (<div className="topbar"><Brand/>
      <div className="row wrap" style={{justifyContent:"flex-end"}}><LanguageSwitch/><button className="btn btn-ghost btn-sm muted" onClick={clearAll}>{t.clearLocalData}</button>
        {screen!=="input" && <button className="btn btn-outline btn-sm" onClick={()=>setScreen("input")}>{t.newMaterial}</button>}</div></div>)}
    {screen==="login" && <Login onDone={()=>setScreen("input")}/>}
    {screen==="loading" && <Loading/>}
    {screen==="input" && <InputScreen onNext={loadLesson}/>}
    {screen==="preview" && lesson && <Preview lesson={lesson} onBack={()=>setScreen("input")} onStart={()=>setScreen("lesson")}/>}
    {screen==="lesson" && lesson && <Lesson lesson={lesson} text={text} onFinish={()=>setScreen("done")}/>}
    {screen==="done" && lesson && <Done lesson={lesson} onNew={()=>setScreen("input")} onReview={()=>{DB.set("progress",0);setScreen("lesson");}}/>}
  </div></UIContext.Provider>);
}
export default function Page(){ return <App/>; }
