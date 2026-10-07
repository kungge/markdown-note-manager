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
