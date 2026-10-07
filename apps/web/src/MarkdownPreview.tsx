import { memo, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { MermaidBlock } from "./MermaidBlock";
import { resolveRelativePath } from "./path-utils";
import { reactNodeToText, slugifyHeading } from "./reading-utils";

interface Props {
  content: string;
  documentPath: string;
  onOpenDocument: (path: string, heading?: string) => void;
  onCopyHeadingLink: (slug: string, title: string) => void;
}

function isExternal(value: string): boolean {
  return /^(https?:|mailto:)/i.test(value);
}

export const MarkdownPreview = memo(function MarkdownPreview({
  content,
  documentPath,
  onOpenDocument,
  onCopyHeadingLink,
}: Props) {
  const headingComponent = (Tag: ElementType) => {
    return function Heading({ children }: { children?: ReactNode }) {
      const title = reactNodeToText(children);
      const slug = slugifyHeading(title);
      return (
        <Tag id={slug} className="anchored-heading">
          <span>{children}</span>
          <button
            className="heading-anchor"
            onClick={() => onCopyHeadingLink(slug, title)}
            aria-label={`复制章节链接：${title}`}
            title="复制章节锚点链接"
            data-search-ignore
          >
            🔗
          </button>
        </Tag>
      );
    };
  };

  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
        components={{
          h1: headingComponent("h1"),
          h2: headingComponent("h2"),
          h3: headingComponent("h3"),
          h4: headingComponent("h4"),
          h5: headingComponent("h5"),
          h6: headingComponent("h6"),
          code({ className, children, ...props }: ComponentPropsWithoutRef<"code">) {
            if (className === "language-mermaid") {
              return <MermaidBlock source={String(children).replace(/\n$/, "")} />;
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          img({ src, alt, ...props }) {
            const value = typeof src === "string" ? src : "";
            const resolved = isExternal(value)
              ? value
              : `/api/asset?path=${encodeURIComponent(resolveRelativePath(documentPath, value))}`;
            return <img src={resolved} alt={alt ?? ""} loading="lazy" {...props} />;
          },
          a({ href, children, ...props }) {
            const value = href ?? "";
            if (isExternal(value)) {
              return (
                <a href={value} target="_blank" rel="noreferrer" {...props}>
                  {children}
                </a>
              );
            }
            if (value && value.split("#")[0].toLocaleLowerCase().endsWith(".md")) {
              const [targetPath, targetHeading] = value.split("#", 2);
              return (
                <a
                  href={value}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenDocument(
                      resolveRelativePath(documentPath, targetPath),
                      targetHeading ? decodeURIComponent(targetHeading) : undefined,
                    );
                  }}
                  {...props}
                >
                  {children}
                </a>
              );
            }
            return <a href={value} {...props}>{children}</a>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
});
