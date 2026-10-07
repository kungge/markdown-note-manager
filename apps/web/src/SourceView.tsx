export function SourceView({ source, onCopy }: { source: string; onCopy: () => void }) {
  return (
    <section className="source-view" aria-label="Markdown 源码">
      <div className="source-view-toolbar" data-search-ignore>
        <span>Markdown 源码</span>
        <button onClick={onCopy}>复制源码</button>
      </div>
      <pre><code>{source}</code></pre>
    </section>
  );
}
