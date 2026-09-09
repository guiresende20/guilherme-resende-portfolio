import { describe, it, expect } from "vitest";
import {
  handleSeedBase, handleGetContent, handleSaveContent, handleSaveImage, handleGetImage,
  handleAddSlide, handleHideSlide, handleSaveOrder
} from "../deck-content-handlers.mjs";

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
  };
}

describe("deck content handlers", () => {
  it("GET sem base cadastrada retorna 404", async () => {
    const res = await handleGetContent("acme", fakeStore());
    expect(res.status).toBe(404);
  });

  it("GET com base cadastrada retorna base + defaults vazios", async () => {
    const store = fakeStore();
    await handleSeedBase("acme", { meta: { title: "Acme" }, slides: [] }, store);
    const res = await handleGetContent("acme", store);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      base: { meta: { title: "Acme" }, slides: [] },
      overrides: {}, added: [], hidden: [], order: []
    });
  });

  it("dois slugs diferentes não colidem no mesmo store", async () => {
    const store = fakeStore();
    await handleSeedBase("acme", { meta: {}, slides: [] }, store);
    await handleSeedBase("globex", { meta: {}, slides: [] }, store);
    await handleSaveContent("acme", { slideId: "s1", patch: { title: "Acme title" } }, store);
    const acme = await handleGetContent("acme", store);
    const globex = await handleGetContent("globex", store);
    expect(acme.body.overrides).toEqual({ s1: { title: "Acme title" } });
    expect(globex.body.overrides).toEqual({});
  });

  it("saveOrder valida array de strings", async () => {
    const store = fakeStore();
    await handleSeedBase("acme", { meta: {}, slides: [] }, store);
    const bad = await handleSaveOrder("acme", { order: "nope" }, store);
    expect(bad.status).toBe(400);
    const ok = await handleSaveOrder("acme", { order: ["s2", "s1"] }, store);
    expect(ok.status).toBe(200);
    const res = await handleGetContent("acme", store);
    expect(res.body.order).toEqual(["s2", "s1"]);
  });

  it("hideSlide de um slide adicionado remove de added + limpa override", async () => {
    const store = fakeStore();
    await handleSeedBase("acme", { meta: {}, slides: [] }, store);
    await handleAddSlide("acme", { slide: { id: "novo", title: "X" } }, store);
    await handleSaveContent("acme", { slideId: "novo", patch: { title: "Y" } }, store);
    const res = await handleHideSlide("acme", { slideId: "novo" }, store);
    expect(res.status).toBe(200);
    const content = await handleGetContent("acme", store);
    expect(content.body.added).toEqual([]);
    expect(content.body.overrides).toEqual({});
  });

  it("saveImage rejeita tipo não permitido e aceita tipo permitido com URL namespaced", async () => {
    const store = fakeStore();
    await handleSeedBase("acme", { meta: {}, slides: [] }, store);
    const bad = await handleSaveImage("acme", {
      slideId: "s1", imageUpload: { dataBase64: "AAAA", contentType: "application/pdf" }
    }, store);
    expect(bad.status).toBe(400);
    const ok = await handleSaveImage("acme", {
      slideId: "s1", imageUpload: { dataBase64: "AAAA", contentType: "image/png" }
    }, store);
    expect(ok.status).toBe(200);
    expect(ok.body.imageUrl).toMatch(/^\/api\/deck-content\/acme\/image\?key=acme%3Aimages%2F/);
  });

  it("getImage recusa key fora do namespace do slug", async () => {
    const store = fakeStore();
    const res = await handleGetImage("acme", "globex:images/s1-abc", store);
    expect(res.status).toBe(400);
  });
});
