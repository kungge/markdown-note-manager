import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./markdown.js";

describe("Markdown parsing", () => {
  it("prefers the front matter title and extracts tags and headings", () => {
    const source = `---
title: Front Matter Title
tags:
  - java
  - backend
---
# Body Title

## Details
`;
    const document = parseMarkdown("notes/example.md", source, source.length, new Date(0));
    expect(document.title).toBe("Front Matter Title");
    expect(document.tags).toEqual(["java", "backend"]);
    expect(document.headings.map((heading) => heading.text)).toEqual(["Body Title", "Details"]);
  });

  it("falls back to the file name when no heading exists", () => {
    const document = parseMarkdown("notes/中文文件.md", "plain text", 10, new Date(0));
    expect(document.title).toBe("中文文件");
  });
});
