import { useEffect, useRef, useState } from "react";
import { AerolitoLiveChat, type AerolitoLiveStatus } from "@/lib/aerolito-live";
import { createInterviewController, type InterviewController } from "./AerolitoInterview";

interface Message { role: "user" | "model"; text: string }

const WELCOME = "Olá! Sou o RAG do Gui, agora Head de Pesquisa na Aerolito. Vou começar com 5 perguntas rápidas pra entender o que vocês esperam de mim — depois a gente fica livre pra conversar sobre o que quiser sobre o Gui.";

const MAX_MESSAGES = 30;

export default function AerolitoChatWidget() {
  const [messages, setMessages] = useState<Message[]>([{ role: "model", text: WELCOME }]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<AerolitoLiveStatus>("disconnected");
  const [mode, setMode] = useState<"normal" | "interview">("normal");
  const liveRef = useRef<AerolitoLiveChat | null>(null);
  const interviewRef = useRef<InterviewController | null>(null);
  const currentModelMsgIdx = useRef<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function ensureLiveReady(): Promise<AerolitoLiveChat | null> {
    if (liveRef.current && status !== "disconnected" && status !== "error") return liveRef.current;
    try {
      const resp = await fetch("/api/aerolito-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input || "" }),
      });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      const data = await resp.json() as { token: string; fullSystemPrompt: string };
      const live = new AerolitoLiveChat(data.token, {
        onStatusChange: setStatus,
        onTranscriptChunk: (text) => {
          setMessages((prev) => {
            const next = [...prev];
            const i = currentModelMsgIdx.current;
            if (i == null) {
              next.push({ role: "model", text });
              currentModelMsgIdx.current = next.length - 1;
            } else {
              next[i] = { ...next[i], text: next[i].text + text };
            }
            return next;
          });
        },
        onTurnComplete: () => { currentModelMsgIdx.current = null; },
        onError: (err) => {
          setMessages((prev) => [...prev, { role: "model", text: `(erro: ${err})` }]);
        },
      }, data.fullSystemPrompt);
      await live.start();
      liveRef.current = live;
      return live;
    } catch (err) {
      console.error("aerolito-chat: ensureLiveReady failed", err);
      setStatus("error");
      return null;
    }
  }

  async function sendUserMessage(text: string) {
    if (!text.trim() || messages.length >= MAX_MESSAGES) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    const live = await ensureLiveReady();
    if (!live) return;
    live.sendUserText(text);
  }

  async function startInterview(startStep: number = 1) {
    if (mode === "interview") return;
    const live = await ensureLiveReady();
    if (!live) return;
    setMode("interview");
    interviewRef.current = createInterviewController({
      sayFixed: (t) => live.sayFixed(t),
      submitAnswer: async (payload) => {
        const r = await fetch("/api/aerolito-submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!r.ok) throw new Error(`status ${r.status}`);
      },
    });
    interviewRef.current.start(startStep);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    if (mode === "interview" && interviewRef.current) {
      setMessages((prev) => [...prev, { role: "user", text }]);
      setInput("");
      await interviewRef.current.onAnswer(text);
      if (interviewRef.current.getStep() === "done") {
        setMode("normal");
      }
    } else {
      await sendUserMessage(text);
    }
  }

  // Auto-start: assim que o chat monta, dispara a entrevista (Q1) sem precisar de
  // botão. AudioContext é criado em startInterview→ensureLiveReady; o gesture
  // que abriu o overlay (CTA da intro) ainda conta como user activation.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await startInterview(1);
    })();
    return () => { cancelled = true; liveRef.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const interviewProgress = mode === "interview" && interviewRef.current
    ? (interviewRef.current.getStep() === "done" ? "Concluído" : `Pergunta ${interviewRef.current.getStep()} de 5`)
    : null;

  return (
    <div className="flex flex-col h-[640px] max-h-[80vh] bg-background border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60">
        <div className="flex items-center gap-3">
          <img src="/guilherme-foto.webp" alt="Gui" className="w-9 h-9 rounded-full object-cover border border-neon/30" loading="lazy" decoding="async" />
          <div>
            <p className="font-display font-semibold text-foreground text-[14px] uppercase tracking-tight leading-none">Gui · <span className="text-neon">RAG</span></p>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em] mt-0.5">{status}</p>
          </div>
        </div>
        {interviewProgress && (
          <span className="font-mono text-[10px] text-neon uppercase tracking-wider">{interviewProgress}</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 bg-background/50">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} mb-3`}>
            <div className={`max-w-[78%] px-3.5 py-2.5 rounded-md text-[13px] leading-relaxed font-sans ${msg.role === "user" ? "bg-neon text-background font-medium" : "bg-card border border-border text-muted-foreground"}`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-card/40">

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={mode === "interview" ? "Sua resposta…" : "Pergunte algo…"}
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-[13px] font-sans text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-neon/40 focus:ring-1 focus:ring-neon/20"
          />
          <button onClick={handleSend} disabled={!input.trim()} aria-label="Enviar" className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-md bg-neon text-background disabled:opacity-30 disabled:cursor-not-allowed">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
