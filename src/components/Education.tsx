import { useTranslation } from "react-i18next";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";

const EDU = [
  {
    degree: "Doutorado em Design", period: "2017 - em andamento", org: "Universidade Federal do Rio Grande do Sul (UFRGS)",
    desc: "Pesquisa em digitalização 3D e interação em realidade virtual. Desenvolvimento do projeto MuseuVR para interação natural em ambientes culturais virtuais.",
    highlights: ["Bolsista CAPES", "Pesquisador do LdSM", "Publicações internacionais"],
  },
  {
    degree: "Mestrado em Design e Tecnologia", period: "2013 - 2015", org: "Universidade Federal do Rio Grande do Sul (UFRGS)",
    desc: "Formação avançada em design e tecnologia com foco em inovação e metodologias de pesquisa.",
    highlights: ["Dissertação aprovada", "Participação em congressos", "Pesquisa aplicada"],
    extra: "Dissertação: O uso do design e de tecnologias 3D na criação do repositório digital de elementos de fachada de prédios históricos da UFRGS",
  },
  {
    degree: "Bacharelado em Comunicação Social - Publicidade", period: "2004 - 2010", org: "Universidade Federal do Rio Grande do Sul (UFRGS)",
    desc: "Formação em comunicação social com especialização em publicidade e propaganda.",
    highlights: ["Formação completa", "Projetos práticos", "Base sólida em comunicação"],
    extra: "TCC: Do Napster ao Grooveshark: uma análise comparativa da evolução do compartilhamento de música na internet",
  },
  {
    degree: "English for Business", period: "2009 - 2010", org: "Leinster College - Irlanda",
    desc: "Curso de inglês para negócios com imersão cultural na Irlanda.",
    highlights: ["Certificação internacional", "Fluência em inglês", "Experiência internacional"],
  },
  {
    degree: "Chora PPT - Apresentações Criativas", period: "2011", org: "Perestroika",
    desc: "Curso especializado em criação de apresentações criativas e storytelling.",
    highlights: ["Certificação em apresentações", "Técnicas avançadas", "Storytelling"],
  },
];

interface EduItem {
  degree: string;
  period: string;
  org: string;
  desc: string;
  highlights: string[];
  extra?: string;
}

export default function Education() {
  const { t } = useTranslation();
  const items = t('education.items', { returnObjects: true }) as EduItem[];

  return (
    <section className="relative py-24 md:py-32 bg-card/30">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-30" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <SectionHeader id="formacao" label={t('education.header_label')} title={t('education.header_title')} titleOutline={t('education.header_outline')} />

        <div className="space-y-5">
          {items.map((e, i) => (
            <Reveal key={i} delay={i * 0.08}>
              <div className="bg-card border border-border rounded-md p-6 hover:border-neon/20 transition-all duration-300">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <div>
                    <h3 className="font-display font-semibold text-foreground text-[16px] uppercase tracking-tight">{e.degree}</h3>
                    <p className="font-sans text-electric text-[14px] font-medium">{e.org}</p>
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground tracking-[0.04em] border border-dim px-2.5 py-1">{e.period}</span>
                </div>
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-3">{e.desc}</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="font-mono text-[10px] text-neon uppercase tracking-[0.06em]">{t('education.highlights')}</span>
                  {e.highlights.map((h) => (
                    <span key={h} className="font-mono text-[10px] text-muted-foreground">• {h}</span>
                  ))}
                </div>
                {e.extra && (
                  <p className="text-[12px] text-muted-foreground/70 italic mt-2 border-t border-border pt-2">{e.extra}</p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
