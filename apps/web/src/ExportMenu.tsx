import { useEffect, useRef, useState } from "react";
import {
  downloadHtmlFile,
  openPrintWindow,
  prepareArticleExport,
  renderPrintWindow,
  type ExportTheme,
} from "./export-utils";
import type { DocumentDetail } from "./types";

interface Props {
  document: DocumentDetail;
  getArticle: () => HTMLElement | null;
  theme: ExportTheme;
  onNotify: (message: string) => void;
  disabled?: boolean;
}

type ExportMode = "html" | "pdf" | null;

function resultMessage(format: "HTML" | "PDF", unembeddedImages: number): string {
  if (unembeddedImages) {
    return `${format} 已生成；${unembeddedImages} 张图片未能内嵌，离线时可能不可见`;
  }
  return format === "PDF"
    ? "打印窗口已打开，请选择“存储为 PDF”"
    : "独立 HTML 文件已下载";
}

export function ExportMenu({ document, getArticle, theme, onNotify, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ExportMode>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [document.path]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape);
    };
  }, []);

  const prepare = async () => {
    const article = getArticle();
    if (!article) throw new Error("请切换到阅读视图后再导出");
    return prepareArticleExport({
      article,
      title: document.title,
      path: document.path,
      headings: document.headings,
      theme,
    });
  };

  const exportHtml = async () => {
    setMode("html");
    setOpen(false);
    try {
      const prepared = await prepare();
      downloadHtmlFile(prepared);
      onNotify(resultMessage("HTML", prepared.unembeddedImages));
    } catch (error) {
      onNotify(error instanceof Error ? error.message : "HTML 导出失败");
    } finally {
      setMode(null);
    }
  };

  const exportPdf = async () => {
    const printWindow = openPrintWindow();
    if (!printWindow) {
      onNotify("浏览器阻止了打印窗口，请允许弹出窗口后重试");
      return;
    }

    setMode("pdf");
    setOpen(false);
    try {
      const prepared = await prepare();
      renderPrintWindow(printWindow, prepared);
      onNotify(resultMessage("PDF", prepared.unembeddedImages));
    } catch (error) {
      printWindow.close();
      onNotify(error instanceof Error ? error.message : "PDF 导出失败");
    } finally {
      setMode(null);
    }
  };

  return (
    <div className="export-menu" ref={menuRef}>
      <button
        className={open ? "active" : ""}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={disabled ? "切换到阅读视图后导出" : "导出离线文件"}
        title={disabled ? "切换到阅读视图后导出" : "导出离线文件"}
        disabled={disabled || mode !== null}
      >
        ⇩ <span>{mode ? "正在导出…" : "导出"}</span>
      </button>
      {open && (
        <div className="export-popover" role="menu">
          <button role="menuitem" onClick={() => void exportHtml()}>
            <span className="export-format">HTML</span>
            <span><strong>独立网页</strong><small>单文件，可离线浏览</small></span>
          </button>
          <button role="menuitem" onClick={() => void exportPdf()}>
            <span className="export-format">PDF</span>
            <span><strong>打印为 PDF</strong><small>适合发送、归档和打印</small></span>
          </button>
        </div>
      )}
    </div>
  );
}
