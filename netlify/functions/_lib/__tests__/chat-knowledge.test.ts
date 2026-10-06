import { afterEach, expect, it, vi } from "vitest";
const retrieve = vi.hoisted(() => vi.fn());
vi.mock("../rag", () => ({ retrieveKnowledge: retrieve }));
import { retrieveChatKnowledge } from "../chat-knowledge";
afterEach(() => { vi.useRealTimers(); retrieve.mockReset(); });
it("encerra a espera com timeout e aborta a recuperação pendente", async () => {
  vi.useFakeTimers();
  retrieve.mockReturnValue(new Promise(() => {}));
  const response = retrieveChatKnowledge("Aula", 10);
  await vi.advanceTimersByTimeAsync(11);
  expect(await response).toEqual({ status: "timeout", sources: [] });
  expect(retrieve.mock.calls[0][1]?.aborted).toBe(true);
});
