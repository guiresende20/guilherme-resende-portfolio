import { describe, it, expect } from "vitest";
import {
  handleCaptureSnapshot, handleListBackups, handleRestoreBackup,
  handleExportBundle, hashContent, MAX_SNAPSHOTS
} from "../portobello-backup-handlers.mjs";

function fakeStore(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  const meta = new Map<string, unknown>();
  return {
    data, meta,
    async get(key: string, opts?: { type?: string }) {
      if (!opts || opts.type !== "json") throw new Error("fake: get com { type: 'json' }");
      return data.has(key) ? data.get(key) : null;
    },
    async setJSON(key: string, val: unknown) { data.set(key, val); },
    async set(key: string, val: unknown, opts?: { metadata?: unknown }) {
      data.set(key, val); if (opts?.metadata) meta.set(key, opts.metadata);
    },
    async getWithMetadata(key: string) {
      if (!data.has(key)) return null;
      return { data: data.get(key), metadata: meta.get(key) ?? {} };
    },
    async delete(key: string) { data.delete(key); meta.delete(key); },
    async list({ prefix }: { prefix: string }) {
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
  };
}

describe("portobello backup handlers", () => {
  it("snapshot captura o estado e lista", async () => {
    const content = fakeStore({ overrides: { s1: { title: "X" } } });
    const backup = fakeStore();
    const r = await handleCaptureSnapshot(content, backup, "teste");
    expect(r.status).toBe(200);
    expect((r.body as any).snapshot.reason).toBe("teste");
    const list = await handleListBackups(backup);
    expect((list.body as any).backups.length).toBe(1);
  });

  it("snapshot idêntico consecutivo é dedupado", async () => {
    const content = fakeStore();
    const backup = fakeStore();
    await handleCaptureSnapshot(content, backup, "a");
    const r2 = await handleCaptureSnapshot(content, backup, "b");
    expect((r2.body as any).skipped).toBe(true);
    expect((await handleListBackups(backup)).body.backups.length).toBe(1);
  });

  it("hash é estável independente da ordem das chaves", () => {
    expect(hashContent({ overrides: { a: 1, b: 2 }, added: [], hidden: [] }))
      .toBe(hashContent({ hidden: [], added: [], overrides: { b: 2, a: 1 } }));
  });

  it("restore reaplica os 3 JSONs e snapshota o estado atual antes", async () => {
    const content = fakeStore({ overrides: { s1: { title: "v1" } } });
    const backup = fakeStore();
    const snap = await handleCaptureSnapshot(content, backup, "v1");
    const id = (snap.body as any).snapshot.id;
    await content.setJSON("overrides", { s1: { title: "v2" } });
    const r = await handleRestoreBackup({ id }, content, backup);
    expect(r.status).toBe(200);
    expect(content.data.get("overrides")).toEqual({ s1: { title: "v1" } });
    // pre-restore do estado v2 entrou no índice
    const list = await handleListBackups(backup);
    expect((list.body as any).backups.some((b: any) => b.reason === "pre-restore")).toBe(true);
  });

  it("restore de id inexistente é 404; sem id é 400", async () => {
    expect((await handleRestoreBackup({ id: "nope" }, fakeStore(), fakeStore())).status).toBe(404);
    expect((await handleRestoreBackup({}, fakeStore(), fakeStore())).status).toBe(400);
  });

  it("export inclui conteúdo e imagens em base64", async () => {
    const content = fakeStore({ overrides: {} });
    await content.set("images/s1-abc", Buffer.from("img"), { metadata: { contentType: "image/png" } });
    const r = await handleExportBundle(content);
    expect(r.status).toBe(200);
    expect((r.body as any).images.length).toBe(1);
    expect((r.body as any).images[0].contentType).toBe("image/png");
  });

  it("poda além de MAX_SNAPSHOTS", async () => {
    const content = fakeStore();
    const backup = fakeStore();
    for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) {
      await content.setJSON("overrides", { n: i });   // muda o hash a cada volta
      await handleCaptureSnapshot(content, backup, "loop");
    }
    const list = await handleListBackups(backup);
    expect((list.body as any).backups.length).toBe(MAX_SNAPSHOTS);
  });
});
