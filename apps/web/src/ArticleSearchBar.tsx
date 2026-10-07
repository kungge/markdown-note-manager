import { useEffect, useRef } from "react";

interface Props {
  query: string;
  onQueryChange: (value: string) => void;
  current: number;
  total: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
}
export function ArticleSearchBar({
  query,
  onQueryChange,
  current,
  total,
  onNext,
  onPrevious,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <div className="article-search" data-search-ignore>
      <span className="article-search-icon">⌕</span>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.shiftKey ? onPrevious() : onNext();
          if (event.key === "Escape") onClose();
        }}
        placeholder="在当前文章中查找…"
        aria-label="在当前文章中查找"
      />
      <span className="article-search-count">{query ? `${current} / ${total}` : "0 / 0"}</span>
      <button onClick={onPrevious} disabled={!total} aria-label="上一个匹配">↑</button>
      <button onClick={onNext} disabled={!total} aria-label="下一个匹配">↓</button>
      <button onClick={onClose} aria-label="关闭文内搜索">×</button>
    </div>
  );
}
