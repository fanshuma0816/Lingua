import { hasCjk } from "./format";

function safeDutchMaterial(m){
  if(!m||!m.text) return false;
  return !hasCjk(m.title)&&!hasCjk(m.text);
}

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

export { DUTCH_HINTS, displayWordInfo, fallbackWordInfo, inferDutchPos, safeDutchMaterial };
