const LANG_CODE={Dutch:"nl-NL"};

const PARTNER={Spanish:{name:"Lucía",face:"👩🏻"},French:{name:"Camille",face:"👩🏼"},German:{name:"Lena",face:"👩🏼"},
  Italian:{name:"Giulia",face:"👩🏻"},Portuguese:{name:"Sofia",face:"👩🏽"},Dutch:{name:"Sanne",face:"👩🏼"},
  Japanese:{name:"Yuki",face:"🧑🏻"},Korean:{name:"Minji",face:"👩🏻"},"Mandarin Chinese":{name:"Mei",face:"👩🏻"},
  Arabic:{name:"Layla",face:"🧕🏽"},Russian:{name:"Anna",face:"👩🏼"},English:{name:"Alex",face:"🧑🏼"},_:{name:"your partner",face:"🧑"}};

const POS=["noun","verb","adjective","adverb","phrase"];

const LEVELS=["A1 — Beginner","A2 — Elementary","B1 — Intermediate","B2 — Upper-intermediate","C1 — Advanced"];

function levelIdx(l){ const p=(l||"").slice(0,2); return Math.max(0,LEVELS.findIndex(x=>x.startsWith(p))); }

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

const PLAN_BLOCKS=[
  {name:"Learning",icon:"🎧",items:["Listen","Watch in your language"],min:6},
  {name:"Grammar & Vocabulary",icon:"🔍",items:["Sentence-by-sentence study"],min:7},
  {name:"Practicing",icon:"🗣️",items:["With subtitles","No subtitles","Recall from English"],min:14},
  {name:"Using",icon:"💬",items:["Write & talk with AI"],min:6},
];

const LANGS=Object.keys(LANG_CODE).sort();

const GOALS=["General fluency","Conversation & speaking","Reading comprehension","Vocabulary building","Exam preparation"];

export { GOALS, LANGS, LANG_CODE, LEVELS, MODULES, PARTNER, PLAN_BLOCKS, POS, STEPS, TOTAL_MIN, levelIdx, stepIndex };
