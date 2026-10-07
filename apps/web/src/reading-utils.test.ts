import { describe, expect, it } from "vitest";
import { buildDocumentUrl, slugifyHeading } from "./reading-utils";

describe("reading URL helpers", () => {
  it("creates stable Chinese heading anchors", () => {
    expect(slugifyHeading("吞吐量关系（TPS）")).toBe("吞吐量关系tps");
  });

  it("builds a shareable document and heading URL", () => {
    const result = buildDocumentUrl(
      "20-knowledge/性能测试.md",
      "吞吐量关系",
      "http://127.0.0.1:5173/",
    );
    const url = new URL(result);
    expect(url.searchParams.get("path")).toBe("20-knowledge/性能测试.md");
    expect(decodeURIComponent(url.hash.slice(1))).toBe("吞吐量关系");
  });
});
