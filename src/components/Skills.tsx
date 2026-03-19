import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";

interface Skill {
  name: string;
  pct: number;
}

interface SkillGroup {
  title: string;
  skills: Skill[];
}

const GROUPS: SkillGroup[] = [
  {
    title: "UX/UI Design",
    skills: [
      { name: "Figma", pct: 95 },
      { name: "User Research", pct: 90 },
      { name: "Prototipagem", pct: 95 },
      { name: "Design Thinking", pct: 90 },
      { name: "Service Design", pct: 85 },
      { name: "Usabilidade", pct: 90 },
    ],
  },
  {
    title: "Inteligência Artificial",
    skills: [
      { name: "IA aplicada a Design", pct: 85 },
      { name: "Análises Estratégicas", pct: 80 },
      { name: "Geração de Insights", pct: 85 },
      { name: "Data Analysis", pct: 75 },
      { name: "AI Ethics", pct: 80 },
    ],
  },
  {
    title: "VR/AR & 3D",
    skills: [
      { name: "Unity 3D", pct: 90 },
      { name: "Blender", pct: 85 },
      { name: "Realidade Virtual", pct: 95 },
      { name: "Realidade Aumentada", pct: 85 },
      { name: "Digitalização 3D", pct: 90 },
      { name: "Impressão 3D", pct: 85 },
    ],
  },
  {
    title: "Desenvolvimento & Tecnologia",
    skills: [
      { name: "HTML/CSS", pct: 85 },
      { name: "JavaScript", pct: 75 },
      { name: "Python", pct: 50 },
      { name: "Prototipagem Rápida", pct: 90 },
    ],
  },
];

const LANGUAGES = [
  { name: "Português", level: "Nativo" },
  { name: "Inglês", level: "Profissional" },
];

function SkillBar({ name, pct, delay }: Skill & { delay: number }) {
  return (
    <Reveal delay={delay}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-sans text-[13px] text-foreground font-medium">{name}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000 ease-out"
            style={{
              width: `${pct}%`,
              background: pct >= 90
                ? "#00ff87"
                : pct >= 75
                ? "linear-gradient(90deg, #00ff87, #4d8cff)"
                : "#4d8cff",
            }}
          />
        </div>
      </div>
    </Reveal>
  );
}

export default function Skills() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-50" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <SectionHeader label="Skills & Tecnologias" title="Competências" titleOutline="técnicas" />

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {GROUPS.map((g, gi) => (
            <Reveal key={g.title} delay={gi * 0.1}>
              <div className="bg-card border border-border rounded-md p-6 h-full">
                <h3 className="font-display font-semibold text-foreground text-[14px] uppercase tracking-tight mb-6 pb-3 border-b border-border">
                  {g.title}
                </h3>
                {g.skills.map((s, si) => (
                  <SkillBar key={s.name} {...s} delay={gi * 0.1 + si * 0.04} />
                ))}
              </div>
            </Reveal>
          ))}
        </div>

        {/* Languages */}
        <Reveal delay={0.3}>
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-6 h-px bg-electric" />
              <span className="font-mono text-[11px] font-medium text-electric uppercase tracking-[0.12em]">Idiomas</span>
            </div>
            <div className="flex gap-4">
              {LANGUAGES.map((l) => (
                <span key={l.name} className="font-sans text-[14px] text-muted-foreground">
                  <span className="text-foreground font-medium">{l.name}</span> — {l.level}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
