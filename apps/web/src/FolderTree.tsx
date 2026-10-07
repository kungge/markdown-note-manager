import { useMemo, useState } from "react";
import type { DocumentSummary } from "./types";

interface TreeNode {
  name: string;
  path: string;
  directories: Map<string, TreeNode>;
  documents: DocumentSummary[];
}

function buildTree(documents: DocumentSummary[]): TreeNode {
  const root: TreeNode = { name: "", path: "", directories: new Map(), documents: [] };
  for (const document of documents) {
    const parts = document.path.split("/");
    parts.pop();
    let current = root;
    for (const part of parts) {
      const childPath = current.path ? `${current.path}/${part}` : part;
      if (!current.directories.has(part)) {
        current.directories.set(part, { name: part, path: childPath, directories: new Map(), documents: [] });
      }
      current = current.directories.get(part)!;
    }
    current.documents.push(document);
  }
  return root;
}

function FolderNode({
  node,
  activePath,
  onOpen,
}: {
  node: TreeNode;
  activePath: string;
  onOpen: (path: string) => void;
}) {
  const [open, setOpen] = useState(node.path.split("/").length < 2);
  const directories = [...node.directories.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  const documents = [...node.documents].sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
  return (
    <li>
      {node.path && (
        <button className="tree-folder" onClick={() => setOpen((value) => !value)} title={node.path}>
          <span>{open ? "▾" : "▸"}</span>
          <span>📁</span>
          <span>{node.name}</span>
        </button>
      )}
      {(open || !node.path) && (
        <ul className={node.path ? "tree-children" : "tree-root"}>
          {directories.map((child) => (
            <FolderNode key={child.path} node={child} activePath={activePath} onOpen={onOpen} />
          ))}
          {documents.map((document) => (
            <li key={document.path}>
              <button
                className={`tree-document ${activePath === document.path ? "active" : ""}`}
                onClick={() => onOpen(document.path)}
                title={document.path}
              >
                <span>◫</span>
                <span>{document.title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export function FolderTree({
  documents,
  activePath,
  onOpen,
}: {
  documents: DocumentSummary[];
  activePath: string;
  onOpen: (path: string) => void;
}) {
  const tree = useMemo(() => buildTree(documents), [documents]);
  return (
    <nav className="folder-tree" aria-label="笔记目录">
      <FolderNode node={tree} activePath={activePath} onOpen={onOpen} />
    </nav>
  );
}
