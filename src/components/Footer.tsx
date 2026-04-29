import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="relative border-t border-border bg-background">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-20" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 py-12">
        <div className="grid md:grid-cols-3 gap-8 mb-10">
          {/* Brand */}
          <div>
            <span className="font-display font-bold text-xl text-foreground uppercase tracking-tight">
              Gui<span className="text-neon">.</span>Resende
            </span>
            <p className="text-[13px] text-muted-foreground mt-2 leading-relaxed max-w-xs">
              {t('footer.role')}<br />
              {t('footer.desc')}
            </p>
          </div>

          {/* Quick links */}
          <div>
            <span className="font-mono text-[10px] text-neon uppercase tracking-[0.12em] mb-4 block">{t('footer.links_title')}</span>
            <div className="flex flex-col gap-2">
              {["inicio", "sobre", "experiencia", "projetos", "contato"].map((l) => (
                <a key={l} href={`#${l}`}
                  onClick={(e) => handleClick(e, `#${l}`)}
                  className="font-sans text-[13px] text-muted-foreground hover:text-foreground transition-colors w-fit">
                  {t(`navbar.links.${l}`)}
                </a>
              ))}
            </div>
          </div>

          {/* Contact info */}
          <div>
            <span className="font-mono text-[10px] text-neon uppercase tracking-[0.12em] mb-4 block">{t('footer.contact_title')}</span>
            <div className="flex flex-col gap-2 text-[13px] text-muted-foreground">
              <span>Porto Alegre - RS, Brasil</span>
              <a href="mailto:guiresende20@gmail.com" className="hover:text-neon transition-colors">guiresende20@gmail.com</a>
              <a href="tel:+5551997925092" className="hover:text-neon transition-colors">+55 51 99792-5092</a>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="neon-line mb-6" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-mono text-[11px] text-muted-foreground tracking-[0.04em]">
            © {new Date().getFullYear()} {t('footer.rights')}
          </span>
          <div className="flex gap-4">
            {[
              { label: "LinkedIn", href: "https://www.linkedin.com/in/guilhermeresende/" },
              { label: "Lattes", href: "http://lattes.cnpq.br/5709726694301047" },
            ].map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.08em] hover:text-neon transition-colors">
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
