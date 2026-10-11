import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ callbacks: [] as any[], translation: { t: (key: string) => key } }));
vi.mock("react-i18next", () => ({ useTranslation: () => state.translation }));
vi.mock("../../lib/gemini-live", () => ({ GeminiLiveChat: class {
  constructor(_token: string, private cb: any) { state.callbacks.push(cb); }
  async start() { this.cb.onStatusChange("connected"); }
  stop() { this.cb.onStatusChange("disconnected"); }
} }));
import ChatWidget from "../ChatWidget";
import { normalizeHistory } from "../../lib/chat-grounding";
afterEach(() => { vi.unstubAllGlobals(); state.callbacks = []; });
it("mostra a mensagem útil do servidor quando a resposta é indisponível", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: "Não consegui responder com segurança agora. Tente novamente em instantes." }) }));
  Element.prototype.scrollIntoView = vi.fn();
  render(<ChatWidget />);
  act(() => window.dispatchEvent(new Event("open-chat")));
  fireEvent.change(screen.getByPlaceholderText("chat.placeholder"), { target: { value: "Último post?" } });
  fireEvent.keyDown(screen.getByPlaceholderText("chat.placeholder"), { key: "Enter" });
  await waitFor(() => expect(screen.getByText("Não consegui responder com segurança agora. Tente novamente em instantes.")).toBeInTheDocument());
});
it("mantém a pergunta que falhou para dar contexto à mensagem seguinte", async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({ error: "Não consegui responder com segurança agora. Tente novamente em instantes." }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ text: "A resposta anterior falhou.", actions: [], sources: [] }) });
  vi.stubGlobal("fetch", fetch);
  Element.prototype.scrollIntoView = vi.fn();
  render(<ChatWidget />);
  act(() => window.dispatchEvent(new Event("open-chat")));
  const input = screen.getByPlaceholderText("chat.placeholder");
  fireEvent.change(input, { target: { value: "lista os meus posts e os titulos deles" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await screen.findByText("Não consegui responder com segurança agora. Tente novamente em instantes.");
  fireEvent.change(input, { target: { value: "pq nao conseguiu ?" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await screen.findByText("A resposta anterior falhou.");
  const body = JSON.parse(fetch.mock.calls[1][1].body);
  expect(body.history).toEqual([{ role: "user", parts: [{ text: "lista os meus posts e os titulos deles" }] }, { role: "model", parts: [{ text: "Não consegui responder com segurança agora. Tente novamente em instantes." }] }]);
});
it("não deixa uma pergunta longa rejeitada bloquear as mensagens seguintes", async () => {
  const fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: "Mensagem ou histórico inválido" }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ text: "Olá!", actions: [], sources: [] }) });
  vi.stubGlobal("fetch", fetch);
  Element.prototype.scrollIntoView = vi.fn();
  render(<ChatWidget />);
  act(() => window.dispatchEvent(new Event("open-chat")));
  const input = screen.getByPlaceholderText("chat.placeholder");
  fireEvent.change(input, { target: { value: "x".repeat(4001) } });
  fireEvent.keyDown(input, { key: "Enter" });
  await screen.findByText("Mensagem ou histórico inválido");
  fireEvent.change(input, { target: { value: "Olá" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await screen.findByText("Olá!");
  const body = JSON.parse(fetch.mock.calls[1][1].body);
  expect(() => normalizeHistory(body.history, "Olá")).not.toThrow();
});
it("nova sessão de voz cria outro balão e ignora callbacks da sessão anterior", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: "test", systemPrompt: "prompt" }) }));
  Element.prototype.scrollIntoView = vi.fn();
  render(<ChatWidget />);
  act(() => window.dispatchEvent(new Event("open-chat")));
  fireEvent.click(screen.getByTitle("chat.btn_audio_on"));
  await waitFor(() => expect(state.callbacks).toHaveLength(1));
  act(() => { state.callbacks[0].onSources([{ id: "a", title: "Fonte antiga", url: "/blog/a" }]); state.callbacks[0].onTextAction("Resposta antiga."); });
  fireEvent.click(screen.getByTitle("chat.btn_audio_off"));
  fireEvent.click(screen.getByTitle("chat.btn_audio_on"));
  await waitFor(() => expect(state.callbacks).toHaveLength(2));
  act(() => { state.callbacks[0].onTextAction("Texto atrasado."); state.callbacks[1].onTextAction("Nova resposta."); });
  expect(screen.getByText("Nova resposta.", { exact: true })).toBeInTheDocument();
  expect(screen.getByText("Resposta antiga.", { exact: true })).toBeInTheDocument();
  expect(screen.queryByText(/Texto atrasado/)).not.toBeInTheDocument();
});
