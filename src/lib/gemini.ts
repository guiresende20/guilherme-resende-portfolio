// O frontend NÃO acessa a Gemini API diretamente.
// Todas as chamadas vão para a Netlify Function /api/chat (proxy seguro).
// A API Key fica EXCLUSIVAMENTE no servidor — nunca no browser.

import { validateChatActions } from "./chat-actions";
import { validateChatSources, MAX_ANSWER_CHARS, type ChatSource } from "./chat-grounding";

export const WELCOME_MESSAGE =
  "Olá! Sou o Guilherme Resende — designer, pesquisador e entusiasta de tecnologia.\n\nEstou aqui para conversar sobre minha trajetória, projetos, skills ou qualquer coisa relacionada ao meu trabalho. O que você quer saber?";

export interface ChatHistory {
  role: "user" | "model";
  parts: { text: string }[];
}

export type ActionType =
  | "video"
  | "scroll"
  | "link"
  | "whatsapp"
  | "email"
  | "download_cv";

export interface ChatAction {
  type: ActionType;
  label: string;
  url?: string;        // para video, link, whatsapp, email
  section?: string;   // para scroll (sem #)
  cv_type?: "ux" | "academic" | "innovation" | "full"; // para download_cv
}

export interface ChatResponse {
  text: string;
  actions: ChatAction[];
  sources?: ChatSource[];
}

/**
 * Envia uma mensagem para a Netlify Function que faz proxy seguro da Gemini API.
 */
export async function sendChatMessage(
  message: string,
  history: ChatHistory[]
): Promise<ChatResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
    signal: AbortSignal.timeout(25000),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${response.status}`);
  }

  const data = await response.json();
  if (typeof data.text !== "string" || !data.text.trim() || data.text.length > MAX_ANSWER_CHARS) throw new Error("Resposta inválida");

  // Defense in depth: re-validate actions client-side. The server already
  // validates, but a stale cache or middleware tampering could deliver bad
  // shapes — and the consequence (window.open / iframe src) is too direct
  // to trust a single layer.
  return {
    text: data.text,
    actions: validateChatActions(data.actions),
    sources: validateChatSources(data.sources),
  };
}
