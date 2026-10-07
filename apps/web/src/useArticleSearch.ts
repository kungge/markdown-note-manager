import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

const ALL_MATCHES_HIGHLIGHT = "article-search-matches";
const CURRENT_MATCH_HIGHLIGHT = "article-search-current";

interface HighlightRegistry {
  delete(name: string): boolean;
  set(name: string, highlight: unknown): void;
}

type HighlightConstructor = new (...ranges: Range[]) => unknown;

function highlightApi(): { registry: HighlightRegistry; Highlight: HighlightConstructor } | null {
  const registry = (CSS as typeof CSS & { highlights?: HighlightRegistry }).highlights;
  const Highlight = (window as typeof window & { Highlight?: HighlightConstructor }).Highlight;
  return registry && Highlight ? { registry, Highlight } : null;
}

function clearHighlights(): void {
  const api = highlightApi();
  api?.registry.delete(ALL_MATCHES_HIGHLIGHT);
  api?.registry.delete(CURRENT_MATCH_HIGHLIGHT);
}

function findRanges(root: HTMLElement, rawQuery: string): Range[] {
  const query = rawQuery.trim().toLocaleLowerCase();
  if (!query) return [];

  const ranges: Range[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !node.nodeValue?.trim()) return NodeFilter.FILTER_REJECT;
      if (parent.closest("script, style, svg, [data-search-ignore]")) return NodeFilter.FILTER_REJECT;
      return node.nodeValue.toLocaleLowerCase().includes(query)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  while (walker.nextNode() && ranges.length < 1000) {
    const node = walker.currentNode as Text;
    const text = node.nodeValue ?? "";
    const normalized = text.toLocaleLowerCase();
    let matchIndex = normalized.indexOf(query);
    while (matchIndex !== -1 && ranges.length < 1000) {
      const range = document.createRange();
      range.setStart(node, matchIndex);
      range.setEnd(node, matchIndex + query.length);
      ranges.push(range);
      matchIndex = normalized.indexOf(query, matchIndex + query.length);
    }
  }
  return ranges;
}

export function useArticleSearch(
  rootRef: RefObject<HTMLElement | null>,
  query: string,
  documentKey: string,
) {
  const rangesRef = useRef<Range[]>([]);
  const [total, setTotal] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(-1);

  const activate = useCallback((index: number, scroll = true) => {
    const api = highlightApi();
    const target = rangesRef.current[index];
    if (!api || !target) return;
    api.registry.set(CURRENT_MATCH_HIGHLIGHT, new api.Highlight(target));
    if (scroll) {
      target.startContainer.parentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, []);

  useEffect(() => {
    clearHighlights();
    const root = rootRef.current;
    const api = highlightApi();
    if (!root || !api) {
      rangesRef.current = [];
      setTotal(0);
      setCurrentIndex(-1);
      return;
    }

    const ranges = findRanges(root, query);
    rangesRef.current = ranges;
    setTotal(ranges.length);
    const firstIndex = ranges.length ? 0 : -1;
    setCurrentIndex(firstIndex);
    if (ranges.length) {
      api.registry.set(ALL_MATCHES_HIGHLIGHT, new api.Highlight(...ranges));
      activate(firstIndex);
    }
    return clearHighlights;
  }, [activate, documentKey, query, rootRef]);

  const move = useCallback(
    (direction: 1 | -1) => {
      if (!rangesRef.current.length) return;
      const nextIndex = (currentIndex + direction + rangesRef.current.length) % rangesRef.current.length;
      setCurrentIndex(nextIndex);
      activate(nextIndex);
    },
    [activate, currentIndex],
  );

  return {
    total,
    current: currentIndex >= 0 ? currentIndex + 1 : 0,
    next: () => move(1),
    previous: () => move(-1),
  };
}
