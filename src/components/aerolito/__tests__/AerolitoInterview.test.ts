import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInterviewController } from "../AerolitoInterview";
import { AEROLITO_QUESTIONS } from "../QUESTIONS";

describe("createInterviewController", () => {
  let mockSay: ReturnType<typeof vi.fn>;
  let mockSubmit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSay = vi.fn();
    mockSubmit = vi.fn().mockResolvedValue(undefined);
  });

  it("starts at step 1 with a sessionId after start()", () => {
    const ctrl = createInterviewController({ sayFixed: mockSay, submitAnswer: mockSubmit });
    expect(ctrl.getStep()).toBe(0);
    ctrl.start();
    expect(ctrl.getStep()).toBe(1);
    expect(ctrl.getSessionId()).toMatch(/^[0-9a-f-]{36}$/i);
    expect(mockSay).toHaveBeenCalledWith(AEROLITO_QUESTIONS[0]);
  });

  it("advances to next question after onAnswer", async () => {
    const ctrl = createInterviewController({ sayFixed: mockSay, submitAnswer: mockSubmit });
    ctrl.start();
    await ctrl.onAnswer("primeira resposta");
    expect(mockSubmit).toHaveBeenCalledWith({
      session_id: ctrl.getSessionId(),
      question_idx: 1,
      question_text: AEROLITO_QUESTIONS[0],
      answer_text: "primeira resposta",
    });
    expect(ctrl.getStep()).toBe(2);
    expect(mockSay).toHaveBeenLastCalledWith(AEROLITO_QUESTIONS[1]);
  });

  it("transitions to 'done' after the 5th answer", async () => {
    const ctrl = createInterviewController({ sayFixed: mockSay, submitAnswer: mockSubmit });
    ctrl.start();
    for (let i = 0; i < 5; i++) {
      await ctrl.onAnswer(`r${i}`);
    }
    expect(ctrl.getStep()).toBe("done");
    expect(mockSubmit).toHaveBeenCalledTimes(5);
  });

  it("ignores onAnswer after done", async () => {
    const ctrl = createInterviewController({ sayFixed: mockSay, submitAnswer: mockSubmit });
    ctrl.start();
    for (let i = 0; i < 5; i++) await ctrl.onAnswer(`r${i}`);
    await ctrl.onAnswer("extra");
    expect(mockSubmit).toHaveBeenCalledTimes(5);
  });

  it("retries submit once on transient failure (network)", async () => {
    let calls = 0;
    mockSubmit = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) return Promise.reject(new Error("network"));
      return Promise.resolve();
    });
    const ctrl = createInterviewController({ sayFixed: mockSay, submitAnswer: mockSubmit });
    ctrl.start();
    await ctrl.onAnswer("ok");
    expect(mockSubmit).toHaveBeenCalledTimes(2);
  });
});
