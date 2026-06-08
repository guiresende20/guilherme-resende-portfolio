import { AEROLITO_QUESTIONS } from "./QUESTIONS";

type Step = number | "done";

export interface InterviewSubmitPayload {
  session_id: string;
  question_idx: number;
  question_text: string;
  answer_text: string;
}

export interface InterviewDeps {
  sayFixed: (text: string) => void;
  submitAnswer: (payload: InterviewSubmitPayload) => Promise<void>;
}

export interface InterviewController {
  /** Inicia a entrevista. startStep é 1-indexed (1..5); default 1 (início). */
  start: (startStep?: number) => void;
  onAnswer: (text: string) => Promise<void>;
  getStep: () => Step;
  getSessionId: () => string;
}

function makeUuidV4(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // RFC 4122 v4 fallback
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createInterviewController(deps: InterviewDeps): InterviewController {
  let step: Step = 0;
  let sessionId = "";

  async function trySubmit(payload: InterviewSubmitPayload): Promise<void> {
    try {
      await deps.submitAnswer(payload);
    } catch {
      // 1 retry com pequena espera
      await new Promise((r) => setTimeout(r, 800));
      await deps.submitAnswer(payload);
    }
  }

  function speakCurrent() {
    if (typeof step === "number" && step >= 1 && step <= AEROLITO_QUESTIONS.length) {
      deps.sayFixed(AEROLITO_QUESTIONS[step - 1]);
    }
  }

  return {
    start(startStep: number = 1) {
      const clamped = Math.max(1, Math.min(AEROLITO_QUESTIONS.length, Math.floor(startStep)));
      sessionId = makeUuidV4();
      step = clamped;
      speakCurrent();
    },
    async onAnswer(text: string) {
      if (step === "done" || typeof step !== "number") return;
      const idx = step;
      await trySubmit({
        session_id: sessionId,
        question_idx: idx,
        question_text: AEROLITO_QUESTIONS[idx - 1],
        answer_text: text,
      }).catch((err) => {
        console.error("AerolitoInterview: submit failed after retry", err);
      });

      if (idx >= AEROLITO_QUESTIONS.length) {
        step = "done";
        deps.sayFixed(
          "Obrigado. Suas respostas vão me ajudar a desenhar como atuar nessa nova função. Quer continuar a conversa?",
        );
        return;
      }
      step = idx + 1;
      speakCurrent();
    },
    getStep() { return step; },
    getSessionId() { return sessionId; },
  };
}
