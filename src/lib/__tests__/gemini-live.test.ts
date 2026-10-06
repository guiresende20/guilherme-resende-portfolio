import { afterEach, describe, expect, it, vi } from "vitest";
import { GeminiLiveChat } from "../gemini-live";

class Socket {
  static OPEN = 1; static all: Socket[] = [];
  readyState = 1; onopen?: () => void; onmessage?: (event: { data: string | Blob }) => Promise<void>;
  send = vi.fn(); close = () => { this.readyState = 3; };
  constructor() { Socket.all.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); Socket.all = []; });
describe("sessão Live e ferramenta de conhecimento", () => {
  it("ignora um Blob antigo lido depois de uma reconexão", async () => {
    vi.stubGlobal("WebSocket", Socket);
    vi.stubGlobal("AudioContext", class { state = "closed"; close() {} });
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "no_results", sources: [] }) });
    vi.stubGlobal("fetch", fetcher);
    let release!: (text: string) => void;
    class DelayedBlob extends Blob { text() { return new Promise<string>(r => { release = r; }); } }
    const live = new GeminiLiveChat("test-token", { onStatusChange: vi.fn() }, "prompt");
    await live.start();
    const waiting = Socket.all[0].onmessage!({ data: new DelayedBlob() });
    live.stop(); await live.start();
    release(JSON.stringify({ toolCall: { functionCalls: [{ id: "old", name: "buscar_conhecimento", args: { query: "Aula" } }] } }));
    await waiting;
    expect(fetcher).not.toHaveBeenCalled();
    expect(Socket.all[1].send).not.toHaveBeenCalled();
    live.stop();
  });
  it("não envia resultado de uma sessão encerrada para uma conexão nova", async () => {
    vi.stubGlobal("WebSocket", Socket);
    vi.stubGlobal("AudioContext", class { state = "closed"; close() {} });
    let resolve!: (value: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise(r => { resolve = r; })));
    const live = new GeminiLiveChat("test-token", { onStatusChange: vi.fn(), onTextAction: vi.fn() }, "prompt");
    await live.start();
    Socket.all[0].onopen?.();
    const waiting = Socket.all[0].onmessage!({ data: JSON.stringify({ toolCall: { functionCalls: [{ id: "old", name: "buscar_conhecimento", args: { query: "Aula" } }] } }) });
    expect(resolve).toBeTypeOf("function");
    live.stop();
    await live.start();
    Socket.all[1].onopen?.();
    resolve({ ok: true, json: async () => ({ status: "no_results", sources: [] }) });
    await waiting;
    expect(Socket.all[1].send.mock.calls.map(c => JSON.parse(c[0])).some(c => c.toolResponse)).toBe(false);
    live.stop();
  });
});
