import { describe, it, expect } from "vitest";
import {
  handleListRegistry, handleGetEntry, handleAddDeck, handleUpdateDeck, handleRemoveDeck
} from "../deck-registry-handlers.mjs";

function fakeStore(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    async get(key: string, opts?: { type?: string }) {
      if (!opts || opts.type !== "json") throw new Error("fake: get com { type: 'json' }");
      return data.has(key) ? data.get(key) : null;
    },
    async setJSON(key: string, val: unknown) { data.set(key, val); },
    async delete(key: string) { data.delete(key); },
  };
}

describe("deck registry handlers", () => {
  it("lista vazia por padrão", async () => {
    const res = await handleListRegistry(fakeStore());
    expect(res.body.decks).toEqual([]);
  });

  it("adiciona um deck válido e semeia o conteúdo base", async () => {
    const registry = fakeStore();
    const content = fakeStore();
    const res = await handleAddDeck(
      { slug: "acme", titulo: "Acme Talk", status: "publicado" }, registry, content
    );
    expect(res.status).toBe(200);
    expect(res.body.deck.slug).toBe("acme");
    expect(res.body.deck.status).toBe("publicado");
    const base = await content.get("acme:base", { type: "json" });
    expect(base.slides).toHaveLength(1);
  });

  it("rejeita slug inválido ou duplicado", async () => {
    const registry = fakeStore();
    const content = fakeStore();
    const badSlug = await handleAddDeck({ slug: "Acme Co", titulo: "X" }, registry, content);
    expect(badSlug.status).toBe(400);
    await handleAddDeck({ slug: "acme", titulo: "X" }, registry, content);
    const dup = await handleAddDeck({ slug: "acme", titulo: "Y" }, registry, content);
    expect(dup.status).toBe(409);
  });

  it("atualiza status e senha de um deck existente", async () => {
    const registry = fakeStore();
    const content = fakeStore();
    await handleAddDeck({ slug: "acme", titulo: "X", status: "nao-listado" }, registry, content);
    const res = await handleUpdateDeck("acme", { status: "publicado", senhaHash: "abc123" }, registry);
    expect(res.status).toBe(200);
    expect(res.body.deck.status).toBe("publicado");
    expect(res.body.deck.senhaHash).toBe("abc123");
    const notFound = await handleUpdateDeck("ghost", { status: "publicado" }, registry);
    expect(notFound.status).toBe(404);
  });

  it("remove um deck e limpa o conteúdo associado", async () => {
    const registry = fakeStore();
    const content = fakeStore();
    const backups = fakeStore();
    await handleAddDeck({ slug: "acme", titulo: "X" }, registry, content);
    await backups.setJSON("acme:index", [{ id: "1" }]);
    const res = await handleRemoveDeck("acme", registry, content, backups);
    expect(res.status).toBe(200);
    expect((await handleListRegistry(registry)).body.decks).toEqual([]);
    expect(await content.get("acme:base", { type: "json" })).toBeNull();
    expect(await backups.get("acme:index", { type: "json" })).toBeNull();
  });

  it("handleGetEntry retorna null se o slug não existir", async () => {
    const registry = fakeStore();
    expect(await handleGetEntry("ghost", registry)).toBeNull();
  });
});
