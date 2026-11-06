// Only learning state is scoped. Authentication, language and theme retain their existing keys.
const LEARNING_KEYS = new Set(["currentLesson","currentText","unknownWords","resumePath","recallAnswers","recallShown","recallState", "aiPractice","aiPracticeFeedback","aiChatTranscript","aiChatEvaluation","pendingGeneration","pendingSaveAfterLogin"]);
let learningScope = null;
function key(k) { return "lingua:" + (learningScope && (LEARNING_KEYS.has(k) || k.startsWith("analysis:") || k.startsWith("lessonFeedback:") || k.startsWith("savedPractice:") || k.startsWith("trcache:") || k.startsWith("recallState:")) ? `learning:${learningScope}:` : "") + k; }
function setLearningScope(scope) { learningScope = scope || null; }
// Active lesson state is also cached per tab. Other tabs may update the durable
// local fallback, but must not replace this tab's lesson, answers or pending request.
const perTab=k=>!!learningScope&&LEARNING_KEYS.has(k);
const DB={ get(k,d){try{
    const name=key(k);
    if(perTab(k)){const own=sessionStorage.getItem(name);if(own!==null)return JSON.parse(own)??d;}
    const value=localStorage.getItem(name);
    if(value!==null&&perTab(k))sessionStorage.setItem(name,value);
    return JSON.parse(value)??d;
  }catch(e){return d}},
  set(k,v){if(perTab(k))sessionStorage.setItem(key(k),JSON.stringify(v));localStorage.setItem(key(k),JSON.stringify(v));if(learningScope&&LEARNING_KEYS.has(k)&&typeof window!=="undefined")window.dispatchEvent(new Event("lingua-learning-change"));},
  remove(k){if(perTab(k))sessionStorage.removeItem(key(k));localStorage.removeItem(key(k))},
  clearAll(){Object.keys(localStorage).filter(x=>x.startsWith("lingua:")).forEach(x=>localStorage.removeItem(x));Object.keys(sessionStorage).filter(x=>x.startsWith("lingua:")).forEach(x=>sessionStorage.removeItem(x))} };
export { DB, setLearningScope };
