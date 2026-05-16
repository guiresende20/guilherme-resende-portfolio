import { getStore } from "@netlify/blobs";

interface CachedEntry<T> {
  value: T;
  expiresAt: number | null; // null = never expires
}

const STORE_NAME = "blog";

function store() {
  return getStore(STORE_NAME);
}

export async function getCached<T>(key: string): Promise<T | null> {
  const raw = await store().get(key, { type: "json" });
  if (!raw) return null;
  const entry = raw as CachedEntry<T>;
  if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
    return null;
  }
  return entry.value;
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlMs: number | null
): Promise<void> {
  const entry: CachedEntry<T> = {
    value,
    expiresAt: ttlMs === null ? null : Date.now() + ttlMs,
  };
  await store().setJSON(key, entry);
}

export async function getCachedBinary(key: string): Promise<Buffer | null> {
  const buf = await store().get(key, { type: "arrayBuffer" });
  return buf ? Buffer.from(buf) : null;
}

export async function setCachedBinary(
  key: string,
  data: Buffer
): Promise<void> {
  const ab = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
  await store().set(key, ab);
}

export async function deleteCached(key: string): Promise<void> {
  await store().delete(key);
}

export async function deleteByPrefix(prefix: string): Promise<void> {
  const { blobs } = await store().list({ prefix });
  await Promise.all(blobs.map((b) => store().delete(b.key)));
}
