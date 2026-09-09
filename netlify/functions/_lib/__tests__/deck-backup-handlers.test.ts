import { describe, it, expect } from "vitest";
import {
  handleCaptureSnapshot, handleListBackups, handleRestoreBackup, handleExportBundle
} from "../deck-backup-handlers.mjs";

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
    async list({ prefix }: { prefix: string }) {
      return { blobs: [...data.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })) };
    },
    async delete(key: string) { data.delete(key); meta.delete(key); },
  };
}

describe("deck backup handlers", () => {
  it("captura snapshot e ignora se estado for igual ao topo do índice", async () => {
    const content = fakeStore();
    await content.setJSON("acme:overrides", { s1: { title: "A" } });
    const backups = fakeStore();
    const first = await handleCaptureSnapshot("acme", content, backups, "manual");
    expect(first.body.snapshot).toBeDefined();
    const second = await handleCaptureSnapshot("acme", content, backups, "manual");
    expect(second.body.skipped).toBe(true);
  });

  it("backups de slugs diferentes não colidem", async () => {
    const content = fakeStore();
    await content.setJSON("acme:overrides", { s1: { title: "A" } });
    await content.setJSON("globex:overrides", { s1: { title: "B" } });
    const backups = fakeStore();
    await handleCaptureSnapshot("acme", content, backups, "manual");
    await handleCaptureSnapshot("globex", content, backups, "manual");
    const acmeList = await handleListBackups("acme", backups);
    const globexList = await handleListBackups("globex", backups);
    expect(acmeList.body.backups).toHaveLength(1);
    expect(globexList.body.backups).toHaveLength(1);
  });

  it("restore recupera o estado do snapshot e cria um pre-restore antes", async () => {
    const content = fakeStore();
    await content.setJSON("acme:overrides", { s1: { title: "A" } });
    const backups = fakeStore();
    const snap = await handleCaptureSnapshot("acme", content, backups, "manual");
    await content.setJSON("acme:overrides", { s1: { title: "B" } });
    const res = await handleRestoreBackup("acme", { id: snap.body.snapshot.id }, content, backups);
    expect(res.status).toBe(200);
    expect(res.body.content.overrides).toEqual({ s1: { title: "A" } });
    const list = await handleListBackups("acme", backups);
    expect(list.body.backups.some((e: { reason: string }) => e.reason === "pre-restore")).toBe(true);
  });

  it("export inclui apenas imagens do namespace do slug", async () => {
    const content = fakeStore();
    await content.set("acme:images/s1-abc", Buffer.from("x"), { metadata: { contentType: "image/png" } });
    await content.set("globex:images/s1-abc", Buffer.from("y"), { metadata: { contentType: "image/png" } });
    const bundle = await handleExportBundle("acme", content);
    expect(bundle.body.images).toHaveLength(1);
    expect(bundle.body.images[0].key).toBe("acme:images/s1-abc");
  });
});
