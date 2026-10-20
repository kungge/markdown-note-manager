import { describe, expect, it } from "vitest";
import { parseIgnorePatterns } from "./config.js";

describe("parseIgnorePatterns", () => {
  it("accepts comma and newline separated Git-style patterns", () => {
    expect(parseIgnorePatterns("archive/**, **/*.draft.md\n!important.draft.md\n")).toEqual([
      "archive/**",
      "**/*.draft.md",
      "!important.draft.md",
    ]);
  });
});
