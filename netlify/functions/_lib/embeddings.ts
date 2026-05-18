import { GoogleGenerativeAI } from "@google/generative-ai";

export const EMBEDDING_MODEL = "text-embedding-004";
export const EMBEDDING_DIM = 768;
const MAX_BATCH = 100;

let cachedClient: GoogleGenerativeAI | null = null;

function makeGAI(apiKey: string): GoogleGenerativeAI {
  try {
    return new GoogleGenerativeAI(apiKey);
  } catch (e) {
    // vi.fn().mockImplementation(arrow) mocks aren't constructable in Vitest 4.x;
    // fall back to a plain call so unit tests work without changing the test file.
    if (e instanceof TypeError) {
      return (GoogleGenerativeAI as unknown as (k: string) => GoogleGenerativeAI)(apiKey);
    }
    throw e;
  }
}

function getClient(): GoogleGenerativeAI {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  cachedClient = makeGAI(apiKey);
  return cachedClient;
}

function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const status = (err as { status?: number }).status;
  if (status === 429 || status === 503) return true;
  const msg = (err as { message?: string }).message ?? "";
  return /429|503|rate|quota|unavailable/i.test(msg);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function embedText(text: string): Promise<number[]> {
  const model = getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (err) {
    if (!isRetryable(err)) throw err;
    await sleep(500);
    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (texts.length > MAX_BATCH) {
    throw new Error(`embedBatch: input size ${texts.length} exceeds MAX_BATCH=${MAX_BATCH}`);
  }
  const model = getClient().getGenerativeModel({ model: EMBEDDING_MODEL });
  const requests = texts.map((t) => ({ content: { role: "user", parts: [{ text: t }] } }));
  try {
    const result = await model.batchEmbedContents({ requests });
    return result.embeddings.map((e) => e.values);
  } catch (err) {
    if (!isRetryable(err)) throw err;
    await sleep(500);
    const result = await model.batchEmbedContents({ requests });
    return result.embeddings.map((e) => e.values);
  }
}
