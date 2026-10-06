import { afterEach, describe, expect, it, vi } from "vitest";
import { sendChatMessage } from "../gemini";
afterEach(() => vi.unstubAllGlobals());
describe("contrato entregue ao navegador", () => {
  it("recusa text com tipo incorreto antes de renderizar", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: { cargo: "diretor" }, actions: [] }) }));
    await expect(sendChatMessage("Olá", [])).rejects.toThrow();
  });
  it("preserva fontes válidas e remove destinos inseguros recebidos", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ text: "Olá", actions: [], sources: [
      { id: "blog:a:0", title: "Artigo", url: "/blog/a" },
      { id: "unsafe", title: "Outro", url: "javascript:alert(1)" },
    ] }) }));
    expect((await sendChatMessage("Olá", [])).sources).toEqual([{ id: "blog:a:0", title: "Artigo", url: "/blog/a" }]);
  });
});
