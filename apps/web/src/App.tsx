import { useCallback, useEffect, useMemo, useState } from "react";
import { getDocument, getDocuments, getGitStatus, getWorkspace, searchDocuments } from "./api";
import { FolderTree } from "./FolderTree";
import { MarkdownPreview } from "./MarkdownPreview";
import { formatRelativeTime } from "./path-utils";
import type { DocumentDetail, DocumentSummary, GitStatusResult, SearchHit } from "./types";

export default function App() {
  const [workspace, setWorkspace] = useState({ name: "NoteHub", documentCount: 0, readOnly: true });
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [activeDocument, setActiveDocument] = useState<DocumentDetail | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[]>([]);
  const [git, setGit] = useState<GitStatusResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadOverview = useCallback(async () => {
    const [nextWorkspace, nextDocuments, nextGit] = await Promise.all([
      getWorkspace(),
      getDocuments(),
      getGitStatus(),
    ]);
    setWorkspace(nextWorkspace);
    setDocuments(nextDocuments);
    setGit(nextGit);
    return nextDocuments;
  }, []);

  const openDocument = useCallback(async (path: string) => {
    try {
      setError("");
      setActiveDocument(await getDocument(path));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法打开笔记");
    }
  }, []);

  useEffect(() => {
    loadOverview()
      .then((items) => {
        if (items[0]) return openDocument(items[0].path);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "工作区加载失败"))
      .finally(() => setLoading(false));
  }, [loadOverview, openDocument]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!query.trim()) {
        setResults([]);
        return;
      }
      searchDocuments(query).then(setResults).catch((reason) => {
        setError(reason instanceof Error ? reason.message : "搜索失败");
      });
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const source = new EventSource("/api/events");
    let refreshTimer = 0;
    source.addEventListener("workspace-change", () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        const items = await loadOverview();
        if (activeDocument && items.some((item) => item.path === activeDocument.path)) {
          await openDocument(activeDocument.path);
        }
        if (query.trim()) setResults(await searchDocuments(query));
      }, 200);
    });
    return () => {
      window.clearTimeout(refreshTimer);
      source.close();
    };
  }, [activeDocument?.path, loadOverview, openDocument, query]);

  const resultDocuments = useMemo(() => (query.trim() ? results : []), [query, results]);
  const gitLabel = !git?.available
    ? "Git 不可用"
    : `${git.branch ?? "detached"}${git.files.length ? ` · ${git.files.length} 项变更` : " · 已同步"}`;

  if (loading) {
    return <main className="loading-screen"><div className="spinner" /><p>正在读取工作区…</p></main>;
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <header className="topbar">
        <button className="icon-button" onClick={() => setSidebarOpen((value) => !value)} aria-label="切换侧栏">
          ☰
        </button>
        <div className="brand-mark">M</div>
        <div className="brand-copy">
          <strong>{workspace.name}</strong>
          <span>{workspace.documentCount} 篇笔记 · 只读验证版</span>
        </div>
        <label className="search-box">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、路径和正文…"
            aria-label="搜索笔记"
          />
          {query && <button onClick={() => setQuery("")} aria-label="清空搜索">×</button>}
        </label>
        <div className={`git-pill ${git?.files.length ? "dirty" : ""}`} title={git?.message ?? "只读 Git 状态"}>
          <span>⑂</span>{gitLabel}
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-heading">
          <span>文件</span>
          <span className="count-badge">{documents.length}</span>
        </div>
        <FolderTree documents={documents} activePath={activeDocument?.path ?? ""} onOpen={openDocument} />
      </aside>

      <section className={`result-panel ${query.trim() ? "visible" : ""}`}>
        <div className="panel-heading">
          <strong>搜索结果</strong>
          <span>{resultDocuments.length}{results.length === 100 ? "+" : ""}</span>
        </div>
        <div className="result-list">
          {resultDocuments.map((result) => (
            <button key={result.path} onClick={() => { openDocument(result.path); setQuery(""); }}>
              <strong>{result.title}</strong>
              <small>{result.path}</small>
              <p>{result.snippet}</p>
            </button>
          ))}
          {!resultDocuments.length && <div className="empty-state">没有找到匹配的笔记</div>}
        </div>
      </section>

      <main className="document-panel">
        {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
        {activeDocument ? (
          <>
            <header className="document-header">
              <div>
                <div className="breadcrumbs">{activeDocument.path.split("/").slice(0, -1).join("  /  ") || "根目录"}</div>
                <h1>{activeDocument.title}</h1>
                <div className="document-meta">
                  <span>{formatRelativeTime(activeDocument.modifiedAt)} 更新</span>
                  <span>{Math.max(1, Math.ceil(activeDocument.size / 1024))} KB</span>
                  {activeDocument.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}
                </div>
              </div>
              <div className="readonly-chip">只读</div>
            </header>
            <div className="document-scroll">
              <MarkdownPreview
                content={activeDocument.body}
                documentPath={activeDocument.path}
                onOpenDocument={openDocument}
              />
            </div>
          </>
        ) : (
          <div className="empty-document"><div>◇</div><p>选择一篇笔记开始阅读</p></div>
        )}
      </main>
    </div>
  );
}
