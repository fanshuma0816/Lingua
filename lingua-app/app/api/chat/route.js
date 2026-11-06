import { authorizeLearning, recordLearningResult } from "../../../lib/lesson-access";
import { apiError } from "../../../lib/api-errors";
// AI writing feedback + live conversation + evaluation.
// Uses whatever provider is configured in lib/ai.js. Returns 204 when no key
// is set (or the call fails) so the client falls back to the simulated version.
import { randomUUID } from "crypto";
import { AI, chatComplete, geminiStream, parseJSON } from "../../../lib/ai";

export const runtime = "nodejs";
export const maxDuration = 60;

function streamText(chunks, access) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    async start(controller) {
      try {
        let complete="";
        for await (const chunk of chunks) {complete+=chunk;controller.enqueue(encoder.encode(chunk));}
        await recordLearningResult(access,complete);
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  }), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

async function chat(req,access) {
  if (!AI.textEnabled) return new Response(null, { status: 204 });
  try {
    const b = await req.json();
    // One turn per request; the lesson id (when the client sends one) groups every
    // AI interaction made while studying that lesson into one AI Observability session.
    const ph = { distinctId: b.userId || undefined, sessionId: b.sessionId || undefined, traceId: randomUUID() };

    if (b.mode === "feedback") {
      const sys = "You are a warm, encouraging language teacher. Reply ONLY with minified JSON.";
      const feedbackLanguage = b.feedbackLanguage || "English";
      const user = `A ${b.level} learner of ${b.lang} answered the prompt "${b.question}". Their writing:\n"""${b.text}"""\nReturn JSON {"grammar": <one short encouraging note in ${feedbackLanguage}>, "vocabulary": <one short note in ${feedbackLanguage}>, "sentence": <one short note in ${feedbackLanguage}>, "revision": <an improved version of their text in ${b.lang}>}. Be specific and kind.`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, ...ph });
      return Response.json(parseJSON(out));
    }

    if (b.mode === "chat") {
      const sys = `You are a warm ${b.lang} conversation partner sitting across from a ${b.level} learner — like a real person chatting face to face, not a chatbot.
Speak ONLY in ${b.lang}. Never use English.
If this is the first message, open naturally in ${b.lang}; do not say the English name of the language unless that is itself ${b.lang}. For Dutch, for example, say "Nederlands", not "Dutch".
The learner just studied THIS text:
"""${(b.sample || "").slice(0, 700)}"""
Ask concrete, specific questions ABOUT that text's ideas and details (not vague "what did you think?"). Give the learner something real to react to, so they always have something to say.
      Gently reuse today's words (${(b.vocab || []).join(", ")}) so replies feel achievable.
Keep EVERY reply to ONE short, natural sentence ending in a question, at or just below ${b.level}. React briefly to what they said before asking the next thing. Be encouraging and human. About 5 exchanges.`;
      const messages = [{ role: "system", content: sys }, ...(Array.isArray(b.history) ? b.history : [])];
      if (b.stream) return streamText(geminiStream(messages, { temp: 0.7, max: 160, ...ph }),access);
      const out = await chatComplete(messages, { temp: 0.7, max: 160, ...ph });
      return Response.json({ reply: out.trim() });
    }

    if (b.mode === "evaluate") {
      const sys = "You are a precise, encouraging language teacher. Reply ONLY with minified JSON. Base every correction on the learner's actual words; never invent an error they did not make.";
      const feedbackLanguage = b.feedbackLanguage || "English";
      const conv = (b.history || []).map(m => `${m.role}: ${m.content}`).join("\n");
      const user = `Here is a short ${b.lang} practice conversation with a ${b.level} learner:\n${conv}
For EACH user turn, quote the learner's exact text, then assess whether its meaning fits the preceding assistant question and whether its grammar is correct. Preserve a correct sentence instead of changing it unnecessarily. If it needs work, give a corrected version and explain the single most useful change. Also offer a natural fuller reply that answers that particular question.
Use ${feedbackLanguage} for all coaching text and ${b.lang} for correctedText and betterReply.
Return JSON {"praise":<one warm, specific sentence in ${feedbackLanguage}>,"turnFeedback":[{"userText":<exact user turn>,"correctedText":<corrected ${b.lang}, or the original when already correct>,"whatWorked":<specific success in ${feedbackLanguage}>,"explanation":<specific meaning or grammar note in ${feedbackLanguage}>,"betterReply":<one natural fuller answer in ${b.lang}>}],"focusNext":<one highest-priority pattern based on these replies in ${feedbackLanguage}>,"practiceSuggestion":<one concrete 2-minute exercise using a learner sentence in ${feedbackLanguage}>}.`;
      const out = await chatComplete([{ role: "system", content: sys }, { role: "user", content: user }], { json: true, ...ph });
      const parsed = parseJSON(out);
      const learnerTurns=(Array.isArray(b.history)?b.history:[]).filter(message=>message.role==="user").map(message=>String(message.content||""));
      const feedback=Array.isArray(parsed.turnFeedback)?parsed.turnFeedback.slice(0,learnerTurns.length).map((entry,index)=>({
        userText:learnerTurns[index]||String(entry.userText||""),
        correctedText:String(entry.correctedText||learnerTurns[index]||""),
        whatWorked:String(entry.whatWorked||""),
        explanation:String(entry.explanation||""),
        betterReply:String(entry.betterReply||""),
      })):[];
      return Response.json({praise:String(parsed.praise||""),turnFeedback:feedback,focusNext:String(parsed.focusNext||""),practiceSuggestion:String(parsed.practiceSuggestion||"")});
    }

    return Response.json({ error: "bad mode" }, { status: 400 });
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}

export async function POST(req) {
 try {
  const body=await req.json(),access=await authorizeLearning(req,body,"chat");
  const response=await chat(new Request(req.url,{method:"POST",headers:req.headers,body:JSON.stringify(body)}),access);
  if(access?.lessonId && response.headers.get("content-type")?.includes("application/json") && response.ok)
   await recordLearningResult(access,await response.clone().json());
  return response;
 } catch(error) {return apiError(error);}
}
