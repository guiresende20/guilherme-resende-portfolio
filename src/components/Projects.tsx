import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import SectionHeader from "./SectionHeader";
import Reveal from "./Reveal";

/** Renderiza descrições com links no formato [texto](url) */
function renderDesc(desc: string): ReactNode {
  const regex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(desc)) !== null) {
    if (match.index > lastIndex) {
      parts.push(desc.slice(lastIndex, match.index));
    }
    parts.push(
      <a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-neon underline underline-offset-2 hover:text-neon/80 transition-colors">
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < desc.length) {
    parts.push(desc.slice(lastIndex));
  }
  return parts.length > 0 ? parts : desc;
}

interface Project {
  title: string;
  type: string;
  desc: string;
  tags: string[];
  link: string | null;
  linkType: "youtube" | "vimeo" | "iframe" | "none";
}



function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useTranslation();
  const getEmbedUrl = (p: Project) => {
    if (!p.link) return "";
    if (p.linkType === "youtube") return p.link + "?rel=0&autoplay=1";
    if (p.linkType === "vimeo") return p.link + "?autoplay=1";
    return p.link;
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onClick={onClose} style={{ animation: "fadeIn 0.2s ease-out" }} />
      <div className="fixed inset-4 md:inset-8 lg:inset-12 z-50 flex flex-col bg-card border border-border rounded-md overflow-hidden" style={{ animation: "modalSlideUp 0.3s cubic-bezier(0.16,1,0.3,1)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em] border border-neon/25 px-2.5 py-1">{project.type}</span>
            <h3 className="font-display font-semibold text-foreground text-[16px] uppercase tracking-tight">{project.title}</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="flex-1 relative bg-background">
          {project.link ? (
            <iframe src={getEmbedUrl(project)} className="absolute inset-0 w-full h-full border-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen title={project.title} />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground text-[14px]">{t('projects.btn_soon')}</div>
          )}
        </div>
        <div className="flex items-center justify-between px-6 py-3 border-t border-border flex-shrink-0 bg-card">
          <p className="text-[12px] text-muted-foreground max-w-lg leading-relaxed truncate">{renderDesc(project.desc)}</p>
          {project.link && (
            <a href={project.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[10px] text-electric uppercase tracking-[0.06em] hover:text-neon transition-colors flex-shrink-0 ml-4">
              {t('projects.btn_external')} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
            </a>
          )}
        </div>
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @keyframes modalSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </>
  );
}

export default function Projects() {
  const { t } = useTranslation();
  const [activeVideo, setActiveVideo] = useState(0);
  const [modalProject, setModalProject] = useState<Project | null>(null);
  
  const items = t('projects.items', { returnObjects: true }) as Project[];
  const videos = t('projects.videos', { returnObjects: true }) as {id: string, title: string, desc: string}[];

  return (
    <section className="relative py-24 md:py-32">
      <div className="absolute inset-0 bg-grid pointer-events-none opacity-50" />
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        <SectionHeader id="projetos" label={t('projects.header_label')} title={t('projects.header_title')} titleOutline={t('projects.header_outline')} subtitle={t('projects.header_subtitle')} />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.07}>
              <div className="group bg-card border border-border rounded-md p-6 h-full flex flex-col hover:border-neon/30 hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] text-neon uppercase tracking-[0.1em] border border-neon/25 px-2.5 py-1">{p.type}</span>
                </div>
                <h3 className="font-display font-semibold text-foreground text-[16px] uppercase tracking-tight mb-2">{p.title}</h3>
                <p className="text-[13px] text-muted-foreground leading-relaxed mb-4 flex-1">{renderDesc(p.desc)}</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {p.tags.map((t) => (
                    <span key={t} className="font-mono text-[9px] text-muted-foreground uppercase tracking-[0.06em] border border-dim px-2 py-0.5">{t}</span>
                  ))}
                </div>
                {p.link ? (
                  <button onClick={() => setModalProject(p)} className="inline-flex items-center gap-2 font-sans text-[12px] font-semibold uppercase tracking-[0.06em] text-neon border border-neon/30 px-4 py-2.5 mt-auto w-fit hover:bg-neon/10 hover:border-neon/60 hover:shadow-neon transition-all duration-300 group/btn cursor-pointer bg-transparent">
                    {t('projects.btn_more')}
                    <svg className="w-3.5 h-3.5 transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 font-sans text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground/50 border border-dim/50 px-4 py-2.5 mt-auto w-fit cursor-default">{t('projects.btn_soon')}</span>
                )}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15}>
          <div className="mt-20">
            <div className="flex items-center gap-3 mb-8">
              <span className="w-8 h-px bg-neon" />
              <span className="font-mono text-[11px] font-medium text-neon uppercase tracking-[0.12em]">{t('projects.videos_title')}</span>
            </div>
            <div className="grid lg:grid-cols-[1fr_320px] gap-5">
              <div className="bg-card border border-border rounded-md overflow-hidden">
                <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                  <iframe className="absolute inset-0 w-full h-full" src={`https://www.youtube.com/embed/${videos[activeVideo].id}?rel=0`} title={videos[activeVideo].title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
                </div>
                <div className="p-5">
                  <h4 className="font-display font-semibold text-foreground text-[15px] uppercase tracking-tight">{videos[activeVideo].title}</h4>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{videos[activeVideo].desc}</p>
                </div>
              </div>
              <div className="bg-card border border-border rounded-md p-4 flex flex-col">
                <h4 className="font-display font-semibold text-foreground text-[13px] uppercase tracking-tight mb-4 pb-3 border-b border-border">{t('projects.videos_list')}</h4>
                <div className="flex flex-col gap-2 flex-1">
                  {videos.map((v, i) => (
                    <button key={v.id} onClick={() => setActiveVideo(i)} className={`flex items-center gap-3 p-3 rounded-md text-left transition-all duration-300 ${i === activeVideo ? "bg-neon/10 border border-neon/30" : "bg-muted/30 border border-transparent hover:bg-muted/60 hover:border-dim"}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${i === activeVideo ? "bg-neon text-background" : "bg-dim text-muted-foreground"}`}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor"><polygon points="2,0 12,6 2,12" /></svg>
                      </div>
                      <span className={`font-mono text-[11px] uppercase tracking-[0.04em] leading-tight ${i === activeVideo ? "text-neon font-medium" : "text-muted-foreground"}`}>{v.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-5 mt-16">
          <Reveal>
            <div className="bg-card border border-neon/20 rounded-md p-6">
              <span className="text-2xl mb-2 block">🏆</span>
              <h3 className="font-display font-semibold text-foreground text-[16px] uppercase tracking-tight mb-1">{t('projects.patent_title')}</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">{t('projects.patent_desc')}</p>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="bg-card border border-border rounded-md p-6 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">🏆</span>
                <span className="font-display font-semibold text-foreground text-[14px] uppercase tracking-tight">{t('projects.awards_title')}</span>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-[13px] text-foreground font-medium">{t('projects.awards_bornancini')}</p>
                  <p className="text-[12px] text-muted-foreground">{t('projects.awards_bornancini_desc')}</p>
                  <a href="https://drive.google.com/file/d/1ls8JBOotSEa8f7nBAFqPVHz0d7_P59E5/view?usp=drive_link" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[10px] text-electric uppercase tracking-[0.06em] mt-1.5 hover:text-neon transition-colors">
                    {t('projects.view_project')} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
                  </a>
                </div>
                <div>
                  <p className="text-[13px] text-foreground font-medium">{t('projects.awards_dh')}</p>
                  <p className="text-[12px] text-muted-foreground">{t('projects.awards_dh_desc')}</p>
                  <a href="https://www.coletiva.net/noticias/gauchos-se-destacam-no-39-premio-direitos-humanos-de-jornalismo-,421812.jhtml" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[10px] text-electric uppercase tracking-[0.06em] mt-1.5 hover:text-neon transition-colors">
                    {t('projects.view_project')} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></svg>
                  </a>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
      {modalProject && <ProjectModal project={modalProject} onClose={() => setModalProject(null)} />}
    </section>
  );
}
