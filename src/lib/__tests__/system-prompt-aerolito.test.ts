import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT_AEROLITO } from "../system-prompt-aerolito";

describe("SYSTEM_PROMPT_AEROLITO", () => {
  it("contains required Aerolito-specific blocks", () => {
    expect(SYSTEM_PROMPT_AEROLITO).toContain("## CONTEXTO AEROLITO");
    expect(SYSTEM_PROMPT_AEROLITO).toContain("## HEAD DE PESQUISA — VISÃO");
  });

  it("inherits base identity blocks from the original system prompt", () => {
    expect(SYSTEM_PROMPT_AEROLITO).toContain("Guilherme Resende Muniz");
    expect(SYSTEM_PROMPT_AEROLITO).toContain("## IDENTIDADE");
    expect(SYSTEM_PROMPT_AEROLITO).toContain("## FIT CULTURAL");
    expect(SYSTEM_PROMPT_AEROLITO).toContain("## EXPERIÊNCIA PROFISSIONAL");
  });

  it("enforces Portuguese-only response policy", () => {
    expect(SYSTEM_PROMPT_AEROLITO).toMatch(/Responda sempre em portugu/i);
    expect(SYSTEM_PROMPT_AEROLITO).not.toMatch(/detecte o idioma/i);
  });

  it("uses 300 char limit (shorter than base 450, voice is tiring)", () => {
    expect(SYSTEM_PROMPT_AEROLITO).toMatch(/no máximo 300 caracteres|máximo 300 caracteres/i);
  });

  it("includes rule referencing the new blocks for relevant questions", () => {
    expect(SYSTEM_PROMPT_AEROLITO).toMatch(/CONTEXTO AEROLITO.*HEAD DE PESQUISA/s);
  });
});
