import type { Heading } from "./types";

interface Props {
  headings: Heading[];
  activeSlug: string;
  onSelect: (slug: string) => void;
}
export function DocumentOutline({ headings, activeSlug, onSelect }: Props) {
  const visibleHeadings = headings.filter((heading) => heading.level >= 2 && heading.level <= 4);
  return (
    <aside className="document-outline" aria-label="文章大纲">
      <div className="outline-title">本文目录</div>
      {visibleHeadings.length ? (
        <nav>
          {visibleHeadings.map((heading, index) => (
            <button
              key={`${heading.slug}-${heading.line}-${index}`}
              className={`${activeSlug === heading.slug ? "active" : ""} level-${heading.level}`}
              onClick={() => onSelect(heading.slug)}
              title={heading.text}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      ) : (
        <p>当前文章没有二至四级标题</p>
      )}
    </aside>
  );
}
