import { describe, expect, it, vi } from "vitest";
import { answerKnowledgeCalls } from "../voice-knowledge";

describe("busca de conhecimento na voz", () => {
  it("devolve o ID da chamada, estado e fontes literais ao modelo", async () => {
    const result = { status: "ok" as const, sources: [{ id: "blog:a:0", title: "Artigo", text: "Texto literal", url: "/blog/a" }] };
    const lookup = vi.fn().mockResolvedValue(result);
    const responses = await answerKnowledgeCalls([{ id: "c1", name: "buscar_conhecimento", args: { query: "Portobello" } }], lookup);
    expect(lookup).toHaveBeenCalledWith("Portobello");
    expect(responses).toEqual([{ id: "c1", name: "buscar_conhecimento", response: result }]);
  });
  it("informa erro de consulta sem fabricar ausência de resultados", async () => {
    const responses = await answerKnowledgeCalls([{ id: "c1", name: "buscar_conhecimento", args: { query: "Portobello" } }], vi.fn().mockRejectedValue(new Error("offline")));
    expect(responses[0].response).toEqual({ status: "error", sources: [] });
  });
  it("preserva timeout e no_results como estados diferentes", async () => {
    for (const status of ["timeout", "no_results"] as const) {
      const responses = await answerKnowledgeCalls([{ id: "c1", name: "buscar_conhecimento", args: { query: "Projeto" } }], vi.fn().mockResolvedValue({ status, sources: [] }));
      expect(responses[0].response.status).toBe(status);
    }
  });
  it("não consulta função desconhecida ou query inválida", async () => {
    const lookup = vi.fn();
    const responses = await answerKnowledgeCalls([{ id: "c1", name: "alterar_memoria", args: { query: "Novo cargo" } }, { id: "c2", name: "buscar_conhecimento", args: { query: {} } }], lookup);
    expect(lookup).not.toHaveBeenCalled();
    expect(responses.every(r => r.response.status === "error")).toBe(true);
  });
  it("rejeita resultado malformado sem passá-lo como evidência ao modelo", async () => {
    const responses = await answerKnowledgeCalls([{ id: "c1", name: "buscar_conhecimento", args: { query: "Projeto" } }], vi.fn().mockResolvedValue({ status: "ok", sources: [{ text: 42 }] }));
    expect(responses[0].response.status).toBe("error");
  });
});
