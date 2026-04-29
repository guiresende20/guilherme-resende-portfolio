import { useTranslation } from "react-i18next";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";


export default function About() {
  const { t } = useTranslation();
  const areas = t('about.areas', { returnObjects: true }) as {icon: string, title: string, desc: string, color: string}[];

  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-50" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <SectionHeader id="sobre" label={t('about.header_label')} title={t('about.header_title')} titleOutline={t('about.header_outline')} />

        <div className="grid md:grid-cols-5 gap-12 md:gap-16">
          {/* Text — 3 cols */}
          <div className="md:col-span-3 space-y-5">
            <Reveal>
              <p className="text-muted-foreground leading-[1.7] text-[15px]">{t('about.p1')}</p>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="text-muted-foreground leading-[1.7] text-[15px]">{t('about.p2')}</p>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-muted-foreground leading-[1.7] text-[15px]">{t('about.p3')}</p>
            </Reveal>
          </div>

          {/* Cards — 2 cols */}
          <div className="md:col-span-2 space-y-4">
            {areas.map((a, i) => (
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
