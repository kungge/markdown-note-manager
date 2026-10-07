import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { MermaidBlock } from "./MermaidBlock";
import { resolveRelativePath } from "./path-utils";

interface Props {
  content: string;
  documentPath: string;
  onOpenDocument: (path: string) => void;
}

function isExternal(value: string): boolean {
  return /^(https?:|mailto:)/i.test(value);
}

export function MarkdownPreview({ content, documentPath, onOpenDocument }: Props) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight]}
        components={{
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
              return (
                <a
                  href={value}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenDocument(resolveRelativePath(documentPath, value));
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
}
