import type { Handler, HandlerEvent } from "@netlify/functions";
import { corsHeaders, getClientIp, getRequestOrigin, isOriginAllowed } from "./_lib/security";
import { checkRateLimits } from "./_lib/ratelimit";

// Text-to-speech para o slide "Frase + IA" do deck /portobello.
// Recebe { text } e devolve o áudio da resposta na voz da IA (Gemini TTS, voz
// "Puck" — a mesma da voz Live do chatbot). Retorna PCM base64 24kHz/16-bit,
// que o deck decodifica e toca via Web Audio, sincronizado com a digitação.
// A master key (GEMINI_API_KEY) nunca deixa o servidor.

const TTS_RATE_LIMITS = [
  { limit: 8, windowMs: 60_000, label: "min" },
  { limit: 40, windowMs: 60 * 60_000, label: "hour" },
];

// TTS é caro e lento em textos longos; limita o que é falado.
const MAX_TTS_CHARS = 1500;
const TTS_MODEL = "gemini-2.5-flash-preview-tts";
const TTS_VOICE = "Puck";

// extrai a taxa de amostragem do mime (ex.: "audio/L16;rate=24000"); default 24k
function sampleRateFromMime(mime: string | undefined): number {
  const m = /rate=(\d+)/.exec(mime || "");
  return m ? parseInt(m[1], 10) : 24000;
}

const handler: Handler = async (event: HandlerEvent) => {
  const origin = getRequestOrigin(event);
  const allowed = isOriginAllowed(origin);

  if (event.httpMethod === "OPTIONS") {
    if (!allowed) return { statusCode: 403, body: "" };
    return { statusCode: 204, headers: corsHeaders(origin, "POST"), body: "" };
  }

  if (!allowed) {
    return { statusCode: 403, body: JSON.stringify({ error: "Origem não autorizada" }) };
  }

  const headers = { ...corsHeaders(origin, "POST"), "Content-Type": "application/json" };

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const ip = getClientIp(event);
  const rate = checkRateLimits("portobello-tts", ip, TTS_RATE_LIMITS);
  if (!rate.ok) {
    return {
      statusCode: 429,
      headers: { ...headers, "Retry-After": String(rate.retryAfter) },
      body: JSON.stringify({ error: "Muitas requisições" }),
    };
  }

  let text = "";
  try {
    const parsed = JSON.parse(event.body || "{}");
    text = typeof parsed.text === "string" ? parsed.text : "";
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "JSON inválido" }) };
  }
  text = text.trim();
  if (!text) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Texto ausente" }) };
  }
  if (text.length > MAX_TTS_CHARS) text = text.slice(0, MAX_TTS_CHARS);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("portobello-tts: GEMINI_API_KEY ausente");
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro interno" }) };
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } },
              languageCode: "pt-BR",
            },
          },
        }),
      },
    );

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error("portobello-tts: Gemini TTS failed", response.status, errBody);
      return { statusCode: 502, headers, body: JSON.stringify({ error: "Falha ao gerar áudio" }) };
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
    };
    const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    const audioBase64 = part?.inlineData?.data;
    if (!audioBase64) {
      console.error("portobello-tts: resposta sem áudio", JSON.stringify(data).slice(0, 300));
      return { statusCode: 502, headers, body: JSON.stringify({ error: "Sem áudio na resposta" }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        audioBase64,
        sampleRate: sampleRateFromMime(part?.inlineData?.mimeType),
      }),
    };
  } catch (error: unknown) {
    console.error("portobello-tts error:", error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Erro interno" }) };
  }
};

export { handler };
