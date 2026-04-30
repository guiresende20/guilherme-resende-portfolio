import { useTranslation } from "react-i18next";


function AnimatedWord({ text, delay, className }: { text: string; delay: number; className?: string }) {
  return (
    <span className={className}>
      {text.split("").map((c, i) => (
        <span key={i} className="inline-block animate-letter-reveal" style={{
          animationDelay: `${delay + i * 0.035}s`, opacity: 0,
        }}>
          {c === " " ? "\u00A0" : c}
        </span>
      ))}
    </span>
  );
}

export default function Hero() {
  const { t } = useTranslation();
  const stats = t('hero.stats', { returnObjects: true }) as {num: string, label: string}[];
  const skills = t('hero.marquee_skills', { returnObjects: true }) as string[];

  return (
    <section id="inicio" className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Grid */}
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#0a0a0f_100%)] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 px-6 md:px-12 max-w-[1400px] mx-auto w-full pt-32">
        <div className="flex items-center gap-2.5 mb-8 opacity-0 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <span className="w-[7px] h-[7px] rounded-full bg-neon shadow-[0_0_8px_rgba(0,255,135,0.5)]" />
          <span className="font-mono text-[12px] font-medium text-neon uppercase tracking-[0.12em]">
            {t('hero.org')}
          </span>
        </div>

        <div className="mb-4 flex items-center gap-4 opacity-0 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          <img
            src="/guilherme-foto.webp"
            alt="Guilherme Resende"
            width="96"
            height="96"
            fetchPriority="high"
            decoding="async"
            className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-neon/30"
          />
          <div>
            <span className="font-sans text-muted-foreground text-sm">{t('hero.location')}</span>
          </div>
        </div>

        <h1 className="font-display font-bold uppercase tracking-[-0.035em] leading-[0.9] mb-6" style={{ fontSize: "clamp(2.8rem, 8vw, 7rem)", perspective: "600px" }}>
          <span className="block overflow-hidden">
            <AnimatedWord text="Guilherme" delay={0.4} className="text-foreground" />
          </span>
          <span className="block overflow-hidden">
            <AnimatedWord text="Resende" delay={0.75} className="text-outline" />
            <AnimatedWord text=" Muniz" delay={1.05} className="text-neon" />
          </span>
        </h1>

        <p className="font-display text-electric font-semibold text-lg md:text-xl uppercase tracking-wide mb-4 opacity-0 animate-fade-up" style={{ animationDelay: "1.3s" }}>
          {t('hero.role')}
        </p>

        <p className="text-muted-foreground max-w-xl leading-relaxed mb-8 opacity-0 animate-fade-up" style={{ animationDelay: "1.5s", fontSize: "clamp(15px, 1.6vw, 18px)" }}>
          {t('hero.description')}
        </p>

        <div className="flex flex-wrap items-center gap-4 mb-4 opacity-0 animate-fade-up" style={{ animationDelay: "1.7s" }}>
          <a href="#projetos" className="inline-flex items-center gap-2.5 font-sans text-[14px] font-bold uppercase tracking-[0.06em] bg-neon text-background px-8 py-4 hover:shadow-neon-strong transition-shadow animate-neon-pulse">
            {t('hero.btn_projects')} <span>→</span>
          </a>
          <button onClick={() => window.dispatchEvent(new Event("open-chat"))}
            className="relative inline-flex items-center justify-center gap-2 font-sans text-[14px] font-bold uppercase tracking-[0.06em] bg-neon text-background px-7 py-4 hover:shadow-neon-strong transition-all duration-300 hover:scale-105 animate-neon-pulse group">
            <span className="absolute inset-0 border-2 border-neon/40 animate-ping rounded-sm" style={{ animationDuration: "2.5s" }} />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="z-10 relative">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="relative z-10">{t('hero.btn_ai')}</span>
          </button>
          <a href="#contato" className="inline-flex items-center gap-2 font-sans text-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground border border-dim px-7 py-4 hover:border-neon hover:text-neon transition-all">
            {t('hero.btn_contact')}
          </a>
        </div>

        <div className="flex flex-wrap gap-3 mt-2 opacity-0 animate-fade-up" style={{ animationDelay: "1.9s" }}>
          {[
            { label: "LinkedIn", href: "https://www.linkedin.com/in/guilhermeresende/" },
            { label: "E-mail", href: "mailto:guiresende20@gmail.com" },
            { label: "WhatsApp", href: "https://wa.me/5551997925092" },
            { label: "Lattes", href: "http://lattes.cnpq.br/5709726694301047" },
          ].map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer"
              className="font-mono text-[11px] font-medium text-muted-foreground border border-dim px-4 py-2 uppercase tracking-[0.06em] hover:border-neon/50 hover:text-foreground transition-all">
              {l.label}
            </a>
          ))}
        </div>
      </div>

      {/* Neon line */}
      <div className="relative z-10 max-w-[1400px] mx-auto w-full px-6 md:px-12 mt-12">
        <div className="neon-line animate-line-expand origin-left" style={{ animationDelay: "2s" }} />
      </div>

      {/* Marquee */}
      <div className="relative z-10 overflow-hidden py-4 mt-3 border-b border-white/[0.03]">
        <div className="flex w-max animate-marquee">
          {[0, 1].map((r) => (
            <span key={r} className="flex">
              {skills.map((s, i) => (
                <span key={`${r}-${i}`} className="font-mono text-[12px] uppercase tracking-[0.06em] whitespace-nowrap px-3">
                  <span className={i % 3 === 0 ? "text-neon font-medium" : "text-muted-foreground"}>{s}</span>
                  <span className="text-dim mx-3">•</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* Counters */}
      <div className="relative z-10 max-w-[1400px] mx-auto w-full px-6 md:px-12 mt-8 flex gap-10 opacity-0 animate-fade-up" style={{ animationDelay: "2.2s" }}>
        {stats.map((c) => (
          <div key={c.label}>
            <div className="font-display font-bold text-4xl md:text-5xl text-foreground tracking-tight">
              {c.num.replace("+", "")}<span className="text-neon">{c.num.includes("+") ? "+" : "."}</span>
            </div>
            <div className="font-mono text-[13px] text-muted-foreground uppercase tracking-[0.1em] mt-2">{c.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
