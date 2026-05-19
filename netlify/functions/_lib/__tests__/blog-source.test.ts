import { describe, it, expect } from "vitest";
import { isBlogPostSource } from "../blog-source";
import type { DriveFile } from "../drive";

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
