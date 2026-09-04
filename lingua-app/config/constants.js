const LANG_CODE={Dutch:"nl-NL"};

const PARTNER={Spanish:{name:"Lucía",face:"👩🏻"},French:{name:"Camille",face:"👩🏼"},German:{name:"Lena",face:"👩🏼"},
  Italian:{name:"Giulia",face:"👩🏻"},Portuguese:{name:"Sofia",face:"👩🏽"},Dutch:{name:"Sanne",face:"👩🏼"},
  Japanese:{name:"Yuki",face:"🧑🏻"},Korean:{name:"Minji",face:"👩🏻"},"Mandarin Chinese":{name:"Mei",face:"👩🏻"},
  Arabic:{name:"Layla",face:"🧕🏽"},Russian:{name:"Anna",face:"👩🏼"},English:{name:"Alex",face:"🧑🏼"},_:{name:"your partner",face:"🧑"}};

const POS=["noun","verb","adjective","adverb","phrase"];

const LEVELS=["A1 — Beginner","A2 — Elementary","B1 — Intermediate","B2 — Upper-intermediate"];

function levelIdx(l){ const p=(l||"").slice(0,2); return Math.max(0,LEVELS.findIndex(x=>x.startsWith(p))); }

// The five learning modules. Each module maps 1:1 to a single step, so the
// sidebar can show them as directly clickable items and learners can jump
// freely between them.
const MODULES=[
  {id:"understanding",icon:"book"},
  {id:"vocabulary",icon:"target"},
  {id:"shadowing",icon:"mic"},
  {id:"recall",icon:"recall"},
  {id:"using",icon:"chat"},
];

const STEPS=[
  {id:"understanding",mod:"understanding",kind:"understand",min:6},
  {id:"vocabulary",mod:"vocabulary",kind:"grammar",min:8},
  {id:"shadowing",mod:"shadowing",kind:"shadow",min:8},
  {id:"recall",mod:"recall",kind:"recall",min:4},
  {id:"using",mod:"using",kind:"using",min:6},
];

// Each learning step maps to its own URL segment under /learn/<slug>.
const STEP_SLUG={understanding:"understanding",vocabulary:"vocabulary",shadowing:"shadowing",recall:"recall",using:"using"};

const TOTAL_MIN=STEPS.reduce((a,s)=>a+s.min,0);

function stepIndex(id){ return STEPS.findIndex(s=>s.id===id); }

const PLAN_BLOCKS=[
  {name:"Understanding",icon:"📖",items:["Sentence-by-sentence meaning"],min:6},
  {name:"Vocabulary & Grammar",icon:"🔍",items:["Your words + key patterns"],min:8},
  {name:"Shadowing",icon:"🗣️",items:["Read along / hidden challenge"],min:8},
  {name:"Recall",icon:"🧠",items:["Recall from meaning"],min:4},
  {name:"Using",icon:"💬",items:["Write & talk with AI"],min:6},
];

const LANGS=Object.keys(LANG_CODE).sort();

const GOALS=["General fluency","Conversation & speaking","Reading comprehension","Vocabulary building","Exam preparation"];

const SUPPORT_CHECKOUT_URL="https://buy.stripe.com/aFa00l0Hh3zU2Xh1bl18c00";

export { GOALS, LANGS, LANG_CODE, LEVELS, MODULES, PARTNER, PLAN_BLOCKS, POS, STEPS, STEP_SLUG, SUPPORT_CHECKOUT_URL, TOTAL_MIN, levelIdx, stepIndex };
