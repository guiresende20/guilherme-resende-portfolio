import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";

export default function Contact() {
  return (
    <section className="relative py-24 md:py-32 bg-card/30">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-30" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <SectionHeader
          id="contato"
          label="Contato"
          title="Vamos"
          titleOutline="conversar"
          subtitle="Vamos conversar sobre seu próximo projeto? Estou sempre aberto a novas oportunidades e colaborações."
        />

        <div className="grid md:grid-cols-3 gap-5">
          <Reveal>
            <a href="mailto:guiresende20@gmail.com"
              className="group block bg-card border border-border rounded-md p-6 hover:border-neon/30 hover:-translate-y-1 transition-all duration-300">
              <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em] mb-3 block">E-mail</span>
              <span className="font-sans text-foreground text-[15px] font-medium group-hover:text-neon transition-colors">
                guiresende20@gmail.com
              </span>
              <span className="block mt-3 font-sans text-[13px] text-electric font-medium uppercase tracking-[0.04em]">
                Enviar E-mail →
              </span>
            </a>
          </Reveal>

          <Reveal delay={0.1}>
            <a href="https://wa.me/5551997925092" target="_blank" rel="noopener noreferrer"
              className="group block bg-card border border-border rounded-md p-6 hover:border-neon/30 hover:-translate-y-1 transition-all duration-300">
              <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em] mb-3 block">WhatsApp</span>
              <span className="font-sans text-foreground text-[15px] font-medium group-hover:text-neon transition-colors">
                +55 51 99792-5092
              </span>
              <span className="block mt-3 font-sans text-[13px] text-electric font-medium uppercase tracking-[0.04em]">
                Chamar no WhatsApp →
              </span>
            </a>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="bg-card border border-border rounded-md p-6">
              <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em] mb-3 block">Localização</span>
              <span className="font-sans text-foreground text-[15px] font-medium">
                Porto Alegre - RS, Brasil
              </span>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
