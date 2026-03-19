import { useState, useEffect } from "react";

const LINKS = [
  { href: "#inicio", label: "Início" },
  { href: "#sobre", label: "Sobre" },
  { href: "#experiencia", label: "Experiência" },
  { href: "#projetos", label: "Projetos" },
  { href: "#formacao", label: "Formação" },
  { href: "#contato", label: "Contato" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

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
        <a
          href="https://chatgpt.com/g/g-68654885f5c88191b5d2df8265320cce-guilherme-resende-gpt"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:inline-flex items-center gap-2 font-sans text-[12px] font-semibold uppercase tracking-[0.06em] text-background bg-neon px-5 py-2.5 hover:shadow-neon transition-shadow"
        >
          Converse com minha IA
        </a>
      </div>
    </nav>
  );
}
