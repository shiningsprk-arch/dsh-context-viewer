# 🕵️ DSH上下文查看器

> **[English README](README.en.md)**

[![Release](https://img.shields.io/github/v/release/shiningsprk-arch/dsh-context-viewer?label=release&color=blue)](https://github.com/shiningsprk-arch/dsh-context-viewer/releases/latest)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-0078d4)
![DSH](https://img.shields.io/badge/DSH-0.1.5%2B-8a2be2)

DeepSeek Harness 桌面上下文查看器（Electron + React）。浏览历史与实时会话的**完整信息**：
思考链、shell 命令（pwsh/bash）、工具调用参数与结果、错误、token 统计、原始事件日志。

![时间线截图：思考链 + 工具调用](docs/screenshot-timeline.png)

## 下载使用

1. 从 [**Releases**](https://github.com/shiningsprk-arch/dsh-context-viewer/releases/latest) 下载 `dsh-context-viewer-win32-x64.zip`
2. 解压后直接运行 `DSHContextViewer.exe`（Windows x64 便携版，免安装）

> 前提：本机 DSH 正在运行（Web UI 默认 `http://127.0.0.1:3080`）。
> 查看器会**自动读取 DSH 启动日志中的 token 完成认证**，无需任何手工配置。

## 功能

- **会话列表**：按 workspace 分组，标题/时间/轮次/步骤/token 统计，运行状态实时标记
- **事件时间线**：用户消息、助手消息/助手尝试（V3，含可折叠思考链）、工具调用卡片（shell 命令高亮）、
  工具结果（含错误）、轮次/步骤边界、流式增量（默认折叠）
- **过滤**：按事件类别（用户/助手/思考/调用/结果/边界/流式/其他）过滤
- **实时视图**：通过 WebSocket 连接运行中的 DSH（`/api/remote.mux` → `session/follow`），新事件实时追加；
  生成中的助手输出显示为"实时生成中"卡片
- **统计面板**：token 用量、上下文压力、工具调用分布、事件类型分布
- **原始日志**：逐事件原始 JSON（可搜索、可全部展开）
- **导出**：Markdown / JSONL / JSON
- **全局搜索**：调用 DSH 的 `session/search` 服务搜索所有会话内容
- **中文界面**，暗色主题

## 兼容性

| DSH 版本 | 查看器版本 |
| --- | --- |
| **0.1.5 及以上**（Typert 协议 + 浏览器认证） | **v0.2.0+**（当前） |
| 0.1.0 ~ 0.1.2（旧版协议） | v0.1.0 |

## 运行前提

- 本机 DSH 正在运行，且版本 ≥ 0.1.5
- Windows x64（便携版）；源码运行需要 Node.js ≥ 22
- 查看器自动从以下日志读取最近一次启动的地址与 token：
  - `%LOCALAPPDATA%\dsh\dsh-web.out.log`（默认位置）
  - `%USERPROFILE%\Desktop\dsh\dsh-service.out.log`（旧版启动脚本位置）
  - 日志里打印的端口会被自动识别，不需要手动配置
- 全局搜索依赖服务端会话索引：profile 的 `session-query-sqlite.openAt` 不能为 `never`
  （建议设为 `first-search`，见下方常见问题）

## 常见问题

**Q：显示"未连接 DSH"或认证失败？**
查看器从 `%LOCALAPPDATA%\dsh\dsh-web.out.log` 最后一行读取启动 token。如果你的 DSH 启动方式不同、
日志不在上述位置，可以提 issue；也可用环境变量 `DSH_CV_BASE_URL` 覆盖服务地址（默认 `http://127.0.0.1:3080`）。

**Q：全局搜索报"session search is disabled"？**
服务端默认关闭了会话索引。在 profile 的 `cordis.patch.yml` 中加入（注意该 patch 是**整段替换**配置，必须带上 `path`）：

```yaml
- id: session-query-sqlite
  config:
    path: ':memory:'
    openAt: first-search
```

**Q：DSH 重启后 127.0.0.1 打不开、提示需要认证？**
这是 DSH Web 本身的浏览器认证机制（token 每次启动都会变），与查看器无关。用日志里最新一行带 `?token=` 的地址在浏览器打开一次即可重新建立信任。

## 开发

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

设置 `DSH_CV_SHOT=<png路径>` 启动应用，主进程会自动检查 DOM 状态、选择会话、
遍历主要视图并截图退出（验证钩子，日常使用不触发）。可用 `DSH_CV_SESSION=<会话ID>` 指定要打开的会话。

```powershell
$env:DSH_CV_SHOT='C:\shot.png'
$env:DSH_CV_SESSION='session-xxxxxxxx-...'
& '.\release\DSHContextViewer-win32-x64\DSHContextViewer.exe'
```

## 数据来源

- 认证：GET `/?token=<启动 token>` 兑换 `dsh-auth-*` cookie，HTTP 与 WebSocket 均携带
- HTTP unary：POST `/api/<endpoint>`（`session/list` / `session/page` / `session/search`），payload 为 `{ args }`
- 实时流：WebSocket `/api/remote.mux`
  - `workspace/follow`：workspace 基线 + 增量（upsert/remove/order/archived）
  - `session/follow`：会话快照（记录+投影）+ 实时事件 + `assistant-stream` 帧
- 会话历史分页：`session/page`（`address` + `throughSeq`(snapshot cursor) + `beforeSeq`）

## 目录结构

```
electron/         主进程（窗口、DSH API 客户端、IPC、实时推送）
shared/           共享类型与标签（main/renderer 共用）
src/              React 渲染层
  components/     组件（时间线、卡片、统计、原始日志、侧边栏…）
  store.tsx       全局状态（会话/事件/过滤/推送归并）
docs/             截图等文档资源
```

## CI / Releases

推送到 `main` 自动构建产物；推送 `v*` tag 会构建并自动发布 GitHub Release（含便携版 zip）：

```powershell
git tag v0.2.0
git push origin v0.2.0
```
