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

export { FEMALE_NAMES, MALE_NAMES, REPORTING_LABEL_WORDS, ROLE_LABELS, dialogueLike, dialogueSegments, genderForSpeaker, isDashTurn, itemText, speakerKey, spokenTextForLine, voiceRoleForLine };
