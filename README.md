# Markdown Note Manager

一个本地优先、文件兼容、Git 友好的 Markdown 笔记工作台。

当前处于 **阶段 0：只读验证版**。应用只读取工作区并建立内存索引，不会修改 Markdown 或附件。

## 当前能力

- 读取指定的本地 Markdown 工作区
- 按真实目录浏览笔记
- 搜索标题、路径和正文，支持中文连续文本
- 安全渲染 GFM、代码高亮、任务列表、Mermaid 和图片
- 监听 VS Code 等外部工具产生的文件变化并刷新
- 只读显示当前分支及工作区范围内的 Git 状态
- 可通过环境变量隐藏敏感目录
- 点目录（例如 `.git`、`.workbuddy`）默认不进入索引或界面
- 后端仅监听 `127.0.0.1`

## 环境要求

- Node.js 22 或更高版本
- pnpm 11
- Git（Git 状态功能需要）

项目从第一阶段开始同时考虑 macOS 和 Windows 路径兼容。

## 本地开发

```bash
pnpm install
cp .env.example .env
```

编辑 `.env`，把 `NOTE_MANAGER_WORKSPACE` 改成实际 NoteHub 绝对路径，然后运行：

```bash
pnpm dev
```

浏览器访问 <http://127.0.0.1:5173>。Vite 会把 `/api` 请求代理到本地服务 `43110` 端口。

也可以不创建 `.env`，直接设置环境变量：

```bash
NOTE_MANAGER_WORKSPACE=/absolute/path/to/NoteHub pnpm dev
```

Windows PowerShell：

```powershell
$env:NOTE_MANAGER_WORKSPACE = "C:\Users\you\notes\NoteHub"
pnpm dev
```

## 构建与运行

```bash
pnpm build
NOTE_MANAGER_WORKSPACE=/absolute/path/to/NoteHub pnpm start
```

构建后访问 <http://127.0.0.1:43110>。

## 验证

```bash
pnpm typecheck
pnpm test
pnpm build
```

## 隐私说明

- 服务默认仅绑定回环地址，不对局域网开放。
- `NOTE_MANAGER_HIDDEN_PATHS` 只控制应用界面和索引中的可见性，不提供磁盘加密。
- Markdown 中的原始 HTML 会经过清理，脚本不会执行。
- 本阶段不包含写文件、Git 提交、拉取或推送能力。

## 文档

- [软件需求分析](kun-doc/01-software-requirements-analysis.md)
- [已确认产品决策](kun-doc/02-confirmed-product-decisions.md)
- [阶段 0 实施说明](kun-doc/03-phase-0-readonly-validation.md)
