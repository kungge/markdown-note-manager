import type { DocumentDetail, DocumentSummary, GitStatusResult, SearchHit } from "./types";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function getWorkspace(): Promise<{
  name: string;
  documentCount: number;
  readOnly: boolean;
}> {
  return getJson("/api/workspace");
}

export async function getDocuments(): Promise<DocumentSummary[]> {
  const result = await getJson<{ documents: DocumentSummary[] }>("/api/documents");
  return result.documents;
}

export async function getDocument(path: string): Promise<DocumentDetail> {
  return getJson(`/api/document?path=${encodeURIComponent(path)}`);
}

export async function searchDocuments(query: string, scope = ""): Promise<SearchHit[]> {
  const params = new URLSearchParams({ q: query });
  if (scope) params.set("scope", scope);
  const result = await getJson<{ results: SearchHit[] }>(`/api/search?${params}`);
  return result.results;
}

export async function getGitStatus(): Promise<GitStatusResult> {
  return getJson("/api/git/status");
}
