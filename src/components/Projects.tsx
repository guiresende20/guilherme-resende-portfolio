import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";

const PROJECTS = [
  { title: "MuseuVR", type: "Pesquisa", desc: "Projeto de doutorado focado em interação natural em ambientes culturais virtuais, desenvolvendo novas formas de experiência imersiva em museus.", tags: ["Unity", "VR", "Interação Natural"] },
  { title: "Semear AgroHUB", type: "Profissional", desc: "Desenvolvimento de estratégia, UX e governança para hub de inovação no agronegócio, conectando produtores com tecnologias sustentáveis.", tags: ["UX Strategy", "Service Design", "Governança", "Inovação"] },
  { title: "Projeto Aula 360º", type: "Educacional", desc: "Iniciativa educacional utilizando tecnologias imersivas para criar experiências de aprendizado em realidade virtual.", tags: ["VR", "Educação", "Unity", "Design Educacional"] },
  { title: "Avaliação do App Mobiteste", type: "Pesquisa", desc: "Pesquisa e avaliação de usabilidade do aplicativo educacional Mobiteste, focando na experiência do usuário estudante.", tags: ["UX Research", "Usabilidade", "Mobile UX", "Educação"] },
  { title: "Ebook Leituras Obrigatórias UFRGS", type: "Editorial", desc: "Desenvolvimento de material educacional digital para auxiliar estudantes com as leituras obrigatórias do vestibular.", tags: ["Design Editorial", "UX", "Educação", "Digital Publishing"] },
  { title: "Digitalização 3D: Preservação Patrimonial", type: "Pesquisa", desc: "Desenvolvimento de repositório 3D de digitalizações de prédios históricos voltado à preservação e difusão do patrimônio cultural. O projeto foi um dos resultados do meu mestrado.", tags: ["AR", "Patrimônio Cultural", "Preservação", "Research"] },
  { title: "MataArte", type: "Arte", desc: "Exposição envolvendo imagem generativa a partir de fotos analógicas para exposição numa sala 360°.", tags: ["IA Generativa", "Arte Digital", "Fotografia Analógica", "Exposição 360°"] },
  { title: "IASPI AR - 3D", type: "Profissional", desc: "Criação de um cartão postal com conteúdo em realidade aumentada da cidade de Porto Alegre para o encontro internacional dos parques tecnológicos.", tags: ["AR", "3D", "Design", "Cartão Postal"] },
];

const VIDEOS = [
  { title: "MUSEU VR - REPORTAGEM", desc: "Reportagem sobre o projeto de Museu Virtual desenvolvido na UFRGS" },
  { title: "TECNOPUC 3D" }, { title: "MUSEUVR" }, { title: "DIGITALIZAÇÃO 3D - INS QUÍMICA UFRGS / CENTRO CULTURAL" },
  { title: "IASPI 3D" }, { title: "GRAFITTI VR" },
];

export default function Projects() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-50" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <SectionHeader id="projetos" label="Projetos & Publicações" title="Seleção de" titleOutline="projetos"
          subtitle="Seleção de projetos que demonstram minha expertise em design, tecnologia e inovação." />

        {/* Project grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {PROJECTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.07}>
              <div className="group bg-card border border-border rounded-md p-6 h-full flex flex-col hover:border-neon/30 hover:-translate-y-1 transition-all duration-400">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em] border border-neon/25 px-2.5 py-1">{p.type}</span>
                </div>
                <h3 className="font-display font-semibold text-foreground text-[16px] uppercase tracking-tight mb-2">{p.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-4 flex-1">{p.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <span key={t} className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.06em] border border-dim px-2 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Videos */}
        <Reveal delay={0.2}>
          <div className="mt-16">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-6 h-px bg-electric" />
              <span className="font-mono text-[11px] font-medium text-electric uppercase tracking-[0.12em]">🎥 Vídeos dos Projetos</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {VIDEOS.map((v) => (
                <span key={v.title} className="font-mono text-[11px] text-muted-foreground border border-dim px-4 py-2 uppercase tracking-[0.04em] hover:border-electric/40 hover:text-electric transition-all cursor-pointer">
                  {v.title}
                </span>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Patent + Awards */}
        <div className="grid md:grid-cols-2 gap-5 mt-16">
          <Reveal>
            <div className="bg-card border border-neon/20 rounded-md p-6">
              <span className="text-2xl mb-2 block">🏆</span>
              <h3 className="font-display font-semibold text-foreground text-[16px] uppercase tracking-tight mb-1">Patente Registrada</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">Sistema e método para produção de assentos customizáveis — Inovação tecnológica registrada com aplicação industrial.</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="bg-card border border-border rounded-md p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">🏆</span>
                <span className="font-display font-semibold text-foreground text-[14px] uppercase tracking-tight">Prêmios e Reconhecimentos</span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[13px] text-foreground font-medium">Prêmio Bornancini 2024</p>
                  <p className="text-[12px] text-muted-foreground">Categoria Design Digital - Realidade Aumentada e Realidades Extendidas</p>
                </div>
                <div>
                  <p className="text-[13px] text-foreground font-medium">39º Prêmio Direitos Humanos de Jornalismo 2022</p>
                  <p className="text-[12px] text-muted-foreground">Menção honrosa - projeto Revista Ceos</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
