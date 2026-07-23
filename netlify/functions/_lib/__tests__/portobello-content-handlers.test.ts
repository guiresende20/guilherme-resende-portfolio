import { describe, it, expect } from "vitest";
import {
  handleGetContent, handleSaveContent, handleSaveImage, handleGetImage,
  handleAddSlide, handleHideSlide
} from "../portobello-content-handlers.mjs";

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

describe("portobello content handlers", () => {
  it("GET vazio retorna overrides/added/hidden default", async () => {
    const res = await handleGetContent(fakeStore());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ overrides: {}, added: [], hidden: [], order: [] });
  });

  it("saveContent grava patch e GET reflete", async () => {
    const store = fakeStore();
    const r = await handleSaveContent(
      { slideId: "s1", patch: { title: "Novo", body: ["a", "b"] } }, store);
    expect(r.status).toBe(200);
    const got = await handleGetContent(store);
    expect((got.body.overrides as any)["s1"]).toEqual({ title: "Novo", body: ["a", "b"] });
  });

  it("patch sem slideId é 400", async () => {
    expect((await handleSaveContent({ patch: { title: "z" } }, fakeStore())).status).toBe(400);
  });

  it("campo null remove o override; override vazio apaga a entrada", async () => {
    const store = fakeStore();
    await handleSaveContent({ slideId: "s", patch: { title: "T" } }, store);
    await handleSaveContent({ slideId: "s", patch: { title: null } }, store);
    const got = await handleGetContent(store);
    expect((got.body.overrides as any)["s"]).toBeUndefined();
  });

  it("addSlide + hideSlide de slide adicionado o remove da lista", async () => {
    const store = fakeStore();
    await handleAddSlide({ slide: { id: "novo-1", title: "X" } }, store);
    let got = await handleGetContent(store);
    expect((got.body.added as any[]).length).toBe(1);
    await handleHideSlide({ slideId: "novo-1" }, store);
    got = await handleGetContent(store);
    expect((got.body.added as any[]).length).toBe(0);
    expect(got.body.hidden).toEqual([]);   // added deletado não vira hidden
  });

  it("hideSlide de slide base registra em hidden (sem duplicar)", async () => {
    const store = fakeStore();
    await handleHideSlide({ slideId: "base-1" }, store);
    await handleHideSlide({ slideId: "base-1" }, store);
    const got = await handleGetContent(store);
    expect(got.body.hidden).toEqual(["base-1"]);
  });

  it("saveImage devolve imageUrl no endpoint portobello e getImage a serve", async () => {
    const store = fakeStore();
    const b64 = Buffer.from("fake-image-bytes").toString("base64");
    const r = await handleSaveImage(
      { slideId: "s1", imageUpload: { dataBase64: b64, contentType: "image/jpeg" } }, store);
    expect(r.status).toBe(200);
    expect(r.body.imageUrl).toMatch(/^\/api\/portobello-content\/image\?key=images%2F/);
    const key = decodeURIComponent(String(r.body.imageUrl).split("key=")[1]);
    const img = await handleGetImage(key, store);
    expect(img.status).toBe(200);
    expect(img.contentType).toBe("image/jpeg");
  });

  it("saveImage rejeita content-type não permitido", async () => {
    const r = await handleSaveImage(
      { slideId: "s1", imageUpload: { dataBase64: "aGk=", contentType: "application/pdf" } },
      fakeStore());
    expect(r.status).toBe(400);
  });

  it("getImage barra path traversal e prefixo errado", async () => {
    expect((await handleGetImage("../secrets", fakeStore())).status).toBe(400);
    expect((await handleGetImage("other/abc", fakeStore())).status).toBe(400);
  });
});
