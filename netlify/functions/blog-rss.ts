import type { Handler, HandlerResponse } from "@netlify/functions";
import { listFolder, downloadText } from "./_lib/drive";
import { resolveBlogFolders } from "./_lib/blog-folders";
import { parsePost } from "../../src/lib/blog/frontmatter";

const SITE_URL = "https://guiresende20.netlify.app";

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  }[c]!));
}

export const handler: Handler = async (event): Promise<HandlerResponse> => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const folders = await resolveBlogFolders();
    const files = await listFolder(folders.rootId);
    const mdFiles = files.filter((f) => {
      if (!f.name.endsWith(".md")) return false;
      if (f.mimeType.startsWith("application/vnd.google-apps.")) {
        console.warn(`Skipping "${f.name}": stored as ${f.mimeType} (Google-converted, not raw markdown)`);
        return false;
      }
      return true;
    });

    const entries: Array<{ slug: string; title: string; date: string; excerpt: string }> = [];
    for (const file of mdFiles) {
      try {
        const raw = await downloadText(file.id);
        const { meta } = parsePost(raw, file.name);
        if (meta.draft) continue;
        entries.push({
          slug: meta.slug,
          title: meta.title,
          date: meta.date,
          excerpt: meta.excerpt ?? "",
        });
      } catch (err) {
        console.error("blog-rss: failed to process", file.name, err);
      }
    }
    entries.sort((a, b) => b.date.localeCompare(a.date));

    const updated = entries[0]?.date ?? new Date().toISOString().slice(0, 10);

    const items = entries
      .map(
        (e) => `  <entry>
      <title>${escapeXml(e.title)}</title>
      <link href="${SITE_URL}/blog/${encodeURIComponent(e.slug)}" />
      <id>${SITE_URL}/blog/${encodeURIComponent(e.slug)}</id>
      <updated>${e.date}T00:00:00Z</updated>
      <summary>${escapeXml(e.excerpt)}</summary>
    </entry>`
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Guilherme Resende — Blog</title>
  <link href="${SITE_URL}/blog" />
  <link href="${SITE_URL}/api/blog/rss" rel="self" />
  <id>${SITE_URL}/blog</id>
  <updated>${updated}T00:00:00Z</updated>
  <author><name>Guilherme Resende Muniz</name></author>
${items}
</feed>`;

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/atom+xml; charset=utf-8",
        "cache-control": "public, max-age=600",
      },
      body: xml,
    };
  } catch (err) {
    console.error("blog-rss: handler failed", err);
    return {
      statusCode: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: "Failed to build RSS feed",
    };
  }
};
