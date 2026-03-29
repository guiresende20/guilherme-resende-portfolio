// O frontend NÃO acessa a Gemini API diretamente.
// Todas as chamadas vão para a Netlify Function /api/chat (proxy seguro).
// A API Key fica EXCLUSIVAMENTE no servidor — nunca no browser.

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
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Erro ${response.status}`);
  }

  const data = await response.json();

  // Garante que a resposta tem o formato correto
  return {
    text: data.text || "Desculpe, não consegui processar sua mensagem.",
    actions: Array.isArray(data.actions) ? data.actions : [],
  };
}
