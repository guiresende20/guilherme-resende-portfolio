import { describe, it, expect, vi } from "vitest";
import { issueToken, verifyToken, checkPassword } from "../deck-auth-handlers.mjs";
import { hmacHex } from "../edit-key.mjs";

const SECRET = "test-secret";

describe("deck auth handlers", () => {
  it("checkPassword aceita a senha certa e rejeita a errada", () => {
    const hash = hmacHex("abrepalavra", SECRET);
    expect(checkPassword("abrepalavra", hash, SECRET)).toBe(true);
    expect(checkPassword("errada", hash, SECRET)).toBe(false);
    expect(checkPassword("", hash, SECRET)).toBe(false);
  });

  it("issueToken gera um token que verifyToken aceita para o slug certo", () => {
    const token = issueToken("acme", SECRET);
    expect(verifyToken("acme", token, SECRET)).toBe(true);
    expect(verifyToken("globex", token, SECRET)).toBe(false);
    expect(verifyToken("acme", token, "outro-secret")).toBe(false);
  });

  it("verifyToken rejeita token expirado", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = issueToken("acme", SECRET);
    vi.setSystemTime(new Date("2026-01-02T01:00:00Z")); // +25h, TTL é 24h
    expect(verifyToken("acme", token, SECRET)).toBe(false);
    vi.useRealTimers();
  });

  it("verifyToken rejeita token malformado ou ausente", () => {
    expect(verifyToken("acme", "", SECRET)).toBe(false);
    expect(verifyToken("acme", "lixo-sem-ponto", SECRET)).toBe(false);
    expect(verifyToken("acme", null, SECRET)).toBe(false);
  });
});
