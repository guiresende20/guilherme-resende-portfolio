import { expect, it } from "vitest";
import { parseCatalogPlan } from "../catalog-planner";

const plan = { kind: "query", collection: "blog", operation: "count", order: "newest", locale: "pt", from: "2026-06-01", to: "2026-06-30", text: "IA", tag: "", clarification: "", limit: 3, offset: 0 };
it("converte uma intenção estruturada em filtros validados", () => {
  expect(parseCatalogPlan(JSON.stringify(plan))).toEqual({ kind: "query", query: { collection: "blog", operation: "count", order: "newest", locale: "pt", from: "2026-06-01", to: "2026-06-30", text: "IA", limit: 3, offset: 0 } });
});
it.each([{ collection: "secrets" }, { operation: "delete" }, { from: "2026-02-30" }, { limit: 0 }, { text: { sql: "DELETE" } }])("recusa parâmetros gerados inválidos: %j", fields => {
  expect(() => parseCatalogPlan(JSON.stringify({ ...plan, ...fields }))).toThrow();
});
it("preserva um pedido de esclarecimento sem executar a consulta", () => {
  expect(parseCatalogPlan(JSON.stringify({ ...plan, kind: "clarify", clarification: "Qual ano?" }))).toEqual({ kind: "clarify", text: "Qual ano?" });
});
it("retorna perguntas de conteúdo ao fluxo de respostas com evidências", () => {
  expect(parseCatalogPlan('{"kind":"content"}')).toEqual({ kind: "content" });
});
