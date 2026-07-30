import type { Handler, HandlerResponse } from "@netlify/functions";

const SITE_URL = "https://guiresende20.netlify.app";

export const handler: Handler = async (event): Promise<HandlerResponse> => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const index = {
    $schema: "https://github.com/cloudflare/agent-skills-discovery-rfc",
    skills: [
      {
        name: "read-blog",
        type: "text/markdown",
        description:
          "Read and cite posts from Guilherme Resende's blog via a public, read-only JSON/Atom API.",
        url: `${SITE_URL}/.well-known/agent-skills/read-blog/SKILL.md`,
        sha256: "0d7f911a544e7d5dfdf12dc592a9d3380c5ecfc49c1e3a60c20595c3558ab20e",
      },
    ],
  };

  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
    body: JSON.stringify(index, null, 2),
  };
};
