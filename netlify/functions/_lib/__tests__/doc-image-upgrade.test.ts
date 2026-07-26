import { describe, it, expect } from "vitest";
import { upgradeDocImages } from "../doc-image-upgrade";

describe("upgradeDocImages", () => {
  it("replaces a single reference-style image definition in order", () => {
    const markdown = "texto\n\n![][image1]\n\n[image1]: <data:image/png;base64,LOWRES>";
    const result = upgradeDocImages(markdown, [{ dataUri: "data:image/jpeg;base64,HIGHRES" }]);
    expect(result).toBe("texto\n\n![][image1]\n\n[image1]: <data:image/jpeg;base64,HIGHRES>");
  });

  it("replaces multiple images matching document order", () => {
    const markdown =
      "![][image1]\n\n[image1]: <data:image/png;base64,LOW1>\n\n" +
      "![][image2]\n\n[image2]: <data:image/png;base64,LOW2>";
    const result = upgradeDocImages(markdown, [
      { dataUri: "data:image/jpeg;base64,HIGH1" },
      { dataUri: "data:image/jpeg;base64,HIGH2" },
    ]);
    expect(result).toContain("[image1]: <data:image/jpeg;base64,HIGH1>");
    expect(result).toContain("[image2]: <data:image/jpeg;base64,HIGH2>");
  });

  it("returns markdown unchanged when there are no images to upgrade", () => {
    const markdown = "texto sem imagem";
    expect(upgradeDocImages(markdown, [])).toBe(markdown);
  });

  it("returns markdown unchanged when counts mismatch (avoids swapping the wrong image)", () => {
    const markdown = "![][image1]\n\n[image1]: <data:image/png;base64,LOWRES>";
    const result = upgradeDocImages(markdown, [
      { dataUri: "data:image/jpeg;base64,HIGH1" },
      { dataUri: "data:image/jpeg;base64,HIGH2" },
    ]);
    expect(result).toBe(markdown);
  });

  it("works without angle brackets around the data URI", () => {
    const markdown = "[image1]: data:image/png;base64,LOWRES";
    const result = upgradeDocImages(markdown, [{ dataUri: "data:image/jpeg;base64,HIGHRES" }]);
    expect(result).toBe("[image1]: data:image/jpeg;base64,HIGHRES");
  });
});
