import { beforeEach, describe, expect, it, vi } from "vitest";
const lookup = vi.hoisted(() => vi.fn());
vi.mock("../_lib/chat-knowledge", () => ({ retrieveChatKnowledge: lookup }));
vi.mock("../_lib/ratelimit", () => ({ checkRateLimits: () => ({ ok: true }) }));
vi.mock("../_lib/blobs-context", () => ({ ensureBlobsContext: vi.fn() }));
import { handler } from "../chat-knowledge";
const call = (query: unknown, origin = "https://guiresende20.netlify.app") => handler({ httpMethod: "POST", headers: { origin }, body: JSON.stringify({ query }) } as never, {} as never, vi.fn());
beforeEach(() => { lookup.mockReset(); });
describe("endpoint de fontes para voz", () => {
  it("rejeita origem e query inválidas antes da busca", async () => {
    expect((await call("Aula", "https://outro.example"))?.statusCode).toBe(403);
    expect((await call({ unsafe: true }))?.statusCode).toBe(400);
    expect(lookup).not.toHaveBeenCalled();
  });
  it("retorna o estado explícito de indisponibilidade", async () => {
    lookup.mockResolvedValue({ status: "timeout", sources: [] });
    expect(JSON.parse((await call("Aula"))!.body!)).toEqual({ status: "timeout", sources: [] });
  });
});
