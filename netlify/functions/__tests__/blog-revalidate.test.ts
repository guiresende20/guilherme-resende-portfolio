import { describe, it, expect } from "vitest";
import { keysToInvalidateForSlug } from "../blog-revalidate";

describe("keysToInvalidateForSlug", () => {
  it("includes the list, the post, the chatbot summary, and both title-translation caches", () => {
    expect(keysToInvalidateForSlug("meu-post")).toEqual([
      "posts/list",
      "posts/meu-post",
      "posts/prompt-summary",
      "posts/list/translation/en",
      "posts/list/translation/es",
    ]);
  });
});
