export function directoryOf(filePath: string): string {
  const index = filePath.lastIndexOf("/");
  return index === -1 ? "" : filePath.slice(0, index);
}

export function resolveRelativePath(documentPath: string, target: string): string {
  const rawTarget = decodeURIComponent(target.split("#")[0]);
  if (!rawTarget || /^(https?:|data:|blob:|mailto:)/i.test(rawTarget)) return rawTarget;
  const sourceParts = rawTarget.startsWith("/")
    ? []
    : directoryOf(documentPath).split("/").filter(Boolean);
  const targetParts = rawTarget.replaceAll("\\", "/").split("/");
  for (const part of targetParts) {
    if (!part || part === ".") continue;
    if (part === "..") sourceParts.pop();
    else sourceParts.push(part);
  }
  return sourceParts.join("/");
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
