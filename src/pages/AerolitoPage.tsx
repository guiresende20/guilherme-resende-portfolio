import { useEffect, useState } from "react";
import AerolitoIntro from "@/components/aerolito/AerolitoIntro";
import AerolitoChatWidget from "@/components/aerolito/AerolitoChatWidget";

export default function AerolitoPage() {
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setChatOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chatOpen]);

  return (
    <main className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <AerolitoIntro onDone={() => setChatOpen(true)} />

      {chatOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm animate-fade-up"
            style={{ animationDuration: "0.3s" }}
            onClick={() => setChatOpen(false)}
            aria-hidden="true"
          />
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              className="relative w-full max-w-3xl pointer-events-auto animate-fade-up"
              style={{ animationDuration: "0.4s" }}
            >
              <button
                onClick={() => setChatOpen(false)}
                aria-label="Fechar chat"
                className="absolute -top-3 -right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:border-neon/50 transition-all shadow-lg"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <AerolitoChatWidget />
            </div>
          </div>
        </>
      )}
    </main>
  );
}
