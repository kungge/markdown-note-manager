import type { Heading } from "./types";

export type ExportTheme = "light" | "dark";

interface StandaloneDocumentOptions {
  title: string;
  path: string;
  articleHtml: string;
  headings: Heading[];
  theme: ExportTheme;
  exportedAt?: Date;
}

export interface PreparedExport {
  html: string;
  fileName: string;
  unembeddedImages: number;
}

const EXPORT_STYLES = `
:root { color-scheme: light; --ink:#17201b; --muted:#657168; --line:#dfe5df; --soft:#f5f8f5; --accent:#1f6c4a; --code:#111b16; --code-ink:#e7efe9; }
:root[data-theme="dark"] { color-scheme:dark; --ink:#dce5df; --muted:#93a299; --line:#334038; --soft:#19221c; --accent:#79c99e; --code:#0e1511; --code-ink:#d9e5dd; }
* { box-sizing:border-box; }
html { scroll-behavior:smooth; }
body { max-width:980px; margin:0 auto; padding:48px 52px 96px; color:var(--ink); background:#fff; font:17px/1.82 Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif; text-rendering:optimizeLegibility; }
:root[data-theme="dark"] body { background:#151c17; }
.export-meta { margin-bottom:32px; padding-bottom:14px; border-bottom:1px solid var(--line); color:var(--muted); font-size:12px; }
.export-meta strong,.export-meta span { display:block; }
.export-meta strong { margin-bottom:4px; color:var(--accent); font-size:13px; }
.export-toc { margin:0 0 46px; padding:20px 24px; border:1px solid var(--line); border-radius:10px; background:var(--soft); break-inside:avoid; }
.export-toc h2 { margin:0 0 10px; padding:0; border:0; font-size:18px; }
.export-toc ol { margin:0; padding:0; list-style:none; columns:2; column-gap:28px; }
.export-toc li { overflow:hidden; margin:5px 0; text-overflow:ellipsis; white-space:nowrap; break-inside:avoid; }
.export-toc li.level-3 { padding-left:14px; font-size:0.92em; }
.export-toc li.level-4 { padding-left:28px; font-size:0.86em; }
.export-toc a { color:var(--muted); text-decoration:none; }
.export-toc a:hover { color:var(--accent); text-decoration:underline; }
.markdown-body { width:100%; margin:0; padding:0; color:var(--ink); }
.markdown-body h1,.markdown-body h2,.markdown-body h3,.markdown-body h4,.markdown-body h5,.markdown-body h6 { color:var(--ink); line-height:1.34; letter-spacing:-0.018em; scroll-margin-top:20px; break-after:avoid; }
.markdown-body h1 { margin:0 0 1.2em; font-size:40px; font-weight:790; line-height:1.2; }
.markdown-body h2 { margin:2.45em 0 .85em; padding:0 0 .38em 12px; border-bottom:1px solid var(--line); border-left:4px solid var(--accent); font-size:29px; font-weight:760; }
.markdown-body h3 { margin:2em 0 .7em; font-size:23px; font-weight:730; }
.markdown-body h4 { margin:1.7em 0 .6em; font-size:19px; font-weight:700; }
.markdown-body h5,.markdown-body h6 { margin:1.5em 0 .55em; font-size:16px; font-weight:700; }
.markdown-body p { margin:.82em 0 1.08em; }
.markdown-body li + li { margin-top:.25em; }
.markdown-body a { color:var(--accent); text-underline-offset:3px; }
.markdown-body img { display:block; max-width:100%; height:auto; margin:24px auto; border-radius:8px; box-shadow:0 4px 18px rgba(22,32,27,.1); break-inside:avoid; }
.markdown-body table { width:100%; margin:18px 0; border-collapse:collapse; font-size:.92em; break-inside:auto; }
.markdown-body tr { break-inside:avoid; }
.markdown-body th,.markdown-body td { padding:7px 10px; border:1px solid var(--line); text-align:left; vertical-align:top; }
.markdown-body th { background:var(--soft); }
.markdown-body blockquote { margin-left:0; padding:4px 18px; border-left:4px solid #95bba5; color:var(--muted); background:var(--soft); }
.markdown-body pre { overflow:auto; padding:16px; border-radius:9px; color:var(--code-ink); background:var(--code); font:13px/1.58 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; white-space:pre-wrap; overflow-wrap:anywhere; break-inside:avoid; }
.markdown-body :not(pre)>code { padding:2px 5px; border-radius:4px; color:#9d3150; background:#edf2ee; font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; }
:root[data-theme="dark"] .markdown-body :not(pre)>code { color:#f097ad; background:#263129; }
.anchored-heading { display:block; }
.mermaid-block { overflow:hidden; padding:12px; text-align:center; break-inside:avoid; }
.mermaid-block svg { max-width:100%; height:auto; }
.hljs-comment,.hljs-quote { color:#8b949e; }.hljs-keyword,.hljs-selector-tag,.hljs-literal { color:#ff7b72; }.hljs-string,.hljs-title,.hljs-section { color:#a5d6ff; }.hljs-number,.hljs-symbol,.hljs-bullet { color:#79c0ff; }.hljs-built_in,.hljs-type { color:#ffa657; }.hljs-attr,.hljs-variable,.hljs-template-variable { color:#d2a8ff; }
@page { size:A4; margin:16mm 17mm 18mm; }
@media print {
  :root,:root[data-theme="dark"] { color-scheme:light; --ink:#111; --muted:#555; --line:#d8d8d8; --soft:#f6f6f6; --accent:#1f6c4a; --code:#f3f4f3; --code-ink:#111; }
  body,:root[data-theme="dark"] body { max-width:none; padding:0; background:#fff; font-size:10.5pt; line-height:1.62; print-color-adjust:exact; -webkit-print-color-adjust:exact; }
  .export-meta { margin-bottom:20px; }
  .export-toc { margin-bottom:30px; }
  .markdown-body h1 { font-size:26pt; }.markdown-body h2 { font-size:19pt; }.markdown-body h3 { font-size:15pt; }.markdown-body h4 { font-size:12.5pt; }
  .markdown-body pre { color:#111; background:#f3f4f3; border:1px solid #ddd; }
  .markdown-body a { color:#174e37; }
}
@media (max-width:700px) { body { padding:28px 20px 64px; }.export-toc ol { columns:1; }.markdown-body h1 { font-size:32px; }.markdown-body h2 { font-size:24px; } }
`;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function createExportFileName(title: string, extension: "html" | "pdf"): string {
  const safeTitle = title
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim()
    .slice(0, 100) || "note";
  return `${safeTitle}.${extension}`;
}

export function createStandaloneHtml({
  title,
  path,
  articleHtml,
  headings,
  theme,
  exportedAt = new Date(),
}: StandaloneDocumentOptions): string {
  const outline = headings
    .filter((heading) => heading.level >= 2 && heading.level <= 4)
    .map((heading) => `<li class="level-${heading.level}"><a href="#${escapeHtml(heading.slug)}">${escapeHtml(heading.text)}</a></li>`)
    .join("");
  const toc = outline
    ? `<nav class="export-toc" aria-label="文章目录"><h2>目录</h2><ol>${outline}</ol></nav>`
    : "";
  const exportedLabel = new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(exportedAt);

  return `<!doctype html>
<html lang="zh-CN" data-theme="${theme}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="generator" content="Markdown Note Manager">
  <title>${escapeHtml(title)}</title>
  <style>${EXPORT_STYLES}</style>
</head>
<body>
  <header class="export-meta"><strong>NoteHub 离线导出</strong><span>${escapeHtml(path)} · 导出于 ${escapeHtml(exportedLabel)}</span></header>
  ${toc}
  <main>${articleHtml}</main>
</body>
</html>`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("图片读取失败")));
    reader.readAsDataURL(blob);
  });
}

async function inlineImage(source: HTMLImageElement, target: HTMLImageElement, documentPath: string): Promise<boolean> {
  const rawSource = source.currentSrc || source.getAttribute("src") || "";
  if (!rawSource || rawSource.startsWith("data:")) return true;

  const absoluteUrl = new URL(rawSource, window.location.href);
  const requestUrl = absoluteUrl.origin === window.location.origin
    ? absoluteUrl.href
    : `/api/export-asset?path=${encodeURIComponent(documentPath)}&url=${encodeURIComponent(absoluteUrl.href)}`;

  try {
    const response = await fetch(requestUrl);
    if (!response.ok) throw new Error(`图片请求失败：${response.status}`);
    const blob = await response.blob();
    target.src = await blobToDataUrl(blob);
    target.removeAttribute("loading");
    target.removeAttribute("decoding");
    return true;
  } catch {
    target.src = absoluteUrl.href;
    return false;
  }
}

export async function prepareArticleExport(options: {
  article: HTMLElement;
  title: string;
  path: string;
  headings: Heading[];
  theme: ExportTheme;
}): Promise<PreparedExport> {
  const clone = options.article.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("button, [data-export-ignore], .heading-anchor").forEach((element) => element.remove());

  const sourceImages = [...options.article.querySelectorAll<HTMLImageElement>("img")];
  const targetImages = [...clone.querySelectorAll<HTMLImageElement>("img")];
  const results = await Promise.all(
    targetImages.map((target, index) => inlineImage(sourceImages[index], target, options.path)),
  );
  const unembeddedImages = results.filter((result) => !result).length;
  return {
    html: createStandaloneHtml({
      title: options.title,
      path: options.path,
      articleHtml: clone.outerHTML,
      headings: options.headings,
      theme: options.theme,
    }),
    fileName: createExportFileName(options.title, "html"),
    unembeddedImages,
  };
}

export function downloadHtmlFile(prepared: PreparedExport): void {
  const url = URL.createObjectURL(new Blob([prepared.html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = prepared.fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function openPrintWindow(): Window | null {
  const target = window.open("", "_blank", "width=1100,height=850");
  if (!target) return null;
  target.document.write("<!doctype html><meta charset=\"utf-8\"><title>正在准备 PDF…</title><p style=\"font:16px sans-serif;padding:32px\">正在准备 PDF，请稍候…</p>");
  target.document.close();
  return target;
}

export function renderPrintWindow(target: Window, prepared: PreparedExport): void {
  target.document.open();
  target.document.write(prepared.html);
  target.document.close();
  target.document.title = createExportFileName(target.document.title, "pdf").replace(/\.pdf$/, "");

  const printWhenReady = async () => {
    await target.document.fonts?.ready;
    await Promise.all([...target.document.images].map((image) => image.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      })));
    target.focus();
    target.setTimeout(() => target.print(), 150);
  };

  if (target.document.readyState === "complete") void printWhenReady();
  else target.addEventListener("load", () => void printWhenReady(), { once: true });
}
