import { describe, it, expect } from "vitest";
import { isValidEditKey } from "../portobello-edit-key.mjs";

describe("isValidEditKey", () => {
  it("aceita quando a chave bate com a env", () => {
    expect(isValidEditKey("s3gr3do", "s3gr3do")).toBe(true);
  });
  it("rejeita chave errada, ausente ou não-string", () => {
    expect(isValidEditKey("errada", "s3gr3do")).toBe(false);
    expect(isValidEditKey(undefined, "s3gr3do")).toBe(false);
    expect(isValidEditKey(123 as unknown as string, "s3gr3do")).toBe(false);
  });
  it("rejeita TUDO quando a env não está configurada (fail closed)", () => {
    expect(isValidEditKey("qualquer", undefined)).toBe(false);
    expect(isValidEditKey("", "")).toBe(false);
  });
});
