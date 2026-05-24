import { readFileSync } from "node:fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

const envText = (() => {
  try { return readFileSync(".env.local", "utf8"); } catch {}
  try { return readFileSync(".env", "utf8"); } catch {}
  return "";
})();
const apiKey = envText.split("\n").find(l => l.startsWith("GEMINI_API_KEY="))?.slice("GEMINI_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
if (!apiKey) { console.error("GEMINI_API_KEY ausente"); process.exit(1); }

const SYSTEM = "Você é o Guilherme Resende — designer, pesquisador, doutorando UFRGS, atua no CriaLab. Responda em primeira pessoa, em português, em no máximo 400 caracteres. Retorne SEMPRE JSON {\"text\":\"...\",\"actions\":[]}.";
const PROMPTS = [
  "Qual sua experiência com VR e realidade aumentada?",
  "Conta sobre o MuseuVR.",
  "Como posso entrar em contato com você?",
];
const MODELS = ["gemini-2.5-flash", "gemini-3.1-flash-lite"];
const RUNS = 2;

const genAI = new GoogleGenerativeAI(apiKey);

async function timed(modelId, prompt) {
  const model = genAI.getGenerativeModel({
    model: modelId,
    systemInstruction: SYSTEM,
    generationConfig: { temperature: 0.5, topP: 0.9, maxOutputTokens: 1500, responseMimeType: "application/json" },
  });
  const t0 = performance.now();
  const result = await model.generateContent(prompt);
  const ms = performance.now() - t0;
  const text = result.response.text();
  let preview = "";
  try { preview = (JSON.parse(text).text ?? "").slice(0, 80); } catch { preview = text.slice(0, 80); }
  return { ms: Math.round(ms), chars: text.length, preview };
}

const rows = [];
for (const prompt of PROMPTS) {
  for (const model of MODELS) {
    for (let i = 0; i < RUNS; i++) {
      try {
        const r = await timed(model, prompt);
        rows.push({ model, prompt: prompt.slice(0, 40), run: i + 1, ...r });
        console.log(`[${model}] run ${i + 1} — ${r.ms}ms / ${r.chars}ch — "${r.preview}"`);
      } catch (e) {
        console.error(`[${model}] run ${i + 1} FAIL:`, e.message);
        rows.push({ model, prompt: prompt.slice(0, 40), run: i + 1, ms: -1, chars: 0, preview: `ERR ${e.message}` });
      }
    }
  }
}

console.log("\n=== AGREGADO ===");
for (const model of MODELS) {
  const okRows = rows.filter(r => r.model === model && r.ms > 0);
  if (!okRows.length) { console.log(`${model}: sem rodadas válidas`); continue; }
  const avg = Math.round(okRows.reduce((a, r) => a + r.ms, 0) / okRows.length);
  const min = Math.min(...okRows.map(r => r.ms));
  const max = Math.max(...okRows.map(r => r.ms));
  const avgChars = Math.round(okRows.reduce((a, r) => a + r.chars, 0) / okRows.length);
  console.log(`${model.padEnd(25)} avg=${avg}ms  min=${min}ms  max=${max}ms  avgChars=${avgChars}  n=${okRows.length}`);
}
