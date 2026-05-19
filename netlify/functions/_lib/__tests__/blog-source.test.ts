import { describe, it, expect, vi, beforeEach } from "vitest";
import { isBlogPostSource, fetchAndParse } from "../blog-source";
import type { DriveFile } from "../drive";

vi.mock("../drive", () => {
  return {
    downloadText: vi.fn(),
    exportDocAsMarkdown: vi.fn(),
  };
});

import { downloadText, exportDocAsMarkdown } from "../drive";

function file(partial: Partial<DriveFile>): DriveFile {
  return {
    id: "id",
    name: "name",
    mimeType: "application/octet-stream",
    modifiedTime: "2026-01-01T00:00:00Z",
    createdTime: "2026-01-01T00:00:00Z",
    ...partial,
  };
}

describe("isBlogPostSource", () => {
  it("accepts .md by extension", () => {
    expect(isBlogPostSource(file({ name: "foo.md", mimeType: "application/octet-stream" }))).toBe(true);
  });

  it("accepts .MD (uppercase) by extension", () => {
    expect(isBlogPostSource(file({ name: "foo.MD" }))).toBe(true);
  });

  it("accepts text/markdown mimeType", () => {
    expect(isBlogPostSource(file({ name: "no-ext", mimeType: "text/markdown" }))).toBe(true);
  });

  it("accepts Google Doc mimeType", () => {
    expect(
      isBlogPostSource(file({ name: "Pensando em X", mimeType: "application/vnd.google-apps.document" }))
    ).toBe(true);
  });

  it("rejects folder mimeType", () => {
    expect(
      isBlogPostSource(file({ name: "drafts", mimeType: "application/vnd.google-apps.folder" }))
    ).toBe(false);
  });

  it("rejects image mimeType", () => {
    expect(isBlogPostSource(file({ name: "foo.jpg", mimeType: "image/jpeg" }))).toBe(false);
  });

  it("rejects .txt", () => {
    expect(isBlogPostSource(file({ name: "foo.txt", mimeType: "text/plain" }))).toBe(false);
  });

  it("rejects unknown mimeType without .md extension", () => {
    expect(isBlogPostSource(file({ name: "foo", mimeType: "application/octet-stream" }))).toBe(false);
  });
});

describe("fetchAndParse", () => {
  beforeEach(() => {
    vi.mocked(downloadText).mockReset();
    vi.mocked(exportDocAsMarkdown).mockReset();
  });

  it("uses downloadText + parsePost for .md files", async () => {
    vi.mocked(downloadText).mockResolvedValue(
      "---\ntitle: From MD\ndate: 2026-01-15\ntags: [a]\n---\n\nCorpo do MD."
    );
    const f = file({ id: "md-id", name: "foo.md", mimeType: "text/markdown" });

    const parsed = await fetchAndParse(f);

    expect(vi.mocked(downloadText)).toHaveBeenCalledWith("md-id");
    expect(vi.mocked(exportDocAsMarkdown)).not.toHaveBeenCalled();
    expect(parsed.meta.title).toBe("From MD");
    expect(parsed.meta.tags).toEqual(["a"]);
  });

  it("uses exportDocAsMarkdown + parseDocPost for Google Docs", async () => {
    vi.mocked(exportDocAsMarkdown).mockResolvedValue(
      "Tags: ia, blog\n\nCorpo do Doc."
    );
    const f = file({
      id: "doc-id",
      name: "Pensando em design",
      mimeType: "application/vnd.google-apps.document",
      createdTime: "2026-05-18T10:30:00Z",
    });

    const parsed = await fetchAndParse(f);

    expect(vi.mocked(exportDocAsMarkdown)).toHaveBeenCalledWith("doc-id");
    expect(vi.mocked(downloadText)).not.toHaveBeenCalled();
    expect(parsed.meta.title).toBe("Pensando em design");
    expect(parsed.meta.slug).toBe("pensando-em-design");
    expect(parsed.meta.date).toBe("2026-05-18");
    expect(parsed.meta.tags).toEqual(["ia", "blog"]);
    expect(parsed.body).toBe("Corpo do Doc.");
  });

  it("propagates errors from downloadText", async () => {
    vi.mocked(downloadText).mockRejectedValue(new Error("404 not found"));
    const f = file({ id: "x", name: "foo.md", mimeType: "text/markdown" });
    await expect(fetchAndParse(f)).rejects.toThrow("404 not found");
  });

  it("propagates errors from exportDocAsMarkdown", async () => {
    vi.mocked(exportDocAsMarkdown).mockRejectedValue(new Error("429 quota"));
    const f = file({ id: "x", name: "Doc", mimeType: "application/vnd.google-apps.document" });
    await expect(fetchAndParse(f)).rejects.toThrow("429 quota");
  });
});
