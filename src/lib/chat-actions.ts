import type { ChatAction } from "./gemini";

const MAX_ACTIONS = 10;
const MAX_LABEL_LEN = 80;
const SECTION_ID_RE = /^[a-zA-Z][a-zA-Z0-9_-]*$/;

const VIDEO_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "player.vimeo.com",
  "vimeo.com",
]);

const WHATSAPP_HOSTS = new Set(["wa.me"]);

const CV_TYPES = new Set(["ux", "academic", "innovation", "full"]);

function isHttpsHost(url: unknown, allowedHosts: Set<string> | null): boolean {
  if (typeof url !== "string") return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  if (allowedHosts && !allowedHosts.has(parsed.hostname)) return false;
  return true;
}

function isValidMailto(url: unknown): boolean {
  if (typeof url !== "string") return false;
  if (!url.startsWith("mailto:")) return false;
  const addr = url.slice("mailto:".length).split("?")[0];
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr);
}

function validateOne(raw: unknown): ChatAction | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;

  const label = a.label;
  if (typeof label !== "string" || label.length === 0 || label.length > MAX_LABEL_LEN) return null;

  switch (a.type) {
    case "link":
      return isHttpsHost(a.url, null)
        ? { type: "link", label, url: a.url as string }
        : null;

    case "video":
      return isHttpsHost(a.url, VIDEO_HOSTS)
        ? { type: "video", label, url: a.url as string }
        : null;

    case "whatsapp":
      return isHttpsHost(a.url, WHATSAPP_HOSTS)
        ? { type: "whatsapp", label, url: a.url as string }
        : null;

    case "email":
      return isValidMailto(a.url)
        ? { type: "email", label, url: a.url as string }
        : null;

    case "scroll":
      return typeof a.section === "string" && SECTION_ID_RE.test(a.section)
        ? { type: "scroll", label, section: a.section }
        : null;

    case "download_cv":
      return typeof a.cv_type === "string" && CV_TYPES.has(a.cv_type)
        ? { type: "download_cv", label, cv_type: a.cv_type as ChatAction["cv_type"] }
        : null;

    default:
      return null;
  }
}

export function validateChatActions(input: unknown): ChatAction[] {
  if (!Array.isArray(input)) return [];
  const result: ChatAction[] = [];
  for (const raw of input) {
    const valid = validateOne(raw);
    if (valid) result.push(valid);
    if (result.length >= MAX_ACTIONS) break;
  }
  return result;
}
