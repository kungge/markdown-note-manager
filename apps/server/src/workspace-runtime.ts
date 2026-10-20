import { EventEmitter } from "node:events";
import { watch, type FSWatcher } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { createIdleScanStatus, DocumentIndex } from "./index-store.js";
import { isHiddenPath } from "./path-security.js";
import type { ScanStatus } from "./types.js";

export interface WorkspaceSnapshot {
  configured: boolean;
  root: string | null;
  name: string;
  documentCount: number;
  readOnly: true;
  scan: ScanStatus;
}

export class WorkspaceNotConfiguredError extends Error {}

export class WorkspaceRuntime {
  readonly events = new EventEmitter();
  private root: string | null = null;
  private index: DocumentIndex | null = null;
  private watcher: FSWatcher | null = null;
  private rebuildTimer: NodeJS.Timeout | undefined;
  private scanStatus = createIdleScanStatus();
  private lastScanEventAt = 0;
  private initialized = false;

  constructor(
    private readonly initialRoot: string | null,
    private readonly hiddenPaths: string[],
    private readonly ignorePatterns: string[],
    private readonly watchFiles = true,
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    if (this.initialRoot) await this.setWorkspace(this.initialRoot, false);
  }

  snapshot(): WorkspaceSnapshot {
    return {
      configured: this.root !== null,
      root: this.root,
      name: this.root ? path.basename(this.root) : "尚未选择工作区",
      documentCount: this.index?.list().length ?? 0,
      readOnly: true,
      scan: this.scanStatus,
    };
  }

  isScanning(): boolean {
    return this.scanStatus.status === "scanning";
  }

  getRoot(): string {
    if (!this.root) throw new WorkspaceNotConfiguredError("请先选择一个 Markdown 工作区。");
    return this.root;
  }

  getIndex(): DocumentIndex {
    if (!this.index) throw new WorkspaceNotConfiguredError("请先选择一个 Markdown 工作区。");
    return this.index;
  }

  async setWorkspace(rawRoot: string, notify = true): Promise<WorkspaceSnapshot> {
    const nextRoot = path.resolve(rawRoot);
    const workspaceName = path.basename(nextRoot);
    this.updateScanStatus({
      ...createIdleScanStatus(),
      status: "scanning",
      workspaceName,
      startedAt: new Date().toISOString(),
    }, true);

    const info = await stat(nextRoot).catch(() => null);
    if (!info?.isDirectory()) {
      const error = new Error(`Workspace does not exist or is not a directory: ${nextRoot}`);
      this.markScanFailed(workspaceName, error);
      throw error;
    }

    const nextIndex = new DocumentIndex(nextRoot, this.hiddenPaths, this.ignorePatterns);
    let report: ScanStatus;
    try {
      report = await nextIndex.rebuild((status) => {
        if (status.status === "scanning") this.updateScanStatus(status);
      });
    } catch (error) {
      this.markScanFailed(workspaceName, error);
      throw error;
    }
    this.stopWatcher();
    this.root = nextRoot;
    this.index = nextIndex;
    if (this.watchFiles) this.startWatcher();
    this.updateScanStatus(report, true);

    const snapshot = this.snapshot();
    if (notify) {
      this.events.emit("workspace-change", JSON.stringify({
        kind: "workspace-selected",
        changedAt: new Date().toISOString(),
      }));
    }
    return snapshot;
  }

  async close(): Promise<void> {
    this.stopWatcher();
  }

  private startWatcher(): void {
    const workspaceRoot = this.getRoot();
    this.watcher = watch(workspaceRoot, { recursive: true }, (_eventType, fileName) => {
      const portableName = fileName?.toString().replaceAll("\\", "/") ?? "";
      if (isHiddenPath(portableName, this.hiddenPaths)) return;
      const baseName = path.posix.basename(portableName);
      if (baseName !== ".gitignore" && this.getIndex().isIgnored(portableName, false)) return;
      if (baseName !== ".gitignore" && !portableName.toLocaleLowerCase().endsWith(".md")) return;
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = setTimeout(() => void this.rebuildAfterChange(), 350);
    });
    this.watcher.on("error", (error) => this.events.emit("watcher-error", error));
  }

  private async rebuildAfterChange(): Promise<void> {
    if (this.isScanning()) return;
    try {
      const report = await this.getIndex().rebuild((status) => this.updateScanStatus(status));
      this.updateScanStatus(report, true);
      this.events.emit("workspace-change", JSON.stringify({
        kind: "files-changed",
        changedAt: new Date().toISOString(),
      }));
    } catch (error) {
      this.events.emit("rebuild-error", error);
    }
  }

  private stopWatcher(): void {
    clearTimeout(this.rebuildTimer);
    this.rebuildTimer = undefined;
    this.watcher?.close();
    this.watcher = null;
  }

  private updateScanStatus(status: ScanStatus, force = false): void {
    this.scanStatus = status;
    const now = Date.now();
    if (force || status.status !== "scanning" || now - this.lastScanEventAt >= 100) {
      this.lastScanEventAt = now;
      this.events.emit("scan-status", JSON.stringify(status));
    }
  }

  private markScanFailed(workspaceName: string, error: unknown): void {
    const message = error instanceof Error ? error.message : "Workspace scan failed.";
    this.updateScanStatus({
      ...createIdleScanStatus(),
      status: "failed",
      workspaceName,
      errorEntries: 1,
      issues: [{ path: ".", message }],
      startedAt: this.scanStatus.startedAt,
      finishedAt: new Date().toISOString(),
    }, true);
  }
}
