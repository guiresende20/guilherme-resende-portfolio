import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { sendChatMessage, WELCOME_MESSAGE, type ChatHistory, type ChatAction, type ChatResponse } from "@/lib/gemini";
import { generateCV, type CVType } from "@/lib/generateCV";
import { GeminiLiveChat, type LiveChatStatus } from "@/lib/gemini-live";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import { Mic, MicOff } from "lucide-react";

interface Message {
  role: "user" | "model";
  text: string;
  actions?: ChatAction[];
  id?: string;
}

const MAX_MESSAGES = 20;

// ─── Subcomponents ─────────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-neon/60 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }} />
      ))}
    </div>
  );
}

function VideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-4 md:inset-16 lg:inset-24 z-[61] flex flex-col bg-card border border-border rounded-md overflow-hidden shadow-[0_0_60px_rgba(0,255,135,0.1)]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 flex-shrink-0">
          <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em]">Vídeo do Projeto</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 bg-black relative">
          <iframe
            src={`${url}?autoplay=1&rel=0`}
            className="absolute inset-0 w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            title="Vídeo do projeto"
          />
        </div>
      </div>
    </>
  );
}

function ActionButton({ action, onVideo }: { action: ChatAction; onVideo: (url: string) => void }) {
  const handleClick = () => {
    switch (action.type) {
      case "video":
        if (action.url) onVideo(action.url);
        break;
      case "scroll":
        if (action.section) {
          const el = document.getElementById(action.section);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        break;
      case "link":
      case "whatsapp":
      case "email":
        if (action.url) window.open(action.url, "_blank", "noopener,noreferrer");
        break;
      case "download_cv":
        if (action.cv_type) generateCV(action.cv_type as CVType);
        break;
    }
  };

  const styles: Record<string, string> = {
    video: "border-neon/40 text-neon hover:bg-neon/10 hover:border-neon/70",
    scroll: "border-electric/40 text-electric hover:bg-electric/10 hover:border-electric/70",
    link: "border-border text-muted-foreground hover:border-electric/40 hover:text-electric",
    whatsapp: "border-neon/30 text-neon hover:bg-neon/10",
    email: "border-border text-muted-foreground hover:border-neon/40 hover:text-neon",
    download_cv: "border-electric/40 text-electric hover:bg-electric/10 hover:border-electric/70",
  };

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] border px-3 py-1.5 rounded-sm transition-all duration-200 hover:-translate-y-px ${styles[action.type] || styles.link}`}
    >
      {action.label}
    </button>
  );
}

function ChatBubble({ msg, isLast, onVideo }: { msg: Message; isLast: boolean; onVideo: (url: string) => void }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"} mb-4`}>
      <div className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}>
        {!isUser && (
          <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden border border-neon/30 mr-2 mt-0.5">
            <img src="/guilherme-foto.png" alt="Guilherme" className="w-full h-full object-cover" />
          </div>
        )}
        <div
          className={`max-w-[78%] px-3.5 py-2.5 rounded-md text-[13px] leading-relaxed font-sans ${
            isUser
              ? "bg-neon text-background font-medium rounded-br-sm"
              : "bg-card border border-border text-muted-foreground rounded-bl-sm"
          } ${isLast ? "animate-fade-up" : ""}`}
          style={isLast ? { animationDuration: "0.35s" } : {}}
        >
          {msg.text}
        </div>
      </div>

      {/* Action cards */}
      {!isUser && msg.actions && msg.actions.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2 ml-9">
          {msg.actions.map((action, i) => (
            <ActionButton key={i} action={action} onVideo={onVideo} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Widget ───────────────────────────────────────────────────────────────

export default function ChatWidget() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "model",
      text: t('chat.welcome'),
      id: "1",
      actions: [
        { type: "scroll", label: "↓ Ver Projetos", section: "projetos" },
        { type: "scroll", label: "↓ Experiência", section: "experiencia" },
        { type: "whatsapp", label: "💬 WhatsApp", url: "https://wa.me/5551997925092" },
      ],
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<LiveChatStatus>("disconnected");
  const liveChatRef = useRef<GeminiLiveChat | null>(null);
  const historyRef = useRef<ChatHistory[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setIsVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener("open-chat", handleOpen);
    return () => window.removeEventListener("open-chat", handleOpen);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  // When language changes, update the initial message if it is the only message
  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0].id === "1") {
        return [{ ...prev[0], text: t('chat.welcome') }];
      }
      return prev;
    });
  }, [t]);

  async function toggleLiveAudio() {
    if (liveStatus !== "disconnected") {
      liveChatRef.current?.stop();
      return;
    }
    
    // Conectar - Buscando chave dinâmica do backend para não expor direto no código-fonte nem quebrar Netlify
    let apiKey = "";
    try {
      const resp = await fetch("/api/get-live-key");
      const data = await resp.json();
      apiKey = data.key;
    } catch (e) {
       console.error(e);
    }
    
    if (!apiKey) {
       alert("API Key do Gemini não encontrada no servidor para o modo Live.");
       return;
    }

    const live = new GeminiLiveChat(apiKey, {
      onStatusChange: (status) => setLiveStatus(status),
      onTextAction: (text) => {
        setMessages(prev => [...prev, { role: "model", text }]);
      },
      onTurnComplete: (aiText) => {
        fetch("/api/log-voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ai_response: aiText }),
        }).catch(() => { });
      },
      onError: (err) => {
        alert(err);
      }
    }, SYSTEM_PROMPT);

    liveChatRef.current = live;
    await live.start();
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading || messages.length >= MAX_MESSAGES) return;

    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setIsLoading(true);

    historyRef.current = [...historyRef.current, { role: "user", parts: [{ text }] }];

    try {
      const response: ChatResponse = await sendChatMessage(text, historyRef.current);

      setMessages((prev) => [
        ...prev,
        { role: "model", text: response.text, actions: response.actions },
      ]);

      historyRef.current = [
        ...historyRef.current,
        { role: "model", parts: [{ text: response.text }] },
      ];
    } catch (err: unknown) {
      const errText =
        err instanceof Error && err.message.toLowerCase().includes("quota")
          ? "Limite de uso atingido no momento. Entre em contato diretamente!"
          : "Ops, algo deu errado. Tente novamente em breve.";
      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: errText,
          actions: [
            { type: "email", label: "📩 E-mail", url: "mailto:guiresende20@gmail.com" },
            { type: "whatsapp", label: "💬 WhatsApp", url: "https://wa.me/5551997925092" },
          ],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // Quick question suggestions for first interaction
  const suggestions = [
    { label: "🤝 Fit cultural", text: "Que tipo de ambiente de trabalho você considera ideal para desenvolver seu melhor trabalho?" },
    { label: "💼 Background profissional", text: "Você pode me contar um pouco sobre sua trajetória profissional e os principais tipos de projetos em que atuou?" },
    { label: "🎓 Background acadêmico", text: "Como sua formação acadêmica influenciou a forma como você aborda problemas e projetos hoje?" },
  ];

  const isExhausted = messages.length >= MAX_MESSAGES;
  const isFirstMessage = messages.length === 1;

  return (
    <>
      {/* Video modal */}
      {videoUrl && <VideoModal url={videoUrl} onClose={() => setVideoUrl(null)} />}

      {/* Floating button */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            aria-label="Abrir chat com Guilherme IA"
            className="relative group w-14 h-14 rounded-full bg-neon flex items-center justify-center shadow-neon-strong hover:shadow-[0_0_40px_rgba(0,255,135,0.5)] transition-all duration-300 hover:scale-110 animate-neon-pulse"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0a0a0f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="absolute inset-0 rounded-full border-2 border-neon/40 animate-ping" style={{ animationDuration: "2.5s" }} />
            <span className="absolute right-16 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[11px] text-neon bg-background/90 border border-neon/20 px-2.5 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none backdrop-blur-sm">
              Fale com minha I.A
            </span>
          </button>
        )}
      </div>

      {/* Chat panel */}
      <div
        className={`fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-24px)] transition-all duration-400 origin-bottom-right ${
          isOpen ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 translate-y-4 pointer-events-none"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div className="flex flex-col h-[560px] max-h-[85vh] bg-background border border-border rounded-md shadow-[0_0_60px_rgba(0,0,0,0.6),0_0_30px_rgba(0,255,135,0.05)] overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 bg-card/60 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img src="/guilherme-foto.png" alt="Guilherme" className="w-9 h-9 rounded-full object-cover border border-neon/30" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-neon border-2 border-background shadow-[0_0_6px_rgba(0,255,135,0.8)]" />
              </div>
              <div>
                <p className="font-display font-semibold text-foreground text-[14px] uppercase tracking-tight leading-none">
                  Guilherme <span className="text-neon">I.A</span>
                </p>
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em] mt-0.5">
                  Designer & Pesquisador · Online
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} aria-label="Fechar chat"
              className="w-7 h-7 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 bg-background/50 scroll-smooth">
            <div className="pointer-events-none sticky top-0 h-4 bg-gradient-to-b from-background/80 to-transparent -mt-4 mb-2" />

            {messages.map((msg, i) => (
              <ChatBubble key={i} msg={msg} isLast={i === messages.length - 1} onVideo={setVideoUrl} />
            ))}

            {/* Quick suggestions on first message */}
            {isFirstMessage && !isLoading && (
              <div className="mt-1 mb-2">
                <p className="font-mono text-[9px] text-muted-foreground/50 uppercase tracking-[0.08em] mb-2">Sugestões:</p>
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((s) => (
                    <button key={s.label} onClick={() => { setInput(s.text); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="text-left font-mono text-[10px] text-muted-foreground border border-dim/60 px-3 py-1.5 rounded-sm hover:border-neon/30 hover:text-foreground transition-all duration-200">
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start mb-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full overflow-hidden border border-neon/30 mr-2 mt-0.5">
                  <img src="/guilherme-foto.png" alt="Guilherme" className="w-full h-full object-cover" />
                </div>
                <div className="bg-card border border-border rounded-md rounded-bl-sm px-3.5 py-2.5">
                  <TypingDots />
                </div>
              </div>
            )}

            {liveStatus !== "disconnected" && (
              <div className="sticky bottom-0 flex justify-center py-2 bg-gradient-to-t from-background via-background/90 to-transparent">
                 <div className="flex items-center gap-2 bg-card border border-neon/50 px-4 py-2 rounded-full shadow-[0_0_15px_rgba(0,255,135,0.2)]">
                   <div className="w-2 h-2 rounded-full bg-neon animate-ping" />
                   <span className="font-mono text-[10px] text-neon uppercase tracking-wider">
                     {liveStatus === "connecting" && "Conectando..."}
                     {liveStatus === "listening" && "Ouvindo..."}
                     {liveStatus === "speaking" && "Falando..."}
                   </span>
                   {liveStatus === "speaking" && (
                     <div className="flex items-center gap-1 h-3 ml-2">
                       {[0,1,2,3].map(i => (
                         <div key={i} className="w-1 bg-neon rounded-full animate-bounce" style={{ height: '100%', animationDelay: `${i * 0.15}s`, animationDuration: "0.5s" }} />
                       ))}
                     </div>
                   )}
                 </div>
              </div>
            )}

            {isExhausted && !isLoading && (
              <p className="text-center font-mono text-[10px] text-muted-foreground uppercase tracking-[0.06em] mt-2 border-t border-border pt-3">
                Limite da sessão atingido ·{" "}
                <a href="mailto:guiresende20@gmail.com" className="text-electric hover:text-neon transition-colors">
                  Entrar em contato
                </a>
              </p>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-card/40 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isExhausted ? "Sessão encerrada" : "Pergunte sobre minha trajetória..."}
                disabled={isLoading || isExhausted || liveStatus !== "disconnected"}
                className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-[13px] font-sans text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-neon/40 focus:ring-1 focus:ring-neon/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              />
              
              <button onClick={toggleLiveAudio} title={liveStatus === "disconnected" ? "Falar por Áudio" : "Desligar Áudio"}
                className={`flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-md transition-all duration-200 hover:scale-105 ${
                  liveStatus !== "disconnected" 
                    ? "bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]" 
                    : "bg-card border border-border text-foreground hover:border-neon hover:text-neon"
                }`}>
                {liveStatus !== "disconnected" ? (
                  <MicOff size={16} strokeWidth={2.5} />
                ) : (
                  <Mic size={16} strokeWidth={2.5} />
                )}
              </button>

              <button onClick={sendMessage} disabled={!input.trim() || isLoading || isExhausted || liveStatus !== "disconnected"}
                aria-label="Enviar mensagem"
                className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-md bg-neon text-background hover:shadow-neon transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-[0.06em] mt-2 text-center">
              Powered by Gemini Pro · PT · EN · ES
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
