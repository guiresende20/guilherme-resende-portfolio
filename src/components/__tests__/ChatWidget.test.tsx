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
afterEach(() => { vi.unstubAllGlobals(); state.callbacks = []; });
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
  expect(screen.getAllByRole("link", { name: "Fonte antiga" })).toHaveLength(1);
});
