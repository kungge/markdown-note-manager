import { useEffect, useId, useState } from "react";

const mermaidPromise = import("mermaid").then(({ default: mermaid }) => {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "default",
  });
  return mermaid;
});

export function MermaidBlock({ source }: { source: string }) {
  const id = `mermaid-${useId().replaceAll(":", "")}`;
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    mermaidPromise
      .then((mermaid) => mermaid.render(id, source))
      .then((result) => {
        if (active) setSvg(result.svg);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Mermaid 图表渲染失败");
      });
    return () => {
      active = false;
    };
  }, [id, source]);

  if (error) return <pre className="render-error">{error}</pre>;
  return <div className="mermaid-block" dangerouslySetInnerHTML={{ __html: svg }} />;
}
