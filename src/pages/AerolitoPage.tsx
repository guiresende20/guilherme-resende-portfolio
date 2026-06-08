import { useEffect, useRef } from "react";
import AerolitoIntro from "@/components/aerolito/AerolitoIntro";
import AerolitoChatWidget from "@/components/aerolito/AerolitoChatWidget";

export default function AerolitoPage() {
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex,nofollow";
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);

  function scrollToChat() {
    chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AerolitoIntro onDone={scrollToChat} />
      <section ref={chatRef} className="max-w-3xl mx-auto px-6 py-16">
        <AerolitoChatWidget />
      </section>
    </main>
  );
}
