import { useTranslation } from "react-i18next";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";


interface Job {
  role: string;
  type: string;
  org: string;
  period: string;
  loc: string;
  items: string[];
}

export default function Experience() {
  const { t } = useTranslation();
  const jobs = t('experience.jobs', { returnObjects: true }) as Job[];

  return (
    <section className="relative py-24 md:py-32 bg-card/30">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-30" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <SectionHeader id="experiencia" label={t('experience.header_label')} title={t('experience.header_title')} titleOutline={t('experience.header_outline')} />

        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-0 md:left-6 top-0 bottom-0 w-px bg-gradient-to-b from-neon/40 via-dim to-transparent" />

          <div className="space-y-8">
            {jobs.map((job, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="relative pl-8 md:pl-16 group">
                  {/* Dot */}
                  <div className="absolute left-0 md:left-6 top-2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-neon bg-background group-hover:bg-neon group-hover:shadow-neon transition-all" />

                  <div className="bg-card border border-border rounded-md p-6 hover:border-neon/20 transition-all duration-300">
                    <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="font-display font-semibold text-foreground text-[17px] uppercase tracking-tight">{job.role}</h3>
                        <p className="font-sans text-electric text-[14px] font-medium">{job.org}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-neon border border-neon/25 px-2.5 py-1">{job.type}</span>
                        <span className="font-mono text-[10px] text-muted-foreground tracking-[0.04em]">{job.period}</span>
                      </div>
                    </div>
                    <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.06em] mb-3">{job.loc}</p>
                    <ul className="space-y-1.5">
                      {job.items.map((item, j) => (
                        <li key={j} className="flex items-start gap-2 text-[13px] text-muted-foreground leading-relaxed">
                          <span className="text-neon mt-1.5 text-[6px]">●</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
