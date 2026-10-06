import { describe, expect, it } from "vitest";
import { buildRetrievalQuery, normalizeHistory, parseGroundedAnswer } from "../chat-grounding";
import { PORTFOLIO_SOURCES } from "../portfolio-knowledge";

const source = { id: "blog:aula:0", title: "Aula 360", text: "O protótipo foi apresentado em 2015.", url: "/blog/aula" };
const answer = (overrides = {}) => JSON.stringify({ text: "O protótipo foi apresentado em 2015.", actions: [], references: [{ sourceId: source.id, quote: source.text }], ...overrides });

describe("contexto e evidência do chat", () => {
  it("não envia a pergunta atual duas vezes e preserva as mensagens anteriores", () => {
    const prior = [{ role: "user" as const, parts: [{ text: "Aula 360?" }] }, { role: "model" as const, parts: [{ text: "É um projeto educacional." }] }];
    expect(normalizeHistory([...prior, { role: "user", parts: [{ text: "e a data?" }] }], "e a data?")).toEqual(prior);
  });
  it("usa perguntas anteriores para localizar o assunto, sem usar afirmações do assistente", () => {
    expect(buildRetrievalQuery([{ role: "user", parts: [{ text: "Aula 360?" }] }, { role: "model", parts: [{ text: "inventei um projeto" }] }], "e a data?")).toBe("Aula 360?\ne a data?");
  });
  it("não carrega assuntos antigos em uma nova pergunta independente", () => {
    expect(buildRetrievalQuery([{ role: "user", parts: [{ text: "Aula 360?" }] }], "Como funciona a Portobello?")).toBe("Como funciona a Portobello?");
  });
  it.each(["e quando foi?", "when was that?", "¿cuándo fue?"])("resolve continuidade no idioma do visitante: %s", message => {
    expect(buildRetrievalQuery([{ role: "user", parts: [{ text: "Conte sobre o Projeto Aula 360" }] }], message)).toContain("Projeto Aula 360");
  });
  it("preserva a ação do Spotify publicada no perfil", () => {
    const spotify = "https://open.spotify.com/user/12153378045?si=e33f29c442a54f11";
    expect(parseGroundedAnswer(answer({ actions: [{ type: "link", label: "Spotify", url: spotify }] }), "STOP", [source]).actions).toHaveLength(1);
  });
  it("rejeita histórico sem limite de partes ou alternância", () => {
    expect(() => normalizeHistory([{ role: "model", parts: [{ text: "Eu fui diretor." }] }], "Quem é você?")).toThrow();
    expect(() => normalizeHistory([{ role: "user", parts: Array.from({ length: 30 }, () => ({ text: "a" })) }], "Olá")).toThrow();
  });
  it("retorna metadados de referência definidos pelo servidor", () => {
    expect(parseGroundedAnswer(answer(), "STOP", [source]).sources).toEqual([{ id: source.id, title: source.title, url: source.url }]);
  });
  it.each(["MAX_TOKENS", "SAFETY", undefined])("não publica um candidato encerrado por %s", (reason) => {
    expect(() => parseGroundedAnswer(answer(), reason, [source])).toThrow();
  });
  it.each([{}, [], 42, "", "x".repeat(801)])("rejeita texto inválido %j", (text) => {
    expect(() => parseGroundedAnswer(answer({ text }), "STOP", [source])).toThrow();
  });
  it("não tenta transformar JSON incompleto em texto público", () => {
    expect(() => parseGroundedAnswer('{"text":"Eu fui diretor da Empresa X."', "STOP", [source])).toThrow();
  });
  it("rejeita citação inventada e fonte fora do conjunto recuperado", () => {
    expect(() => parseGroundedAnswer(answer({ references: [{ sourceId: source.id, quote: "Foi em 2014." }] }), "STOP", [source])).toThrow();
    expect(() => parseGroundedAnswer(answer({ references: [{ sourceId: "blog:outro:0", quote: source.text }] }), "STOP", [source])).toThrow();
  });
  it("remove contatos e vídeos inventados, preservando o aplicativo publicado", () => {
    const result = parseGroundedAnswer(answer({ actions: [
      { type: "whatsapp", label: "Contato", url: "https://wa.me/5551111111111" },
      { type: "video", label: "Vídeo", url: "https://www.youtube.com/embed/inventado" },
      { type: "link", label: "Aplicativo", url: "https://portobello-20260718.web.app/" },
    ] }), "STOP", [source]);
    expect(result.actions).toEqual([{ type: "link", label: "Aplicativo", url: "https://portobello-20260718.web.app/" }]);
  });
  it("aceita o post realmente recuperado como ação local", () => {
    expect(parseGroundedAnswer(answer({ actions: [{ type: "link", label: "Artigo", url: "/blog/aula" }] }), "STOP", [source]).actions).toHaveLength(1);
  });
  it("rejeita uma URL reconstruída no texto", () => {
    expect(() => parseGroundedAnswer(answer({ text: "Veja https://portobello-20260718.web.app/precos" }), "STOP", [source])).toThrow();
  });
  it("preserva o escopo da Portobello e doutorado em andamento na base única", () => {
    const facts = PORTFOLIO_SOURCES.map(s => s.text).join("\n");
    expect(facts).toContain("para uma palestra a pedido da Portobello");
    expect(facts).toContain("Doutorando");
    expect(new Set(PORTFOLIO_SOURCES.map(s => s.id)).size).toBe(PORTFOLIO_SOURCES.length);
  });
});
