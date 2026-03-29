import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setLangMenuOpen(false);
  };

  const LINKS = [
    { href: "#inicio", label: t("navbar.links.inicio") },
    { href: "#sobre", label: t("navbar.links.sobre") },
    { href: "#experiencia", label: t("navbar.links.experiencia") },
    { href: "#projetos", label: t("navbar.links.projetos") },
    { href: "#formacao", label: t("navbar.links.formacao") },
    { href: "#contato", label: t("navbar.links.contato") },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.slice(1);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled ? "rgba(10,10,15,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(42,42,53,0.5)" : "1px solid transparent",
      }}
    >
      <div className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-12 py-5">
        <a href="#inicio" onClick={(e) => handleClick(e, "#inicio")}
          className="font-display font-bold text-lg text-foreground uppercase tracking-tight">
          Gui<span className="text-neon">.</span>Resende
        </a>
        <ul className="hidden md:flex items-center gap-8">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={(e) => handleClick(e, l.href)}
                className="relative font-sans text-[13px] font-medium text-muted-foreground uppercase tracking-[0.06em] hover:text-foreground transition-colors group"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-neon transition-all duration-300 group-hover:w-full" />
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-4">
          <div className="relative" ref={langMenuRef}>
            <button
              onClick={() => setLangMenuOpen(!langMenuOpen)}
              className="hidden md:inline-flex items-center gap-1.5 font-sans text-[12px] font-bold uppercase tracking-[0.06em] text-background bg-[#00ff87] px-4 py-2.5 hover:opacity-90 transition-opacity"
            >
              {i18n.language.toUpperCase()}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
            
            {langMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-24 bg-card border border-border shadow-lg z-50 rounded-sm overflow-hidden flex flex-col">
                <button onClick={() => changeLanguage('pt')} className={`px-4 py-2 text-left text-[11px] font-sans uppercase font-bold tracking-[0.06em] hover:bg-[#00ff87]/10 ${i18n.language === 'pt' ? 'text-[#00ff87]' : 'text-muted-foreground'}`}>PT</button>
                <button onClick={() => changeLanguage('en')} className={`px-4 py-2 text-left text-[11px] font-sans uppercase font-bold tracking-[0.06em] hover:bg-[#00ff87]/10 ${i18n.language === 'en' ? 'text-[#00ff87]' : 'text-muted-foreground'}`}>EN</button>
                <button onClick={() => changeLanguage('es')} className={`px-4 py-2 text-left text-[11px] font-sans uppercase font-bold tracking-[0.06em] hover:bg-[#00ff87]/10 ${i18n.language === 'es' ? 'text-[#00ff87]' : 'text-muted-foreground'}`}>ES</button>
              </div>
            )}
          </div>
          
          <a
            href="https://chatgpt.com/g/g-68654885f5c88191b5d2df8265320cce-guilherme-resende-gpt"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:inline-flex items-center gap-2 font-sans text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground bg-transparent border border-[#00ff87] px-5 py-2.5 hover:bg-[#00ff87]/10 transition-colors"
          >
            {t("navbar.chatBtn")}
          </a>
        </div>
      </div>
    </nav>
  );
}
