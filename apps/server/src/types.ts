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

export interface IndexedDocument extends DocumentSummary {
  content: string;
  body: string;
  frontMatter: Record<string, unknown>;
}

export interface SearchHit extends DocumentSummary {
  score: number;
  snippet: string;
}

export interface GitFileStatus {
  path: string;
  indexStatus: string;
  workTreeStatus: string;
}

export interface GitStatusResult {
  available: boolean;
  branch: string | null;
  files: GitFileStatus[];
  message?: string;
}
