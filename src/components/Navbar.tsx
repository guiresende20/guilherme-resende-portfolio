import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const [scrolled, setScrolled] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
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

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const id = href.slice(1);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  return (
    <>
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

          {/* Desktop links */}
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
            {/* Language switcher (desktop) */}
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
            
            {/* GPT link (desktop) */}
            <a
              href="https://chatgpt.com/g/g-68654885f5c88191b5d2df8265320cce-guilherme-resende-gpt"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-2 font-sans text-[12px] font-semibold uppercase tracking-[0.06em] text-foreground bg-transparent border border-[#00ff87] px-5 py-2.5 hover:bg-[#00ff87]/10 transition-colors"
            >
              {t("navbar.chatBtn")}
            </a>

            {/* Hamburger button (mobile) */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden flex flex-col items-center justify-center w-10 h-10 gap-1.5 relative z-[60]"
              aria-label="Menu"
            >
              <span className={`block w-6 h-[2px] bg-foreground transition-all duration-300 origin-center ${mobileOpen ? "rotate-45 translate-y-[5px]" : ""}`} />
              <span className={`block w-6 h-[2px] bg-foreground transition-all duration-300 ${mobileOpen ? "opacity-0 scale-0" : ""}`} />
              <span className={`block w-6 h-[2px] bg-foreground transition-all duration-300 origin-center ${mobileOpen ? "-rotate-45 -translate-y-[5px]" : ""}`} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <div
        className={`fixed inset-0 z-[55] bg-background/95 backdrop-blur-md transition-all duration-400 md:hidden ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{ transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
      >
        <div className="flex flex-col items-center justify-center h-full gap-6 px-8">
          {LINKS.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={(e) => handleClick(e, l.href)}
              className="font-display font-semibold text-2xl text-foreground uppercase tracking-tight hover:text-neon transition-colors"
              style={{
                opacity: mobileOpen ? 1 : 0,
                transform: mobileOpen ? "translateY(0)" : "translateY(20px)",
                transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${0.1 + i * 0.05}s`,
              }}
            >
              {l.label}
            </a>
          ))}

          {/* Language + GPT in mobile menu */}
          <div
            className="flex items-center gap-3 mt-6"
            style={{
              opacity: mobileOpen ? 1 : 0,
              transform: mobileOpen ? "translateY(0)" : "translateY(20px)",
              transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${0.1 + LINKS.length * 0.05}s`,
            }}
          >
            {["pt", "en", "es"].map((lng) => (
              <button
                key={lng}
                onClick={() => { changeLanguage(lng); setMobileOpen(false); }}
                className={`font-mono text-[13px] font-bold uppercase tracking-[0.06em] px-4 py-2 border transition-all ${
                  i18n.language === lng
                    ? "text-neon border-neon bg-neon/10"
                    : "text-muted-foreground border-dim hover:border-neon/40 hover:text-foreground"
                }`}
              >
                {lng.toUpperCase()}
              </button>
            ))}
          </div>

          <a
            href="https://chatgpt.com/g/g-68654885f5c88191b5d2df8265320cce-guilherme-resende-gpt"
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-[13px] font-semibold uppercase tracking-[0.06em] text-neon border border-neon px-6 py-3 hover:bg-neon/10 transition-colors mt-2"
            style={{
              opacity: mobileOpen ? 1 : 0,
              transform: mobileOpen ? "translateY(0)" : "translateY(20px)",
              transition: `all 0.4s cubic-bezier(0.16,1,0.3,1) ${0.15 + LINKS.length * 0.05}s`,
            }}
          >
            {t("navbar.chatBtn")}
          </a>
        </div>
      </div>
    </>
  );
}
