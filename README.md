# 🕵️ DSH上下文查看器

> **[English README](README.en.md)**

DeepSeek Harness 桌面上下文查看器（Electron + React）。浏览历史与实时会话的**完整信息**：
思考链、shell 命令（pwsh/bash）、工具调用参数与结果、错误、token 统计、原始事件日志。

## 功能

- **会话列表**：按 workspace 分组，标题/时间/轮次/步骤/token 统计，运行状态实时标记
- **事件时间线**：用户消息、助手消息（含可折叠思考链）、工具调用卡片（shell 命令高亮）、
  工具结果（含错误）、轮次/步骤边界、流式增量（默认折叠）
- **过滤**：按事件类别（用户/助手/思考/调用/结果/边界/流式/其他）过滤
- **实时视图**：通过 WebSocket 连接运行中的 DSH（/api/events.mux），新事件实时追加
- **统计面板**：token 用量、上下文压力、工具调用分布、事件类型分布
- **原始日志**：逐事件原始 JSON（可搜索、可全部展开），含 host 计算的 tool view
- **导出**：Markdown / JSONL / JSON
- **全局搜索**：调用 DSH 的 session.search 服务搜索所有会话内容
- **中文界面**，暗色主题

## 运行前提

- 本机 DSH 正在运行（Web UI 默认在 http://127.0.0.1:3080）
- Node.js ≥ 22（开发与运行）

## 使用

```bash
# 安装依赖（首次需下载 Electron；国内可用 npmmirror 镜像：
#   $env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
#   npm install --registry=https://registry.npmmirror.com）
npm install

# 开发模式（Vite HMR + Electron）
npm run dev

# 构建并启动
npm start

# 打包为 Windows 便携版（输出到 release/）
npm run pack
```

> 若 electron-packager 因网络失败，可用本地脚本手工组装便携版：
> ```powershell
> powershell -ExecutionPolicy Bypass -File pack-manual.ps1
> ```
> （复制 Electron 运行时 + dist 产物 + ws 依赖到 release/DSHContextViewer-win32-x64/）

## 自动化验证

设置 `DSH_CV_SHOT=<png路径>` 启动应用，主进程会自动检查 DOM 状态、模拟选择首个会话、
遍历主要视图并截图退出（验证钩子，日常使用不触发）。

```powershell
$env:DSH_CV_SHOT='C:\shot.png'
& '.\release\DSH上下文查看器-win32-x64\DSH上下文查看器.exe'
```

## 数据来源

- HTTP API：POST /api/<method>（workspace.list / session.list / session.history / session.search）
- 实时流：WebSocket /api/events.mux、/api/events.host
- 事件日志落盘：`~/.dsh/sessions/<workspace>/<session-id>/session.jsonl.zstd`

## 目录结构

```
electron/         主进程（窗口、DSH API 客户端、IPC、实时推送）
shared/           共享类型与标签（main/renderer 共用）
src/              React 渲染层
  components/     组件（时间线、卡片、统计、原始日志、侧边栏…）
  store.tsx       全局状态（会话/事件/过滤/推送归并）
```