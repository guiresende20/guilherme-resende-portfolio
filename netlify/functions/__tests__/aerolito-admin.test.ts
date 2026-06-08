import { describe, it, expect, beforeEach } from "vitest";
import { isAuthorized, validateBulletsPayload } from "../aerolito-admin";

describe("isAuthorized", () => {
  beforeEach(() => {
    process.env.AEROLITO_ADMIN_TOKEN = "secret-test-token";
  });

  it("accepts valid Bearer token", () => {
    expect(isAuthorized("Bearer secret-test-token")).toBe(true);
  });

  it("rejects missing header", () => {
    expect(isAuthorized(undefined)).toBe(false);
    expect(isAuthorized("")).toBe(false);
  });

  it("rejects wrong scheme", () => {
    expect(isAuthorized("Basic secret-test-token")).toBe(false);
  });

  it("rejects wrong token", () => {
    expect(isAuthorized("Bearer wrong-token")).toBe(false);
  });

  it("rejects when env var is missing", () => {
    delete process.env.AEROLITO_ADMIN_TOKEN;
    expect(isAuthorized("Bearer anything")).toBe(false);
  });
});

describe("validateBulletsPayload", () => {
  it("accepts 4-6 bullets within length limits", () => {
    const bullets = ["a", "b", "c", "d"];
    expect(validateBulletsPayload({ bullets })).toEqual(bullets);
  });

  it("rejects non-object", () => {
    expect(validateBulletsPayload(null)).toBeNull();
  });

  it("rejects too few bullets", () => {
    expect(validateBulletsPayload({ bullets: ["a", "b", "c"] })).toBeNull();
  });

  it("rejects too many bullets", () => {
    expect(validateBulletsPayload({ bullets: ["a","b","c","d","e","f","g"] })).toBeNull();
  });

  it("rejects bullets longer than 200 chars", () => {
    expect(validateBulletsPayload({ bullets: ["a", "b", "c", "x".repeat(201)] })).toBeNull();
  });

  it("rejects non-string bullet", () => {
    expect(validateBulletsPayload({ bullets: ["a", "b", "c", 42] })).toBeNull();
  });

  it("rejects empty bullet", () => {
    expect(validateBulletsPayload({ bullets: ["a", "b", "c", "  "] })).toBeNull();
  });

  it("trims each bullet", () => {
    const result = validateBulletsPayload({ bullets: ["  a  ", "b", "c", "d"] });
    expect(result?.[0]).toBe("a");
  });
});
