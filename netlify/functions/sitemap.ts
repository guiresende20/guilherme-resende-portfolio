import type { Handler } from "@netlify/functions";
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

export const handler: Handler = async (event) => {
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

    const blogUrls: Array<{ loc: string; lastmod: string }> = [];
    for (const file of mdFiles) {
      try {
        const raw = await downloadText(file.id);
        const { meta } = parsePost(raw, file.name);
        if (meta.draft) continue;
        blogUrls.push({
          loc: `${SITE_URL}/blog/${encodeURIComponent(meta.slug)}`,
          lastmod: meta.date,
        });
      } catch (err) {
        console.error("sitemap: failed to process", file.name, err);
      }
    }

    const today = new Date().toISOString().slice(0, 10);

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(SITE_URL + "/")}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${escapeXml(SITE_URL + "/blog")}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>
${blogUrls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=600",
      },
      body: xml,
    };
  } catch (err) {
    console.error("sitemap: handler failed", err);
    return {
      statusCode: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: "Failed to build sitemap",
    };
  }
};
