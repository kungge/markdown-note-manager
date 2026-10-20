import { useEffect, useState } from "react";
import type { ScanSkipReason, ScanStatus } from "./types";

const REASON_LABELS: Record<ScanSkipReason, string> = {
  "configured-hidden": "配置的隐藏路径",
  "dot-directory": "点目录",
  "default-ignored": "默认忽略目录",
  "symbolic-link": "符号链接",
  "non-markdown": "非 Markdown 文件",
};

function statusLabel(scan: ScanStatus): string {
  if (scan.status === "scanning") return `正在扫描 · ${scan.scannedEntries} 项`;
  if (scan.status === "failed") return "扫描失败";
  if (scan.status === "completed") {
    return scan.errorEntries ? `扫描完成 · ${scan.errorEntries} 个问题` : "扫描完成";
  }
  return "等待扫描";
}

function finishedLabel(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export function ScanStatusPanel({ scan }: { scan: ScanStatus }) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (scan.status === "failed" || scan.errorEntries > 0) setExpanded(true);
  }, [scan.errorEntries, scan.status]);

  const reasons = Object.entries(scan.skippedByReason)
    .filter(([, count]) => count > 0) as Array<[ScanSkipReason, number]>;

  return (
    <section className={`scan-panel ${scan.status}`} aria-live="polite">
      <button
        className="scan-summary"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        <span className="scan-indicator" aria-hidden="true" />
        <span className="scan-summary-copy">
          <strong>{statusLabel(scan)}</strong>
          {scan.status === "scanning" && scan.currentPath && (
            <small title={scan.currentPath}>{scan.currentPath}</small>
          )}
          {scan.status === "completed" && (
            <small>{scan.indexedFiles} 篇笔记 · 跳过 {scan.skippedEntries} 项</small>
          )}
        </span>
        <span aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
      </button>

      {expanded && (
        <div className="scan-details">
          <div className="scan-metrics">
            <span><strong>{scan.scannedEntries}</strong>已检查</span>
            <span><strong>{scan.indexedFiles}</strong>已索引</span>
            <span><strong>{scan.skippedEntries}</strong>已跳过</span>
            <span className={scan.errorEntries ? "has-errors" : ""}><strong>{scan.errorEntries}</strong>错误</span>
          </div>

          {reasons.length > 0 && (
            <div className="scan-section">
              <h3>跳过原因</h3>
              <ul className="scan-reasons">
                {reasons.map(([reason, count]) => (
                  <li key={reason}><span>{REASON_LABELS[reason]}</span><strong>{count}</strong></li>
                ))}
              </ul>
            </div>
          )}

          {scan.issues.length > 0 && (
            <div className="scan-section">
              <h3>问题文件</h3>
              <ul className="scan-issues">
                {scan.issues.map((issue, index) => (
                  <li key={`${issue.path}-${index}`}>
                    <strong title={issue.path}>{issue.path}</strong>
                    <span>{issue.message}</span>
                  </li>
                ))}
                {scan.truncatedIssues > 0 && <li>另有 {scan.truncatedIssues} 个问题未展开</li>}
              </ul>
            </div>
          )}

          {scan.finishedAt && <p className="scan-finished">完成于 {finishedLabel(scan.finishedAt)}</p>}
        </div>
      )}
    </section>
  );
}
