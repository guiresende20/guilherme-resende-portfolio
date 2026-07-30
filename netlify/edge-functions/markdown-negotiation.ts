import type { Context } from "@netlify/edge-functions";

const SITE_URL = "https://guiresende20.netlify.app";

function wantsMarkdown(req: Request): boolean {
  const accept = req.headers.get("accept") || "";
  return accept.toLowerCase().includes("text/markdown");
}

const HOMEPAGE_MD = `# Guilherme Resende Muniz

Designer de Inovação e Tecnologias Emergentes — CriaLab / Tecnopuc, PUC-RS. Porto Alegre, RS, Brasil.

Trabalho na interseção entre design, inteligência artificial e tecnologias emergentes, explorando novas formas de criação, prototipagem e inovação aplicada em educação, cultura e organizações.

## Sobre

Designer e pesquisador com mestrado em Design e Tecnologia e graduação em Comunicação Social pela UFRGS. Atuo no CriaLab - Tecnopuc com projetos de inovação e tecnologia, incluindo tecnologias imersivas (VR/AR), desenvolvendo soluções estratégicas para empresas como a HP e órgãos públicos (ex.: Semear Agrohub).

Experiência prática em prototipagem rápida, impressão 3D e facilitação de workshops. Uso IA para análises estratégicas, geração de insights e design de serviços.

Passagens pela ESPM como professor, pelo marketing do Anglo Vestibulares e pela startup BSMotion.

## Experiência

- **Designer e Pesquisador de Inovação** — CriaLab - Tecnopuc (2021–presente)
- **Doutorando e Pesquisador** — UFRGS - LdSM (2017–presente), projeto MuseuVR
- **Professor** — ESPM (2018–2022)
- **Head de Marketing** — BSMotion (2017)
- **Gerente de Marketing** — Anglo Vestibulares (2008, 2012–2013)
- **Executivo de Contas e Curador** — Campus Party Brasil (2010–2011)

## Projetos selecionados

- **MuseuVR** — interação natural em ambientes culturais virtuais (doutorado)
- **Semear AgroHUB** — estratégia, UX e governança para hub de inovação no agronegócio
- **Projeto Aula 360º** — aprendizado em realidade virtual
- **Digitalização 3D: Preservação Patrimonial** — repositório 3D de prédios históricos (mestrado)
- **MataArte** — imagem generativa a partir de fotos analógicas, exposição 360°
- **IASPI AR/3D** — cartão postal em realidade aumentada de Porto Alegre
- **Gesture Keys** — reconhecimento de gestos por webcam para atalhos de teclado (Python, MediaPipe)

Patente registrada: sistema e método para produção de assentos customizáveis (BR1020180685074).

## Formação

- Doutorado em Design — UFRGS (2017–presente)
- Mestrado em Design e Tecnologia — UFRGS (2013–2015)
- Bacharelado em Comunicação Social - Publicidade — UFRGS (2004–2010)

## Blog

Posts em [/blog](${SITE_URL}/blog) — lista via [/api/blog/list](${SITE_URL}/api/blog/list), feed Atom em [/api/blog/rss](${SITE_URL}/api/blog/rss).

## Contato

- E-mail: guiresende20@gmail.com
- Site: ${SITE_URL}
`;

interface PostMeta {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt?: string;
}

async function blogIndexMarkdown(origin: string): Promise<string> {
  const res = await fetch(`${origin}/.netlify/functions/blog-list`);
  if (!res.ok) return "# Blog\n\nNão foi possível carregar a lista de posts.";
  const { posts } = (await res.json()) as { posts: PostMeta[] };
  const items = posts
    .map(
      (p) =>
        `- [${p.title}](${SITE_URL}/blog/${encodeURIComponent(p.slug)}) — ${p.date}${
          p.excerpt ? `\n  ${p.excerpt}` : ""
        }`,
    )
    .join("\n");
  return `# Blog\n\n${items}\n`;
}

async function blogPostMarkdown(origin: string, slug: string): Promise<string | null> {
  const res = await fetch(`${origin}/.netlify/functions/blog-post/${encodeURIComponent(slug)}`);
  if (!res.ok) return null;
  const { meta, body } = (await res.json()) as { meta: PostMeta; body: string };
  const tags = meta.tags?.length ? `\nTags: ${meta.tags.join(", ")}\n` : "";
  return `# ${meta.title}\n\n_${meta.date}_${tags}\n\n${body}\n`;
}

export default async (req: Request, context: Context): Promise<Response> => {
  if (!wantsMarkdown(req)) return context.next();

  const url = new URL(req.url);
  const mdHeaders = {
    "content-type": "text/markdown; charset=utf-8",
    "cache-control": "public, max-age=600",
  };

  if (url.pathname === "/") {
    return new Response(HOMEPAGE_MD, { headers: mdHeaders });
  }
  if (url.pathname === "/blog" || url.pathname === "/blog/") {
    return new Response(await blogIndexMarkdown(url.origin), { headers: mdHeaders });
  }
  // Exclude segments with a dot (e.g. Netlify's clean-URL probing for
  // /blog/slug.html) so those pass straight through instead of being
  // treated as a slug and re-triggering this function recursively.
  const match = /^\/blog\/([^/.]+)\/?$/.exec(url.pathname);
  if (match) {
    const body = await blogPostMarkdown(url.origin, decodeURIComponent(match[1]));
    if (body) return new Response(body, { headers: mdHeaders });
  }
  return context.next();
};
