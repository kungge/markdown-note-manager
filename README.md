# Markdown Note Manager

一个本地优先、文件兼容、Git 友好的 Markdown 笔记工作台。

当前处于 **阶段 0：只读验证版**。应用只读取工作区并建立内存索引，不会修改 Markdown 或附件。

## 当前能力

- 读取指定的本地 Markdown 工作区
- 在页面中调用系统目录选择器选择或更换工作区
- 实时显示扫描进度、索引数量、跳过原因和错误文件报告
- 按真实目录浏览笔记
- 搜索标题、路径和正文，支持中文连续文本
- 安全渲染 GFM、代码高亮、任务列表、Mermaid 和图片
- 监听 VS Code 等外部工具产生的文件变化并刷新
- 只读显示当前分支及工作区范围内的 Git 状态
- 将当前文章导出为独立 HTML，或通过系统打印窗口保存为 PDF
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
pnpm dev
```

浏览器访问 <http://127.0.0.1:5173>，点击“选择工作区”，再通过系统目录选择器选择 NoteHub 目录。Vite 会把 `/api` 请求代理到本地服务 `43110` 端口。

也可以复制 `.env.example`，通过 `NOTE_MANAGER_WORKSPACE` 配置启动时默认打开的工作区：

```bash
cp .env.example .env
```

或者直接设置环境变量：

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

## 更新日志

项目暂未发布正式版本，当前按日期记录重要变更；提交哈希用于对应 Git 历史。

### 未发布

- 功能：增加扫描状态与问题报告；扫描过程实时展示当前路径和统计结果，单个文件读取失败不再中断整个工作区扫描。
- 功能：增加工作区图形化选择；未配置环境变量时可直接启动应用，通过系统目录选择器选择或更换本地工作区。
- 文档：在 README 中增加更新日志和维护约定，集中展示项目演进记录。

### 2026-10-09

- 部署：增加阿里云 ECS 部署脚本、systemd 服务和 Nginx 配置，并补充完整部署文档（`85736c6`）。
- 修复：强化 ECS 部署流程，增加独立 Nginx 配置、环境变量示例和部署验证（`fe06655`）。

### 2026-10-07

- 功能：完成阶段 0 只读工作区基础能力，包括目录浏览、全文搜索、Markdown 安全预览、外部文件变化刷新、Git 状态和敏感目录隐藏（`187df4e`）。
- 功能：增强阅读体验，增加文章大纲、文内检索、阅读进度、返回顶部、源码视图、章节链接和暗色模式（`5797f33`）。
- 功能：增加当前笔记的独立 HTML 导出和浏览器打印 PDF，并支持本地及远程图片内嵌（`26d0ccb`）。
- 修复：服务启动时显式读取项目根目录的 `.env` 文件（`25b9c95`）。

### 2026-10-05

- 项目：初始化仓库并加入许可证（`b272d6e`）。

### 更新日志维护约定

- 后续每次功能、修复、安全、性能、部署、配置或文档更新，都必须同步更新本节。
- 开发中的变更先写入“未发布”；形成明确里程碑或发布版本后，再移动到对应日期或版本标题下。
- 日志应从使用者角度说明变化及影响；存在不兼容调整、配置迁移或额外操作时必须明确标注。
- 纯内部重构也应记录；如果完全不影响行为，可以使用简短说明。

## 文档

- [软件需求分析](kun-doc/01-software-requirements-analysis.md)
- [已确认产品决策](kun-doc/02-confirmed-product-decisions.md)
- [阶段 0 实施说明](kun-doc/03-phase-0-readonly-validation.md)
- [阶段 0 阅读体验增强](kun-doc/04-phase-0-reading-experience.md)
- [阶段 0 离线导出](kun-doc/05-phase-0-offline-export.md)
