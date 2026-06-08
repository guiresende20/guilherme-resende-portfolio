import { useEffect } from "react";

interface Props {
  onDone: () => void;
}

export default function AerolitoIntro({ onDone }: Props) {
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e?.data?.type === "aerolito-intro-done") {
        onDone();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onDone]);

  return (
    <section className="relative w-full h-screen bg-background overflow-hidden">
      <iframe
        src="/aerolito-intro.html"
        title="Aerolito intro"
        className="w-full h-full border-0"
        allow="autoplay"
      />
    </section>
  );
}
