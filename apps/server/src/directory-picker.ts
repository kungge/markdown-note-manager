import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class DirectoryPickerUnavailableError extends Error {}

function isCancellation(error: unknown): boolean {
  const detail = error as { code?: number | string; stderr?: string; message?: string };
  const text = `${detail.stderr ?? ""}\n${detail.message ?? ""}`;
  return detail.code === 1 && /cancel|取消|canceled|cancelled|user canceled/i.test(text);
}

async function selectOnMac(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'POSIX path of (choose folder with prompt "选择 Markdown 工作区")',
    ]);
    return stdout.trim().replace(/\/$/, "") || null;
  } catch (error) {
    if (isCancellation(error)) return null;
    throw error;
  }
}

async function selectOnWindows(): Promise<string | null> {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
    "$dialog.Description = '选择 Markdown 工作区'",
    "$dialog.ShowNewFolderButton = $false",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
    "  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "  Write-Output $dialog.SelectedPath",
    "}",
  ].join("; ");
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-STA",
    "-NonInteractive",
    "-Command",
    script,
  ]);
  return stdout.trim() || null;
}

async function selectOnLinux(): Promise<string | null> {
  const candidates: Array<[string, string[]]> = [
    ["zenity", ["--file-selection", "--directory", "--title=选择 Markdown 工作区"]],
    ["kdialog", ["--getexistingdirectory", ".", "--title", "选择 Markdown 工作区"]],
  ];

  for (const [command, args] of candidates) {
    try {
      const { stdout } = await execFileAsync(command, args);
      return stdout.trim() || null;
    } catch (error) {
      const detail = error as { code?: number | string };
      if (detail.code === 1) return null;
      if (detail.code !== "ENOENT") throw error;
    }
  }
  throw new DirectoryPickerUnavailableError(
    "当前 Linux 桌面未安装目录选择器，请安装 zenity 或 kdialog，或通过 NOTE_MANAGER_WORKSPACE 配置工作区。",
  );
}

export async function selectWorkspaceDirectory(): Promise<string | null> {
  if (process.platform === "darwin") return selectOnMac();
  if (process.platform === "win32") return selectOnWindows();
  if (process.platform === "linux") return selectOnLinux();
  throw new DirectoryPickerUnavailableError(
    "当前操作系统暂不支持图形化目录选择，请通过 NOTE_MANAGER_WORKSPACE 配置工作区。",
  );
}
