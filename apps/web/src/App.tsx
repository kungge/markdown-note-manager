import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArticleSearchBar } from "./ArticleSearchBar";
import { getDocument, getDocuments, getGitStatus, getWorkspace, searchDocuments } from "./api";
import { DocumentOutline } from "./DocumentOutline";
import { ExportMenu } from "./ExportMenu";
import { FolderTree } from "./FolderTree";
import { MarkdownPreview } from "./MarkdownPreview";
import { formatRelativeTime } from "./path-utils";
import { buildDocumentUrl, headingFromLocation } from "./reading-utils";
import { SourceView } from "./SourceView";
import type { DocumentDetail, DocumentSummary, GitStatusResult, SearchHit } from "./types";
import { useArticleSearch } from "./useArticleSearch";

type Theme = "light" | "dark";

interface OpenDocumentOptions {
  updateUrl?: boolean;
  heading?: string;
}

function initialTheme(): Theme {
  const stored = window.localStorage.getItem("note-manager-theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

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
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const [articleSearchOpen, setArticleSearchOpen] = useState(false);
  const [articleQuery, setArticleQuery] = useState("");
  const [readingProgress, setReadingProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState("");
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [toast, setToast] = useState("");

  const documentScrollRef = useRef<HTMLDivElement>(null);
  const articleRootRef = useRef<HTMLDivElement>(null);
  const pendingHeadingRef = useRef("");
  const toastTimerRef = useRef<number | undefined>(undefined);

  const articleSearch = useArticleSearch(articleRootRef, articleQuery, activeDocument?.path ?? "");

  const showToast = useCallback((message: string) => {
    window.clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 2200);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("note-manager-theme", theme);
  }, [theme]);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

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

  const openDocument = useCallback(async (path: string, options: OpenDocumentOptions = {}) => {
    try {
      setError("");
      const nextDocument = await getDocument(path);
      pendingHeadingRef.current = options.heading ?? "";
      setActiveDocument(nextDocument);
      if (options.updateUrl !== false) {
        window.history.pushState({}, "", buildDocumentUrl(path, options.heading));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "无法打开笔记");
    }
  }, []);

  const scrollToHeading = useCallback((slug: string, updateUrl = true) => {
    const target = articleRootRef.current?.querySelector<HTMLElement>(`#${CSS.escape(slug)}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveHeading(slug);
    if (updateUrl && activeDocument) {
      window.history.replaceState({}, "", buildDocumentUrl(activeDocument.path, slug));
    }
  }, [activeDocument]);

  useEffect(() => {
    loadOverview()
      .then((items) => {
        const requestedPath = new URLSearchParams(window.location.search).get("path");
        const target = items.find((item) => item.path === requestedPath) ?? items[0];
        if (target) {
          return openDocument(target.path, {
            updateUrl: false,
            heading: requestedPath ? headingFromLocation() : "",
          });
        }
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "工作区加载失败"))
      .finally(() => setLoading(false));
  }, [loadOverview, openDocument]);

  useEffect(() => {
    const onPopState = () => {
      const path = new URLSearchParams(window.location.search).get("path");
      if (path) void openDocument(path, { updateUrl: false, heading: headingFromLocation() });
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [openDocument]);

  useEffect(() => {
    setDetailsExpanded(false);
    setSourceMode(false);
    setArticleSearchOpen(false);
    setArticleQuery("");
    setReadingProgress(0);
    documentScrollRef.current?.scrollTo({ top: 0 });
    const firstHeading = activeDocument?.headings.find((heading) => heading.level >= 2)?.slug ?? "";
    setActiveHeading(firstHeading);

    const pendingHeading = pendingHeadingRef.current || headingFromLocation();
    pendingHeadingRef.current = "";
    if (pendingHeading) {
      const timer = window.setTimeout(() => scrollToHeading(pendingHeading, false), 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeDocument?.path, scrollToHeading]);

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
          await openDocument(activeDocument.path, { updateUrl: false });
        }
        if (query.trim()) setResults(await searchDocuments(query));
      }, 200);
    });
    return () => {
      window.clearTimeout(refreshTimer);
      source.close();
    };
  }, [activeDocument?.path, loadOverview, openDocument, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "f" && activeDocument) {
        event.preventDefault();
        setSourceMode(false);
        setArticleSearchOpen(true);
      }
      if (event.key === "Escape" && articleSearchOpen) {
        setArticleSearchOpen(false);
        setArticleQuery("");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeDocument, articleSearchOpen]);

  const updateReadingState = useCallback(() => {
    const container = documentScrollRef.current;
    if (!container) return;
    const available = container.scrollHeight - container.clientHeight;
    setReadingProgress(available > 0 ? Math.min(100, (container.scrollTop / available) * 100) : 0);

    if (!activeDocument || sourceMode) return;
    const threshold = container.getBoundingClientRect().top + 100;
    let current = activeDocument.headings.find((heading) => heading.level >= 2)?.slug ?? "";
    for (const heading of activeDocument.headings) {
      if (heading.level < 2 || heading.level > 4) continue;
      const element = articleRootRef.current?.querySelector<HTMLElement>(`#${CSS.escape(heading.slug)}`);
      if (element && element.getBoundingClientRect().top <= threshold) current = heading.slug;
      else if (element) break;
    }
    setActiveHeading(current);
  }, [activeDocument, sourceMode]);

  const resultDocuments = useMemo(() => (query.trim() ? results : []), [query, results]);
  const gitLabel = !git?.available
    ? "Git 不可用"
    : `${git.branch ?? "detached"}${git.files.length ? ` · ${git.files.length} 项变更` : " · 已同步"}`;

  const copyDocumentLink = useCallback(async () => {
    if (!activeDocument) return;
    await copyText(buildDocumentUrl(activeDocument.path));
    showToast("文章链接已复制");
  }, [activeDocument, showToast]);

  const copyHeadingLink = useCallback(async (slug: string, title: string) => {
    if (!activeDocument) return;
    const url = buildDocumentUrl(activeDocument.path, slug);
    window.history.replaceState({}, "", url);
    await copyText(url);
    showToast(`“${title}”章节链接已复制`);
  }, [activeDocument, showToast]);

  const copySource = useCallback(async () => {
    if (!activeDocument) return;
    await copyText(activeDocument.content);
    showToast("Markdown 源码已复制");
  }, [activeDocument, showToast]);

  if (loading) {
    return <main className="loading-screen"><div className="spinner" /><p>正在读取工作区…</p></main>;
  }

  return (
    <div className={`app-shell ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <header className="topbar">
        <button className="icon-button" onClick={() => setSidebarOpen((value) => !value)} aria-label="切换侧栏">☰</button>
        <div className="brand-mark">M</div>
        <div className="brand-copy"><strong>{workspace.name}</strong><span>{workspace.documentCount} 篇笔记 · 只读验证版</span></div>
        <label className="search-box">
          <span>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索全部笔记…" aria-label="搜索笔记" />
          {query && <button onClick={() => setQuery("")} aria-label="清空搜索">×</button>}
        </label>
        <button className="theme-toggle" onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")} aria-label={theme === "dark" ? "切换到浅色模式" : "切换到暗色模式"} title={theme === "dark" ? "切换到浅色模式" : "切换到暗色模式"}>{theme === "dark" ? "☀" : "☾"}</button>
        <div className={`git-pill ${git?.files.length ? "dirty" : ""}`} title={git?.message ?? "只读 Git 状态"}><span>⑂</span>{gitLabel}</div>
      </header>

      <aside className="sidebar">
        <div className="sidebar-heading"><span>文件</span><span className="count-badge">{documents.length}</span></div>
        <FolderTree documents={documents} activePath={activeDocument?.path ?? ""} onOpen={(path) => void openDocument(path)} />
      </aside>

      <section className={`result-panel ${query.trim() ? "visible" : ""}`}>
        <div className="panel-heading"><strong>搜索结果</strong><span>{resultDocuments.length}{results.length === 100 ? "+" : ""}</span></div>
        <div className="result-list">
          {resultDocuments.map((result) => (
            <button key={result.path} onClick={() => { void openDocument(result.path); setQuery(""); }}>
              <strong>{result.title}</strong><small>{result.path}</small><p>{result.snippet}</p>
            </button>
          ))}
          {!resultDocuments.length && <div className="empty-state">没有找到匹配的笔记</div>}
        </div>
      </section>

      <main className="document-panel">
        <div className="reading-progress" aria-hidden="true"><span style={{ width: `${readingProgress}%` }} /></div>
        {error && <div className="error-banner">{error}<button onClick={() => setError("")}>×</button></div>}
        {activeDocument ? (
          <>
            <header className={`document-header ${detailsExpanded ? "expanded" : ""}`}>
              <div className="document-title-block">
                <div className="breadcrumbs" title={activeDocument.path}>{activeDocument.path}</div>
                <h1 title={activeDocument.title}>{activeDocument.title}</h1>
              </div>
              <div className="document-actions" data-search-ignore>
                <button onClick={() => { setSourceMode(false); setArticleSearchOpen(true); }} title="文内查找（Ctrl/Cmd+F）">⌕ <span>文内查找</span></button>
                <button className={sourceMode ? "active" : ""} onClick={() => { setSourceMode((value) => !value); setArticleSearchOpen(false); setArticleQuery(""); }} title="查看源 Markdown">&lt;/&gt; <span>{sourceMode ? "阅读视图" : "查看源码"}</span></button>
                <button onClick={() => void copyDocumentLink()} title="复制文章链接">⧉ <span>复制链接</span></button>
                <ExportMenu
                  document={activeDocument}
                  getArticle={() => articleRootRef.current?.querySelector<HTMLElement>(".markdown-body") ?? null}
                  theme={theme}
                  onNotify={showToast}
                  disabled={sourceMode}
                />
                <button className="details-toggle" onClick={() => setDetailsExpanded((value) => !value)} aria-expanded={detailsExpanded} title="显示文章信息">{detailsExpanded ? "⌃" : "⌄"}</button>
              </div>
              {detailsExpanded && (
                <div className="document-meta">
                  <span>{formatRelativeTime(activeDocument.modifiedAt)} 更新</span><span>{Math.max(1, Math.ceil(activeDocument.size / 1024))} KB</span><span>{activeDocument.headings.length} 个标题</span>
                  {activeDocument.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}<span className="readonly-chip">只读</span>
                </div>
              )}
            </header>

            {articleSearchOpen && !sourceMode && (
              <ArticleSearchBar query={articleQuery} onQueryChange={setArticleQuery} current={articleSearch.current} total={articleSearch.total} onNext={articleSearch.next} onPrevious={articleSearch.previous} onClose={() => { setArticleSearchOpen(false); setArticleQuery(""); }} />
            )}

            <div className={`reader-layout ${sourceMode ? "source-mode" : ""}`}>
              <div className="document-scroll" ref={documentScrollRef} onScroll={updateReadingState}>
                <div ref={articleRootRef}>
                  {sourceMode ? (
                    <SourceView source={activeDocument.content} onCopy={() => void copySource()} />
                  ) : (
                    <MarkdownPreview content={activeDocument.body} documentPath={activeDocument.path} onOpenDocument={(path, heading) => void openDocument(path, { heading })} onCopyHeadingLink={(slug, title) => void copyHeadingLink(slug, title)} />
                  )}
                </div>
              </div>
              {!sourceMode && <DocumentOutline headings={activeDocument.headings} activeSlug={activeHeading} onSelect={(slug) => scrollToHeading(slug)} />}
            </div>

            {readingProgress > 8 && <button className="back-to-top" onClick={() => documentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })} aria-label="返回文章顶部" title="返回顶部">↑</button>}
          </>
        ) : (
          <div className="empty-document"><div>◇</div><p>选择一篇笔记开始阅读</p></div>
        )}
      </main>
      {toast && <div className="toast" role="status">✓ {toast}</div>}
    </div>
  );
}
