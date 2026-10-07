import { describe, expect, it } from "vitest";
import { createExportFileName, createStandaloneHtml } from "./export-utils";

describe("export utilities", () => {
  it("creates a file name that is valid on macOS and Windows", () => {
    expect(createExportFileName('K8s: Deployment / 回滚?*', "html"))
      .toBe("K8s- Deployment - 回滚--.html");
    expect(createExportFileName("   ", "pdf")).toBe("note.pdf");
  });

  it("creates a standalone document with escaped metadata and a linked outline", () => {
    const html = createStandaloneHtml({
      title: '吞吐量 < TPS & QPS >',
      path: '20-knowledge/性能&容量.md',
      articleHtml: '<article class="markdown-body"><h2 id="吞吐量关系">正文</h2></article>',
      headings: [{ level: 2, text: "吞吐量关系", slug: "吞吐量关系", line: 10 }],
      theme: "dark",
      exportedAt: new Date("2026-10-07T08:00:00.000Z"),
    });

    expect(html).toContain('<html lang="zh-CN" data-theme="dark">');
    expect(html).toContain("吞吐量 &lt; TPS &amp; QPS &gt;");
    expect(html).toContain("20-knowledge/性能&amp;容量.md");
    expect(html).toContain('<a href="#吞吐量关系">吞吐量关系</a>');
    expect(html).toContain('<article class="markdown-body">');
  });
});
