// Only learning state is scoped. Authentication, language and theme retain their existing keys.
const LEARNING_KEYS = new Set(["currentLesson","currentText","unknownWords","resumePath","recallAnswers","recallShown","recallState", "aiPractice","aiPracticeFeedback","aiChatTranscript","aiChatEvaluation","pendingGeneration","pendingSaveAfterLogin"]);
let learningScope = null;
function key(k) { return "lingua:" + (learningScope && (LEARNING_KEYS.has(k) || k.startsWith("analysis:") || k.startsWith("lessonFeedback:") || k.startsWith("savedPractice:") || k.startsWith("trcache:") || k.startsWith("recallState:")) ? `learning:${learningScope}:` : "") + k; }
function setLearningScope(scope) { learningScope = scope || null; }
const DB={ get(k,d){try{return JSON.parse(localStorage.getItem(key(k)))??d}catch(e){return d}},
  set(k,v){localStorage.setItem(key(k),JSON.stringify(v));if(learningScope&&LEARNING_KEYS.has(k)&&typeof window!=="undefined")window.dispatchEvent(new Event("lingua-learning-change"));},
  remove(k){localStorage.removeItem(key(k))},
  clearAll(){Object.keys(localStorage).filter(x=>x.startsWith("lingua:")).forEach(x=>localStorage.removeItem(x))} };
export { DB, setLearningScope };
