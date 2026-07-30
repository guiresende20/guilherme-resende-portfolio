import type { Handler, HandlerResponse } from "@netlify/functions";

const SITE_URL = "https://guiresende20.netlify.app";

export const handler: Handler = async (event): Promise<HandlerResponse> => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const catalog = {
    linkset: [
      {
        anchor: `${SITE_URL}/api/blog/list`,
        "service-doc": [{ href: `${SITE_URL}/docs/agent-api.md` }],
      },
      {
        anchor: `${SITE_URL}/api/blog/post/{slug}`,
        "service-doc": [{ href: `${SITE_URL}/docs/agent-api.md` }],
      },
      {
        anchor: `${SITE_URL}/api/blog/rss`,
        "service-doc": [{ href: `${SITE_URL}/docs/agent-api.md`, type: "text/markdown" }],
      },
      {
        anchor: `${SITE_URL}/sitemap.xml`,
        "service-doc": [{ href: "https://www.sitemaps.org/protocol.html" }],
      },
    ],
  };

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/linkset+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
    body: JSON.stringify(catalog, null, 2),
  };
};
