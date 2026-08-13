# 🕵️ DSH Context Viewer

A desktop context viewer for **DeepSeek Harness** (Electron + React). Browse the **complete
information** of historical and live sessions: chain-of-thought (reasoning), shell commands
(pwsh/bash), tool call arguments & results, errors, token statistics, and the raw event log.

> **[中文版 README](README.md)**

## Features

- **Session list**: grouped by workspace, with title / time / turns / steps / token stats and live running status
- **Event timeline**: user messages, assistant messages (with collapsible chain-of-thought),
  tool call cards (shell commands highlighted), tool results (including errors),
  turn/step boundaries, streaming deltas (collapsed by default)
- **Filtering**: filter events by category (user / assistant / thinking / calls / results / boundaries / streaming / other)
- **Live view**: connects to a running DSH over WebSocket (`/api/events.mux`), new events are appended in real time
- **Stats panel**: token usage, context pressure, tool call distribution, event type distribution
- **Raw log**: per-event raw JSON (searchable, expand-all), including the host-computed tool view
- **Export**: Markdown / JSONL / JSON
- **Global search**: uses DSH's `session.search` service to search across all sessions
- **Chinese UI**, dark theme

> **Note for code-mode sessions**: shell commands executed inside `run_code` appear as
> `tool/code-dispatch` events (e.g. `pwsh` sub-calls). The viewer renders these as
> highlighted shell-command cards, so you see every command that actually ran.

## Prerequisites

- A running DSH host (Web UI defaults to http://127.0.0.1:3080)
- Node.js ≥ 22 (development and runtime)

## Usage

```bash
# Install dependencies (Electron is downloaded on first install;
# in mainland China you can use the npmmirror mirror:
#   $env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
#   npm install --registry=https://registry.npmmirror.com)
npm install

# Dev mode (Vite HMR + Electron)
npm run dev

# Build and start
npm start

# Package a Windows portable build (outputs to release/)
npm run pack
```

> If `electron-packager` fails due to network issues, you can assemble the portable
> build with the local script:
> ```powershell
> powershell -ExecutionPolicy Bypass -File pack-manual.ps1
> ```
> (Copies the Electron runtime + dist output + the ws dependency into
> `release/DSH上下文查看器-win32-x64/`.)

## Automated verification

Set `DSH_CV_SHOT=<png path>` when starting the app and the main process will inspect the
DOM, click the first session, walk through the main views, take a screenshot, and quit
(verification hook; not triggered in normal use).

```powershell
$env:DSH_CV_SHOT='C:\shot.png'
& '.\release\DSH上下文查看器-win32-x64\DSH上下文查看器.exe'
```

## Data sources

- HTTP API: `POST /api/<method>` (`workspace.list` / `session.list` / `session.history` / `session.search`)
- Live streams: WebSocket `/api/events.mux`, `/api/events.host`
- Durable event log: `~/.dsh/sessions/<workspace>/<session-id>/session.jsonl.zstd`

## Project layout

```
electron/         Main process (window, DSH API client, IPC, live push)
shared/           Shared types & labels (main/renderer)
src/              React renderer
  components/     Components (timeline, cards, stats, raw log, sidebar …)
  store.tsx       Global state (sessions/events/filter/push merging)
```

## CI / Releases

GitHub Actions builds the Windows portable build on every push to `main` (artifact) and
creates a GitHub **Release** with the packaged zip when a `v*` tag is pushed:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

Download the latest release: <https://github.com/shiningsprk-arch/dsh-context-viewer/releases>
