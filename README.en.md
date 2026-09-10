# 🕵️ DSH Context Viewer

A desktop context viewer for **DeepSeek Harness** (Electron + React). Browse the **complete
information** of historical and live sessions: chain-of-thought (reasoning), shell commands
(pwsh/bash), tool call arguments & results, errors, token statistics, and the raw event log.

> **[中文版 README](README.md)**

## Features

- **Session list**: grouped by workspace, with title / time / turns / steps / token stats and live running status
- **Event timeline**: user messages, assistant messages / attempts (V3, with collapsible chain-of-thought),
  tool call cards (shell commands highlighted), tool results (including errors),
  turn/step boundaries, streaming deltas (collapsed by default)
- **Filtering**: filter events by category (user / assistant / thinking / calls / results / boundaries / streaming / other)
- **Live view**: connects to a running DSH over WebSocket (`/api/remote.mux` → `session/follow`), new events
  are appended in real time; in-progress output shows as a "live" card
- **Stats panel**: token usage, context pressure, tool call distribution, event type distribution
- **Raw log**: per-event raw JSON (searchable, expand-all)
- **Export**: Markdown / JSONL / JSON
- **Global search**: uses DSH's `session/search` service to search across all sessions
- **Chinese UI**, dark theme

> **Compatibility**: this version targets **DSH 0.1.5+** (Typert protocol + browser auth).
> For older DSH releases (0.1.0–0.1.2) use the v0.1.0 Release.

## Prerequisites

- A running DSH host (Web UI defaults to http://127.0.0.1:3080)
- Node.js ≥ 22 (development and runtime)
- The viewer reads the launch token automatically from:
  - `%LOCALAPPDATA%\dsh\dsh-web.out.log` (default)
  - `%USERPROFILE%\Desktop\dsh\dsh-service.out.log` (legacy script location)
  - set `DSH_CV_BASE_URL` to override the server address
- Global search requires the server session index: `session-query-sqlite.openAt` must not be
  `never` (use `first-search`)

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
> `release/DSHContextViewer-win32-x64/`.)

## Automated verification

Set `DSH_CV_SHOT=<png path>` when starting the app and the main process will inspect the
DOM, select a session, walk through the main views, take a screenshot, and quit
(verification hook; not triggered in normal use). Use `DSH_CV_SESSION=<session id>` to
open a specific session.

```powershell
$env:DSH_CV_SHOT='C:\shot.png'
$env:DSH_CV_SESSION='session-xxxxxxxx-...'
& '.\release\DSHContextViewer-win32-x64\DSHContextViewer.exe'
```

## Data sources

- Auth: GET `/?token=<launch token>` to mint a `dsh-auth-*` cookie, sent on HTTP and WebSocket
- HTTP unary: `POST /api/<endpoint>` (`session/list` / `session/page` / `session/search`), payload `{ args }`
- Live streams: WebSocket `/api/remote.mux`
  - `workspace/follow`: workspace baseline + increments (upsert/remove/order/archived)
  - `session/follow`: session snapshot (records + projections) + live events + `assistant-stream` frames
- History pagination: `session/page` (`address` + `throughSeq` from the snapshot cursor + `beforeSeq`)

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
git tag v0.2.0
git push origin v0.2.0
```

Download the latest release: <https://github.com/shiningsprk-arch/dsh-context-viewer/releases>