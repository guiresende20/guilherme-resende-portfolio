import { useEffect, useRef, useState } from "react";

interface DisqusEmbedProps {
  shortname: string;
  identifier: string;
  title: string;
  url: string;
}

declare global {
  interface Window {
    disqus_config?: () => void;
    DISQUS?: { reset: (opts: { reload: boolean; config: () => void }) => void };
  }
}

export default function DisqusEmbed({ shortname, identifier, title, url }: DisqusEmbedProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        obs.disconnect();
      }
    }, { rootMargin: "200px" });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;

    window.disqus_config = function () {
      // @ts-expect-error disqus injects `this`
      this.page.url = url;
      // @ts-expect-error disqus injects `this`
      this.page.identifier = identifier;
      // @ts-expect-error disqus injects `this`
      this.page.title = title;
    };

    const existing = document.querySelector("script[data-disqus]");
    if (existing) {
      if (window.DISQUS) {
        window.DISQUS.reset({ reload: true, config: window.disqus_config });
      }
      return;
    }

    const s = document.createElement("script");
    s.src = `https://${shortname}.disqus.com/embed.js`;
    s.setAttribute("data-timestamp", String(Date.now()));
    s.setAttribute("data-disqus", "1");
    document.body.appendChild(s);
  }, [visible, shortname, identifier, title, url]);

  return (
    <div ref={ref} className="mt-16 pt-8 border-t border-border">
      <h2 className="font-display text-2xl text-foreground mb-6">Comentários</h2>
      <div id="disqus_thread" />
    </div>
  );
}
