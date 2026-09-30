const WORD_RE=/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu;

function normalizeRecallText(value){
  return String(value||"")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[’]/g,"'")
    .replace(/[^\p{L}\p{N}'\-]+/gu," ")
    .trim()
    .replace(/\s+/g," ");
}

function recallTokens(value){ return normalizeRecallText(value).match(WORD_RE)||[]; }

function editDistance(a,b){
  const x=String(a||""), y=String(b||"");
  const prev=Array.from({length:y.length+1},(_,i)=>i);
  for(let i=1;i<=x.length;i++){
    let diagonal=prev[0]; prev[0]=i;
    for(let j=1;j<=y.length;j++){
      const old=prev[j];
      prev[j]=Math.min(prev[j]+1,prev[j-1]+1,diagonal+(x[i-1]===y[j-1]?0:1));
      diagonal=old;
    }
  }
  return prev[y.length];
}

function lcsPairs(actual,expected){
  const rows=actual.length+1, cols=expected.length+1;
  const dp=Array.from({length:rows},()=>Array(cols).fill(0));
  for(let i=actual.length-1;i>=0;i--) for(let j=expected.length-1;j>=0;j--){
    dp[i][j]=actual[i]===expected[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);
  }
  const pairs=[]; let i=0,j=0;
  while(i<actual.length&&j<expected.length){
    if(actual[i]===expected[j]){ pairs.push([i,j]); i++; j++; }
    else if(dp[i+1][j]>=dp[i][j+1]) i++; else j++;
  }
  return pairs;
}

function diffRecallTokens(answer,expected){
  const actual=recallTokens(answer), target=recallTokens(expected);
  const pairs=lcsPairs(actual,target);
  const actualOk=new Set(pairs.map(x=>x[0])), targetOk=new Set(pairs.map(x=>x[1]));
  return {
    actual:actual.map((token,index)=>({token,status:actualOk.has(index)?"correct":"extra"})),
    expected:target.map((token,index)=>({token,status:targetOk.has(index)?"correct":"missing"})),
  };
}

function sameBag(a,b){
  if(a.length!==b.length) return false;
  return [...a].sort().every((token,index)=>token===[...b].sort()[index]);
}

function compareRecallAnswer(answer,expected,{sentence=false}={}){
  const actual=recallTokens(answer), target=recallTokens(expected);
  const exact=normalizeRecallText(answer)===normalizeRecallText(expected);
  const categories=[];
  if(!exact){
    if(sameBag(actual,target)) categories.push("word_order");
    else {
      const comparable=actual.length===target.length&&actual.length>0;
      const spellingOnly=comparable&&actual.every((token,i)=>token===target[i]||editDistance(token,target[i])<=2);
      if(spellingOnly) categories.push("spelling");
      else {
        const remaining=[...target];
        actual.forEach(token=>{ const i=remaining.indexOf(token); if(i>=0) remaining.splice(i,1); });
        if(remaining.length) categories.push("missing_word");
        const targetRemaining=[...actual];
        target.forEach(token=>{ const i=targetRemaining.indexOf(token); if(i>=0) targetRemaining.splice(i,1); });
        if(targetRemaining.length) categories.push("extra_word");
      }
    }
  }
  const pairs=lcsPairs(actual,target).length;
  const similarity=target.length?pairs/Math.max(actual.length,target.length):0;
  const near=sentence&&similarity>=.88&&Math.abs(actual.length-target.length)<=1;
  return {
    accepted:exact||near,
    exact,
    similarity,
    categories:[...new Set(categories)],
    correctedAnswer:expected,
    diff:diffRecallTokens(answer,expected),
    needsReview:sentence&&!exact&&!near,
  };
}

function wordMatches(sentence){ return [...String(sentence||"").matchAll(WORD_RE)]; }

function phraseFromSentence(sentence,userWords=[]){
  const matches=wordMatches(sentence);
  if(!matches.length) return "";
  const wanted=new Set((userWords||[]).map(normalizeRecallText));
  let pivot=matches.findIndex(m=>wanted.has(normalizeRecallText(m[0])));
  if(pivot<0) pivot=Math.max(0,Math.floor(matches.length/2)-1);
  const size=Math.min(matches.length>=5?4:Math.max(2,matches.length),6);
  let start=Math.max(0,pivot-1);
  start=Math.min(start,Math.max(0,matches.length-size));
  const end=Math.min(matches.length,start+size);
  const from=matches[start].index;
  const last=matches[end-1];
  return sentence.slice(from,last.index+last[0].length);
}

function makeRecallItem(sentence,index,userWords=[],overrides={}){
  const targetPhrase=String(overrides.targetPhrase||phraseFromSentence(sentence,userWords)).trim();
  const at=targetPhrase?sentence.indexOf(targetPhrase):-1;
  const clozeText=at>=0?sentence.slice(0,at)+"_____"+sentence.slice(at+targetPhrase.length):sentence;
  return {
    id:`recall-${index}-${normalizeRecallText(sentence).slice(0,24).replace(/\s/g,"-")}`,
    sourceSentence:sentence,
    translation:overrides.translation||"",
    targetPhrase,
    clozeText,
    clozeType:overrides.clozeType||(index%3===2?"dictation":"blind"),
    attempts:[],
    fullSentenceAttempts:[],
    revealedCloze:false,
    revealedSentence:false,
    mastery:"review",
    reviewTargets:[],
  };
}

function buildFallbackRecallPlan(sentences,userWords=[],max=3){
  const wanted=new Set((userWords||[]).map(normalizeRecallText));
  const ranked=(sentences||[]).map((sentence,index)=>({sentence,index,count:recallTokens(sentence).filter(w=>wanted.has(w)).length}))
    .sort((a,b)=>b.count-a.count||a.index-b.index)
    .slice(0,max);
  return ranked.map((entry,index)=>makeRecallItem(entry.sentence,index,userWords));
}

function mergeRecallPlan(sentences,userWords,planned,max=3){
  const exact=new Set((sentences||[]).map(String));
  const valid=(planned||[]).filter(item=>item&&exact.has(item.sourceSentence)&&String(item.targetPhrase||"").trim()&&item.sourceSentence.includes(item.targetPhrase));
  if(!valid.length) return buildFallbackRecallPlan(sentences,userWords,max);
  return valid.slice(0,max).map((item,index)=>makeRecallItem(item.sourceSentence,index,userWords,item));
}

function masteryForRecallItem(item){
  const full=item.fullSentenceAttempts||[];
  const lastFull=full[full.length-1];
  if(lastFull?.accepted&&!item.revealedSentence&&full.length===1) return "independent";
  if(lastFull?.accepted) return "supported";
  if((item.attempts||[]).some(a=>a.accepted)) return "developing";
  return "review";
}

function summarizeRecall(items=[]){
  const counts={independent:0,supported:0,developing:0,review:0};
  const mastered=[], review=[];
  items.forEach(item=>{
    const mastery=masteryForRecallItem(item); counts[mastery]++;
    if((mastery==="independent"||mastery==="supported")&&item.targetPhrase) mastered.push(item.targetPhrase);
    if(mastery==="developing"||mastery==="review") review.push({
      id:item.id,
      target:item.targetPhrase||item.sourceSentence,
      sentence:item.sourceSentence,
      categories:[...new Set([...(item.attempts||[]),...(item.fullSentenceAttempts||[])].flatMap(a=>a.categories||[]))],
    });
  });
  return {total:items.length,counts,mastered:[...new Set(mastered)],review};
}

export { buildFallbackRecallPlan, compareRecallAnswer, diffRecallTokens, makeRecallItem, masteryForRecallItem, mergeRecallPlan, normalizeRecallText, recallTokens, summarizeRecall };
