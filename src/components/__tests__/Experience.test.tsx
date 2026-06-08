import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Experience from "../Experience";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: unknown) => {
      const map: Record<string, unknown> = {
        "experience.header_label": "Experiência profissional",
        "experience.header_title": "Trajetória",
        "experience.header_outline": "profissional",
        "experience.jobs": [
          { role: "Designer", type: "Atual", org: "CriaLab", period: "2021 - presente", loc: "POA", items: ["i1"] },
        ],
        "experience.aerolito.role": "Head de Pesquisa",
        "experience.aerolito.type": "Profissional",
        "experience.aerolito.period": "JUN 2026 — presente",
        "experience.aerolito.loc": "Porto Alegre, RS",
        "experience.aerolito.bullets_disclaimer": "",
      };
      const v = map[key];
      if (opts && typeof opts === "object" && "returnObjects" in (opts as object)) return v;
      return v ?? key;
    },
  }),
}));

vi.mock("../Reveal", () => ({ default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("../SectionHeader", () => ({ default: () => null }));

describe("Experience — Aerolito card", () => {
  let originalFetch: typeof globalThis.fetch;
  beforeEach(() => { originalFetch = globalThis.fetch; });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("does not render Aerolito card when bullets=null", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ bullets: null }),
    }) as unknown as typeof fetch;

    render(<Experience />);
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    expect(screen.queryByText("Head de Pesquisa")).toBeNull();
    expect(screen.getByText("Designer")).toBeInTheDocument();
  });

  it("renders Aerolito card as first job when bullets exist", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ bullets: ["Atrib 1", "Atrib 2"], published_at: "2026-06-10T12:00:00Z" }),
    }) as unknown as typeof fetch;

    render(<Experience />);
    await waitFor(() => expect(screen.getByText("Head de Pesquisa")).toBeInTheDocument());
    expect(screen.getByText("Atrib 1")).toBeInTheDocument();
    expect(screen.getByText("Atrib 2")).toBeInTheDocument();
  });
});
