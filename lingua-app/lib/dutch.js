import { hasCjk } from "./format";

function safeDutchMaterial(m){
  if(!m||!m.text) return false;
  return !hasCjk(m.title)&&!hasCjk(m.text);
}

const DUTCH_HINTS={
  koopt:{pos:"verb",en:"buys",zh:"买",detailEn:"third-person singular of kopen",detailZh:"kopen 的第三人称单数",lemma:"kopen",formLabel:"third-person singular present",formZh:"现在时第三人称单数"},
  koop:{pos:"verb",en:"buy",zh:"买",lemma:"kopen",formLabel:"first-person singular present or imperative",formZh:"现在时第一人称单数或命令式"}, kopen:{pos:"verb",en:"to buy",zh:"买",lemma:"kopen",formLabel:"infinitive",formZh:"动词原形"},
  brood:{pos:"noun",en:"bread",zh:"面包"}, kaas:{pos:"noun",en:"cheese",zh:"奶酪"}, fruit:{pos:"noun",en:"fruit",zh:"水果"},
  kassa:{pos:"noun",en:"cash register",zh:"收银台"}, caissière:{pos:"noun",en:"cashier",zh:"女收银员"}, kassier:{pos:"noun",en:"cashier",zh:"收银员"},
  zegt:{pos:"verb",en:"says",zh:"说",lemma:"zeggen",formLabel:"third-person singular present",formZh:"现在时第三人称单数"}, zeggen:{pos:"verb",en:"to say",zh:"说",lemma:"zeggen",formLabel:"infinitive",formZh:"动词原形"},
  betaal:{pos:"verb",en:"pay",zh:"付款",lemma:"betalen",formLabel:"first-person singular present or imperative",formZh:"现在时第一人称单数或命令式"}, betaalt:{pos:"verb",en:"pays",zh:"付款",lemma:"betalen",formLabel:"third-person singular present",formZh:"现在时第三人称单数"}, contant:{pos:"adverb",en:"in cash",zh:"用现金"},
  geld:{pos:"noun",en:"money",zh:"钱"}, geeft:{pos:"verb",en:"gives",zh:"给",lemma:"geven",formLabel:"third-person singular present",formZh:"现在时第三人称单数"}, geven:{pos:"verb",en:"to give",zh:"给",lemma:"geven",formLabel:"infinitive",formZh:"动词原形"},
  dank:{pos:"phrase",en:"thanks",zh:"谢谢"}, dankjewel:{pos:"phrase",en:"thank you",zh:"谢谢你"}, bedankt:{pos:"phrase",en:"thanks",zh:"谢谢"},
  goedenavond:{pos:"phrase",en:"good evening",zh:"晚上好"}, goedemorgen:{pos:"phrase",en:"good morning",zh:"早上好"}, alstublieft:{pos:"phrase",en:"please",zh:"请/给您"},
  ziens:{pos:"phrase",en:"goodbye",zh:"再见"}, avond:{pos:"noun",en:"evening",zh:"晚上"}, prettige:{pos:"adjective",en:"pleasant",zh:"愉快的"},
  huis:{pos:"noun",en:"home",zh:"家"}, gaat:{pos:"verb",en:"goes",zh:"去",lemma:"gaan",formLabel:"third-person singular present",formZh:"现在时第三人称单数"}, gaan:{pos:"verb",en:"to go",zh:"去",lemma:"gaan",formLabel:"infinitive",formZh:"动词原形"},
  kookt:{pos:"verb",en:"cooks",zh:"做饭",lemma:"koken",formLabel:"third-person singular present",formZh:"现在时第三人称单数"}, koken:{pos:"verb",en:"to cook",zh:"做饭",lemma:"koken",formLabel:"infinitive",formZh:"动词原形"}, lekker:{pos:"adjective",en:"tasty",zh:"好吃的"}, avondeten:{pos:"noun",en:"dinner",zh:"晚饭"},
  supermarkt:{pos:"noun",en:"supermarket",zh:"超市"}, meneer:{pos:"noun",en:"mister",zh:"先生"}, mevrouw:{pos:"noun",en:"madam",zh:"女士"},
};

const COMMON_DUTCH_VERBS={
  ben:"zijn",bent:"zijn",is:"zijn",zijn:"zijn",was:"zijn",waren:"zijn",
  heb:"hebben",hebt:"hebben",heeft:"hebben",hebben:"hebben",had:"hebben",hadden:"hebben",
  doe:"doen",doet:"doen",doen:"doen",deed:"doen",deden:"doen",
  kom:"komen",komt:"komen",komen:"komen",kwam:"komen",kwamen:"komen",
  sta:"staan",staat:"staan",staan:"staan",stond:"staan",stonden:"staan",
  ga:"gaan",gaat:"gaan",gaan:"gaan",ging:"gaan",gingen:"gaan",
  woon:"wonen",woont:"wonen",wonen:"wonen",woonde:"wonen",woonden:"wonen",
  maak:"maken",maakt:"maken",maken:"maken",maakte:"maken",maakten:"maken",
  help:"helpen",helpt:"helpen",helpen:"helpen",hielp:"helpen",
  vraag:"vragen",vraagt:"vragen",vragen:"vragen",vroeg:"vragen",
  betaal:"betalen",betaalt:"betalen",betalen:"betalen",betaalde:"betalen",
};

const DUTCH_VERB_FORMS={
  zijn:{present:"ben / bent / is / zijn",past:"was / waren",presentPerfect:"ben geweest",firstPerson:"ik ben",secondPerson:"jij bent",thirdPersonPlural:"hij is / wij zijn"},
  hebben:{present:"heb / hebt / heeft / hebben",past:"had / hadden",presentPerfect:"heb gehad",firstPerson:"ik heb",secondPerson:"jij hebt",thirdPersonPlural:"hij heeft / wij hebben"},
  doen:{present:"doe / doet / doen",past:"deed / deden",presentPerfect:"heb gedaan",firstPerson:"ik doe",secondPerson:"jij doet",thirdPersonPlural:"hij doet / wij doen"},
  komen:{present:"kom / komt / komen",past:"kwam / kwamen",presentPerfect:"ben gekomen",firstPerson:"ik kom",secondPerson:"jij komt",thirdPersonPlural:"hij komt / wij komen"},
  staan:{present:"sta / staat / staan",past:"stond / stonden",presentPerfect:"heb gestaan",firstPerson:"ik sta",secondPerson:"jij staat",thirdPersonPlural:"hij staat / wij staan"},
  gaan:{present:"ga / gaat / gaan",past:"ging / gingen",presentPerfect:"ben gegaan",firstPerson:"ik ga",secondPerson:"jij gaat",thirdPersonPlural:"hij gaat / wij gaan"},
  wonen:{present:"woon / woont / wonen",past:"woonde / woonden",presentPerfect:"heb gewoond",firstPerson:"ik woon",secondPerson:"jij woont",thirdPersonPlural:"hij woont / wij wonen"},
  maken:{present:"maak / maakt / maken",past:"maakte / maakten",presentPerfect:"heb gemaakt",firstPerson:"ik maak",secondPerson:"jij maakt",thirdPersonPlural:"hij maakt / wij maken"},
  helpen:{present:"help / helpt / helpen",past:"hielp / hielpen",presentPerfect:"heb geholpen",firstPerson:"ik help",secondPerson:"jij helpt",thirdPersonPlural:"hij helpt / wij helpen"},
  vragen:{present:"vraag / vraagt / vragen",past:"vroeg / vroegen",presentPerfect:"heb gevraagd",firstPerson:"ik vraag",secondPerson:"jij vraagt",thirdPersonPlural:"hij vraagt / wij vragen"},
  betalen:{present:"betaal / betaalt / betalen",past:"betaalde / betaalden",presentPerfect:"heb betaald",firstPerson:"ik betaal",secondPerson:"jij betaalt",thirdPersonPlural:"hij betaalt / wij betalen"},
  kopen:{present:"koop / koopt / kopen",past:"kocht / kochten",presentPerfect:"heb gekocht",firstPerson:"ik koop",secondPerson:"jij koopt",thirdPersonPlural:"hij koopt / wij kopen"},
  zeggen:{present:"zeg / zegt / zeggen",past:"zei / zeiden",presentPerfect:"heb gezegd",firstPerson:"ik zeg",secondPerson:"jij zegt",thirdPersonPlural:"hij zegt / wij zeggen"},
  geven:{present:"geef / geeft / geven",past:"gaf / gaven",presentPerfect:"heb gegeven",firstPerson:"ik geef",secondPerson:"jij geeft",thirdPersonPlural:"hij geeft / wij geven"},
  koken:{present:"kook / kookt / koken",past:"kookte / kookten",presentPerfect:"heb gekookt",firstPerson:"ik kook",secondPerson:"jij kookt",thirdPersonPlural:"hij kookt / wij koken"},
};

function dutchVerbForms(lemma,uiLang="en"){
  const forms=DUTCH_VERB_FORMS[String(lemma||"").toLowerCase()];
  if(!forms) return null;
  const zh=uiLang==="zh";
  const notes=zh
    ? {
        present:"现在时常见形式",
        past:"过去时常见形式",
        presentPerfect:"现在完成时常见形式",
        firstPerson:"第一人称单数",
        secondPerson:"第二人称单数",
        thirdPersonPlural:"第三人称单数 / 复数",
      }
    : {
        present:"common present-tense forms",
        past:"common past-tense forms",
        presentPerfect:"common present perfect",
        firstPerson:"first-person singular",
        secondPerson:"second-person singular",
        thirdPersonPlural:"third-person singular / plural",
      };
  return Object.fromEntries(Object.entries(forms).map(([key,form])=>[key,{form,note:notes[key]||""}]));
}

function inferDutchPos(word){
  const w=String(word||"").toLowerCase();
  if(DUTCH_HINTS[w]?.pos) return DUTCH_HINTS[w].pos;
  if(/(en)$/.test(w)) return "verb";
  if(/(t|dt)$/.test(w)) return "verb";
  if(/(ig|lijk|isch|e)$/.test(w)) return "adjective";
  return "noun";
}

function inferDutchVerbForm(word,uiLang="en"){
  const w=String(word||"").toLowerCase();
  const lemma=COMMON_DUTCH_VERBS[w] || DUTCH_HINTS[w]?.lemma || (/(en)$/.test(w)?w:null);
  if(!lemma) return {};
  const zh=uiLang==="zh";
  let label="verb form";
  let labelZh="动词变形";
  if(w===lemma){ label="infinitive"; labelZh="动词原形"; }
  else if(/(de|te)$/.test(w)){ label="simple past"; labelZh="过去式"; }
  else if(/t$/.test(w)){ label="third-person singular present"; labelZh="现在时第三人称单数"; }
  return {lemma,formLabel:label,formExplanation:zh?labelZh:label};
}

function fallbackWordInfo(word,lang,uiLang="en"){
  const w=String(word||"").toLowerCase();
  const h=lang==="Dutch" ? DUTCH_HINTS[w] : null;
  const form=lang==="Dutch" ? inferDutchVerbForm(w,uiLang) : {};
  const verbForms=lang==="Dutch" ? dutchVerbForms(form.lemma||h?.lemma||w,uiLang) : null;
  if(!h) return {word,pos:lang==="Dutch"?inferDutchPos(w):"phrase",simpleMeaning:word,detail:null,...form,verbForms};
  const zh=uiLang==="zh";
  return {word,pos:h.pos||inferDutchPos(w),simpleMeaning:zh?(h.zh||h.en):(h.en||h.zh),detail:zh?(h.detailZh||h.detailEn||null):(h.detailEn||h.detailZh||null),lemma:h.lemma||form.lemma||null,formLabel:h.formLabel||form.formLabel||null,formExplanation:zh?(h.formZh||form.formExplanation||null):(h.formLabel||form.formExplanation||null),verbForms};
}

function displayWordInfo(word,lang,uiLang,base,ai){
  const fallback=fallbackWordInfo(word,lang,uiLang);
  const out={...(base||{}),...fallback,...(ai||{}),word:(base&&base.word)||word};
  if(!out.verbForms && fallback.verbForms) out.verbForms=fallback.verbForms;
  return out;
}

export { DUTCH_HINTS, displayWordInfo, fallbackWordInfo, inferDutchPos, safeDutchMaterial };
