import type { ReactNode } from "react";

export function slugifyHeading(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}\-_]/gu, "");
}
export function reactNodeToText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodeToText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return reactNodeToText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

export function buildDocumentUrl(
  documentPath: string,
  heading = "",
  baseUrl = window.location.href,
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("path", documentPath);
  url.hash = heading ? `#${encodeURIComponent(heading)}` : "";
  return url.toString();
}

export function headingFromLocation(): string {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
