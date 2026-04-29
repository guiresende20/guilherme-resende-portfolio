import { jsPDF } from "jspdf";

export type CVType = "ux" | "academic" | "innovation" | "full";

interface CVConfig {
  title: string;
  subtitle: string;
  emphasis: string[];
  sections: string[];
}

const CV_CONFIGS: Record<CVType, CVConfig> = {
  ux: {
    title: "UX & Design",
    subtitle: "Designer de Inovação · UX/UI · Pesquisa com Usuários",
    emphasis: ["UX/UI Design", "Figma", "User Research", "Design Thinking", "Service Design", "Usabilidade", "Prototipagem"],
    sections: ["experience", "skills_ux", "projects_ux", "education", "contact"],
  },
  academic: {
    title: "Acadêmico & Pesquisa",
    subtitle: "Designer · Pesquisador · Doutorando UFRGS",
    emphasis: ["Doutorado", "Publicações", "MuseuVR", "Digitalização 3D", "LdSM", "Lattes", "CAPES"],
    sections: ["education", "research", "projects_research", "experience", "contact"],
  },
  innovation: {
    title: "Inovação & Tecnologia",
    subtitle: "Designer de Inovação · VR/AR · IA Aplicada · Tecnopuc",
    emphasis: ["Inovação", "VR/AR", "Unity 3D", "IA", "CriaLab", "HP", "Ecossistemas"],
    sections: ["experience", "projects_innovation", "skills_tech", "education", "contact"],
  },
  full: {
    title: "Currículo Completo",
    subtitle: "Designer · Pesquisador · Educador · Inovador",
    emphasis: [],
    sections: ["experience", "education", "skills", "projects", "contact"],
  },
};

// ─── Color palette ────────────────────────────────────────────────────────────
const C = {
  bg: [10, 10, 15] as [number, number, number],
  neon: [0, 255, 135] as [number, number, number],
  electric: [77, 140, 255] as [number, number, number],
  white: [232, 232, 232] as [number, number, number],
  muted: [100, 100, 120] as [number, number, number],
  card: [18, 18, 26] as [number, number, number],
  border: [42, 42, 53] as [number, number, number],
};

function addPageBackground(doc: jsPDF) {
  doc.setFillColor(...C.bg);
  doc.rect(0, 0, 210, 297, "F");
}

function addSection(doc: jsPDF, label: string, y: number): number {
  doc.setDrawColor(...C.neon);
  doc.setLineWidth(0.3);
  doc.line(15, y, 195, y);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...C.neon);
  doc.text(label.toUpperCase(), 15, y + 5);
  return y + 9;
}

function addItem(
  doc: jsPDF,
  title: string,
  subtitle: string,
  period: string,
  bullets: string[],
  y: number
): number {
  // Card background
  doc.setFillColor(...C.card);
  const cardHeight = 10 + bullets.length * 5;
  doc.roundedRect(15, y, 180, cardHeight, 1, 1, "F");
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.2);
  doc.roundedRect(15, y, 180, cardHeight, 1, 1, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.white);
  doc.text(title, 20, y + 5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.electric);
  doc.text(subtitle, 20, y + 9);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text(period, 195, y + 5, { align: "right" });

  let bulletY = y + 13;
  for (const bullet of bullets) {
    doc.setTextColor(...C.muted);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text("•", 22, bulletY);
    const lines = doc.splitTextToSize(bullet, 163);
    doc.text(lines, 26, bulletY);
    bulletY += lines.length * 4 + 1;
  }

  return y + cardHeight + 4;
}

export function generateCV(type: CVType): void {
  const config = CV_CONFIGS[type];
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  // ── Page 1 ──────────────────────────────────────────────────────────────────
  addPageBackground(doc);

  // Header accent bar
  doc.setFillColor(...C.neon);
  doc.rect(0, 0, 4, 297, "F");

  // Name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  doc.setTextColor(...C.white);
  doc.text("GUILHERME", 15, 22);

  doc.setTextColor(0, 0, 0, 0); // transparent
  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  // Outline effect: draw stroked text
  doc.setTextColor(...C.muted);
  doc.text("RESENDE", 15, 31);

  doc.setTextColor(...C.neon);
  doc.text("MUNIZ", 15 + doc.getTextWidth("RESENDE") + 3, 31);

  // Role & CV type badge
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...C.electric);
  doc.text(config.subtitle.toUpperCase(), 15, 38);

  // Badge
  doc.setFillColor(...C.neon);
  doc.roundedRect(130, 15, 65, 10, 1, 1, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.bg);
  doc.text(`CURRÍCULO — ${config.title.toUpperCase()}`, 162.5, 21, { align: "center" });

  // Location & links
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...C.muted);
  doc.text("📍 Porto Alegre - RS, Brasil", 15, 44);
  doc.text("guiresende20@gmail.com  ·  +55 51 99792-5092  ·  linkedin.com/in/guilhermeresende  ·  lattes.cnpq.br/5709726694301047", 15, 49);

  // Stats bar
  const stats = [
    { n: "12+", l: "Publicações" },
    { n: "01", l: "Patente" },
    { n: "20+", l: "Projetos" },
    { n: "8+", l: "Anos Exp." },
  ];
  let sx = 15;
  for (const s of stats) {
    doc.setFillColor(...C.card);
    doc.roundedRect(sx, 53, 40, 12, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...C.neon);
    doc.text(s.n, sx + 20, 61, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...C.muted);
    doc.text(s.l.toUpperCase(), sx + 20, 64, { align: "center" });
    sx += 43;
  }

  // Separator line
  doc.setDrawColor(...C.neon);
  doc.setLineWidth(0.3);
  doc.line(15, 68, 195, 68);

  let y = 72;

  // ── Sobre ────────────────────────────────────────────────────────────────────
  y = addSection(doc, "Sobre", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...C.muted);
  const about =
    type === "ux"
      ? "Designer e pesquisador com foco em UX/UI e design centrado no usuário. Trabalho no CriaLab-Tecnopuc com projetos de inovação para empresas como HP. Mestre em Design e Tecnologia pela UFRGS, doutorando com pesquisa em interação natural em VR (MuseuVR). Utilizo IA para análises estratégicas e geração de insights."
      : type === "academic"
      ? "Pesquisador e designer doutorando em Design pela UFRGS, bolsista CAPES. Produzi 12+ publicações científicas sobre preservação patrimonial em AR, digitalização 3D e interação em VR. Desenvolvedor do projeto MuseuVR e do repositório 3D de prédios históricos da UFRGS. Mestre em Design e Tecnologia (2015)."
      : type === "innovation"
      ? "Designer de Inovação e Tecnologias Emergentes no CriaLab-Tecnopuc/PUC-RS. Especialista em VR/AR, UX estratégico e IA aplicada. Desenvolvo soluções imersivas para empresas (HP, Sicredi, Banrisul) e projetos de inovação territorial (Semear AgroHUB). Patente registrada. Prêmio Bornancini 2024."
      : "Designer, pesquisador e educador com 8+ anos de experiência na interseção entre UX/UI, VR/AR, IA e inovação. Pesquisador do CriaLab-Tecnopuc e doutorando em Design pela UFRGS. Professor (ESPM). Produção acadêmica de 12+ publicações, 1 patente e 20+ projetos digitais.";
  const aboutLines = doc.splitTextToSize(about, 180);
  doc.text(aboutLines, 15, y);
  y += aboutLines.length * 4.5 + 4;

  // ── Experiência ──────────────────────────────────────────────────────────────
  y = addSection(doc, "Experiência Profissional", y);

  y = addItem(doc, "Designer e Pesquisador de Inovação", "CriaLab - Tecnopuc / PUC-RS", "2021 – presente", [
    "Projetos de UX/UI, IA e tecnologias imersivas (VR/AR) para empresas como HP, Sicredi e Banrisul",
    "Semear AgroHUB: estratégia, UX e governança de hub de inovação no agronegócio",
    "Prototipagem rápida, impressão 3D e facilitação de workshops de cocriação",
  ], y);

  y = addItem(doc, "Doutorando e Pesquisador", "UFRGS – Laboratório de Design e Seleção de Materiais (LdSM)", "2017 – presente", [
    "Desenvolvimento do projeto MuseuVR: interação natural em ambientes culturais virtuais",
    "12+ publicações científicas internacionais sobre VR, AR e preservação patrimonial",
    "Bolsista CAPES",
  ], y);

  if (type !== "ux") {
    y = addItem(doc, "Professor", "ESPM Porto Alegre", "2018 – 2022", [
      "Disciplinas: Cibercultura, Web Design, Design Digital, Inovação Social, Mobilidade & Apps",
    ], y);
  }

  if (y > 240) {
    doc.addPage();
    addPageBackground(doc);
    doc.setFillColor(...C.neon);
    doc.rect(0, 0, 4, 297, "F");
    y = 15;
  }

  // ── Formação ──────────────────────────────────────────────────────────────────
  y = addSection(doc, "Formação Acadêmica", y);

  y = addItem(doc, "Doutorado em Design (em andamento)", "UFRGS", "2017 – presente", [
    "Pesquisa: interação natural em realidade virtual — Projeto MuseuVR",
  ], y);

  y = addItem(doc, "Mestrado em Design e Tecnologia", "UFRGS", "2013 – 2015", [
    "Dissertação: Repositório 3D de elementos de fachada de prédios históricos da UFRGS",
  ], y);

  y = addItem(doc, "Bacharelado em Comunicação Social — Publicidade", "UFRGS", "2004 – 2010", [], y);

  if (type === "academic" || type === "full") {
    y = addItem(doc, "English for Business", "Leinster College — Irlanda", "2009 – 2010", [], y);
  }

  // ── Skills ────────────────────────────────────────────────────────────────────
  if (y > 230) {
    doc.addPage();
    addPageBackground(doc);
    doc.setFillColor(...C.neon);
    doc.rect(0, 0, 4, 297, "F");
    y = 15;
  }

  y = addSection(doc, "Competências", y);

  const skillGroups =
    type === "ux"
      ? [
          { label: "UX/UI Design", items: ["Figma (95%)", "User Research (90%)", "Prototipagem (95%)", "Design Thinking (90%)", "Service Design (85%)", "Usabilidade (90%)"] },
          { label: "Tecnologia & Dev", items: ["HTML/CSS (85%)", "JavaScript (75%)", "Python (50%)", "Prototipagem Rápida (90%)"] },
        ]
      : type === "academic"
      ? [
          { label: "Pesquisa & Metodologia", items: ["Digitalização 3D", "WebGL / Three.js", "Unity 3D (90%)", "Blender (85%)", "Escrita Científica", "Revisão por Pares"] },
          { label: "IA & Análise", items: ["IA aplicada a Design (85%)", "Data Analysis (75%)", "AI Ethics (80%)"] },
        ]
      : [
          { label: "UX/UI", items: ["Figma (95%)", "User Research (90%)", "Design Thinking (90%)", "Service Design (85%)"] },
          { label: "VR/AR & 3D", items: ["Unity 3D (90%)", "Blender (85%)", "RV (95%)", "RA (85%)", "Impressão 3D (85%)"] },
          { label: "IA", items: ["IA em Design (85%)", "Análises Estratégicas (80%)", "AI Ethics (80%)"] },
          { label: "Dev", items: ["HTML/CSS (85%)", "JavaScript (75%)", "Python (50%)"] },
        ];

  const skillColW = Math.floor(175 / skillGroups.length);
  const startY = y;
  let maxY = startY;

  skillGroups.forEach((group, gi) => {
    let sy = startY;
    const cx = 15 + gi * (skillColW + 2);
    doc.setFillColor(...C.card);
    doc.roundedRect(cx, sy, skillColW, 6 + group.items.length * 5, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...C.neon);
    doc.text(group.label.toUpperCase(), cx + 4, sy + 4.5);
    sy += 7;
    for (const item of group.items) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...C.white);
      doc.text(`→ ${item}`, cx + 4, sy);
      sy += 5;
    }
    if (sy > maxY) maxY = sy;
  });

  y = maxY + 6;

  // ── Prêmios & Idiomas ──────────────────────────────────────────────────────────
  y = addSection(doc, "Prêmios · Patente · Idiomas", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...C.white);
  doc.text("🏆 Prêmio Bornancini 2024 — Design Digital · Realidade Aumentada", 15, y);
  y += 5;
  doc.text("🏆 39º Prêmio Direitos Humanos de Jornalismo 2022 — Menção honrosa (Revista Ceos)", 15, y);
  y += 5;
  doc.text("🔬 Patente Registrada — Sistema e método para produção de assentos customizáveis", 15, y);
  y += 5;
  doc.setTextColor(...C.muted);
  doc.text("Idiomas: Português (Nativo)  ·  Inglês (Profissional)  ·  Espanhol (Intermediário)", 15, y);

  // Footer
  doc.setDrawColor(...C.neon);
  doc.setLineWidth(0.2);
  doc.line(15, 285, 195, 285);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...C.muted);
  doc.text("guilherme-resende.netlify.app  ·  guiresende20@gmail.com  ·  wa.me/5551997925092", 105, 290, { align: "center" });
  doc.setTextColor(...C.neon);
  doc.text(`[ ${config.title.toUpperCase()} ]`, 195, 290, { align: "right" });

  // Save
  const filename = `Guilherme_Resende_CV_${config.title.replace(/[^a-zA-Z]/g, "_")}.pdf`;
  doc.save(filename);
}
