import { useState } from "react";

interface ShareButtonsProps {
  url: string;
  title: string;
}

export default function ShareButtons({ url, title }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const cls = "font-mono text-[10px] uppercase tracking-[0.1em] border border-border text-muted-foreground hover:text-neon hover:border-neon px-3 py-1.5 transition-colors";

  return (
    <div className="flex gap-2 mt-12 pt-8 border-t border-border">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground self-center mr-2">
        Compartilhar:
      </span>
      <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" className={cls}>
        LinkedIn
      </a>
      <a href={twitterUrl} target="_blank" rel="noopener noreferrer" className={cls}>
        X
      </a>
      <button onClick={copyLink} className={cls}>
        {copied ? "Copiado!" : "Copiar link"}
      </button>
    </div>
  );
}
