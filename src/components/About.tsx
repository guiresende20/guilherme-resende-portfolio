import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";

const AREAS = [
  { icon: "UX", title: "UX/UI Design", desc: "Desenvolvimento de soluções estratégicas e interfaces centradas no usuário.", color: "neon" },
  { icon: "VR", title: "VR/AR", desc: "Pesquisa e desenvolvimento em tecnologias imersivas e interação natural.", color: "electric" },
  { icon: "AI", title: "IA em Design", desc: "Utilização de IA para análises estratégicas e geração de insights.", color: "neon" },
];

export default function About() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-50" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <SectionHeader id="sobre" label="Sobre mim" title="Trajetória" titleOutline="acadêmica & profissional" />

        <div className="grid md:grid-cols-5 gap-12 md:gap-16">
          {/* Text — 3 cols */}
          <div className="md:col-span-3 space-y-5">
            <Reveal>
              <p className="text-muted-foreground leading-[1.7] text-[15px]">
                Designer e pesquisador com mestrado em Design e Tecnologia e graduação em Comunicação Social pela UFRGS. Atuo no CriaLab - Tecnopuc com projetos de inovação e tecnologia, incluindo tecnologias imersivas (VR/AR), desenvolvendo soluções estratégicas para empresas como a HP e órgãos públicos (ex.: Semear Agrohub).
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-muted-foreground leading-[1.7] text-[15px]">
                Tenho experiência prática em prototipagem rápida, impressão 3D e facilitação de workshops. Sou entusiasta da tecnologia e utilizo IA para análises estratégicas, geração de insights e design de serviços.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-muted-foreground leading-[1.7] text-[15px]">
                Minha trajetória inclui passagens pela ESPM como professor, pelo marketing do Anglo Vestibulares e pela startup BSMotion, sempre na intersecção entre tecnologia, design e inovação.
              </p>
            </Reveal>
          </div>

          {/* Cards — 2 cols */}
          <div className="md:col-span-2 space-y-4">
            {AREAS.map((a, i) => (
              <Reveal key={a.title} delay={i * 0.12}>
                <div className="group bg-card border border-border rounded-md p-5 hover:border-neon/30 transition-all duration-300 hover:-translate-y-0.5">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-md text-[13px] font-bold ${a.color === "neon" ? "bg-neon/10 text-neon" : "bg-electric/10 text-electric"}`}>
                      {a.icon}
                    </span>
                    <span className="font-display font-semibold text-foreground text-[15px] uppercase tracking-tight">{a.title}</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{a.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
