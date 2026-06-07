import { describe, it, expect } from "vitest";
import { validateSubmitPayload } from "../aerolito-submit";

describe("validateSubmitPayload", () => {
  const validPayload = {
    session_id: "550e8400-e29b-41d4-a716-446655440000",
    question_idx: 1,
    question_text: "Q?",
    answer_text: "A.",
  };

  it("accepts valid payload", () => {
    expect(validateSubmitPayload(validPayload)).toEqual(validPayload);
  });

  it("rejects null/non-object", () => {
    expect(validateSubmitPayload(null)).toBeNull();
    expect(validateSubmitPayload("x")).toBeNull();
  });

  it("rejects invalid session_id (not UUID)", () => {
    expect(validateSubmitPayload({ ...validPayload, session_id: "not-uuid" })).toBeNull();
  });

  it("rejects question_idx out of [1..5]", () => {
    expect(validateSubmitPayload({ ...validPayload, question_idx: 0 })).toBeNull();
    expect(validateSubmitPayload({ ...validPayload, question_idx: 6 })).toBeNull();
    expect(validateSubmitPayload({ ...validPayload, question_idx: "1" })).toBeNull();
  });

  it("rejects empty question/answer texts", () => {
    expect(validateSubmitPayload({ ...validPayload, question_text: "" })).toBeNull();
    expect(validateSubmitPayload({ ...validPayload, answer_text: "" })).toBeNull();
  });

  it("rejects question_text > 300 chars", () => {
    expect(validateSubmitPayload({ ...validPayload, question_text: "x".repeat(301) })).toBeNull();
  });

  it("rejects answer_text > 2000 chars", () => {
    expect(validateSubmitPayload({ ...validPayload, answer_text: "x".repeat(2001) })).toBeNull();
  });

  it("trims whitespace from texts", () => {
    const result = validateSubmitPayload({ ...validPayload, answer_text: "  hi  " });
    expect(result?.answer_text).toBe("hi");
  });
});
