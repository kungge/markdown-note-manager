export interface Heading {
  level: number;
  text: string;
  slug: string;
  line: number;
}

export interface DocumentSummary {
  path: string;
  title: string;
  size: number;
  modifiedAt: string;
  headings: Heading[];
  tags: string[];
}

export interface DocumentDetail extends DocumentSummary {
  content: string;
  body: string;
  frontMatter: Record<string, unknown>;
}

export interface SearchHit extends DocumentSummary {
  score: number;
  snippet: string;
}

export interface GitStatusResult {
  available: boolean;
  branch: string | null;
  files: Array<{ path: string; indexStatus: string; workTreeStatus: string }>;
  message?: string;
}

export type ScanStatusKind = "idle" | "scanning" | "completed" | "failed";

export type ScanSkipReason =
  | "configured-hidden"
  | "dot-directory"
  | "default-ignored"
  | "symbolic-link"
  | "non-markdown";

export interface ScanIssue {
  path: string;
  message: string;
}

export interface ScanStatus {
  status: ScanStatusKind;
  workspaceName: string | null;
  scannedEntries: number;
  indexedFiles: number;
  skippedEntries: number;
  errorEntries: number;
  skippedByReason: Record<ScanSkipReason, number>;
  issues: ScanIssue[];
  truncatedIssues: number;
  currentPath: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface WorkspaceInfo {
  configured: boolean;
  root: string | null;
  name: string;
  documentCount: number;
  readOnly: boolean;
  scan: ScanStatus;
}
