# Architecture

VideoLM Factory is a single production web app with a React frontend, a NestJS backend, Redis-backed render queue, NotebookLM automation, and FFmpeg-based video assembly.

## Runtime Components

```text
Browser
  |
  | HTTPS
  v
Caddy
  |
  | reverse_proxy videolm:3001
  v
NestJS app + static React build
  |
  | queue jobs
  v
Redis + BullMQ
  |
  | render worker
  v
FFmpeg output in server/public/videos
```

## Frontend

Main files:

```text
App.tsx
components/ConfigForm.tsx
components/ResearchDashboard.tsx
components/StatusDisplay.tsx
components/ResultView.tsx
components/IdeaSelector.tsx
services/ffmpegService.ts
services/authService.ts
services/imageService.ts
```

The frontend uses same-origin `/api/...` calls. This means changing the public URL does not require changing frontend fetch calls as long as Caddy and the backend serve the app from the same host.

## Backend

Main modules:

```text
server/src/app.module.ts
server/src/engine
server/src/auth
server/src/projects
server/src/ai
server/src/research
server/src/video
```

Important controllers:

```text
server/src/engine/engine.controller.ts
server/src/research/research.controller.ts
server/src/video/video.controller.ts
server/src/video/video.demo.controller.ts
```

## Render Queue

Heavy renders use BullMQ and Redis. The queue is intentionally treated as a single render lane so concurrent users do not overload the EC2 instance.

Current behavior:

```text
Queue provider: BullMQ
Queue name: video-render
Concurrency: 1
Status endpoint: GET /api/video/:projectId/status
Output path: server/public/videos
Public output URL: /videos/...
```

## NotebookLM Research Flow

The Research Lab supports:

- URL sources
- Existing NotebookLM notebooks
- Uploaded documents
- User-provided NotebookLM cookies/profile JSON
- Default server profile from `~/.notebooklm-mcp-cli`

Flow:

```text
User adds URLs/files/profile
  -> POST /api/research/:projectId/sources or source-files
  -> POST /api/research/:projectId/trigger
  -> NotebookLM CLI automation
  -> GET /api/research/:projectId/download polling
  -> Video artifact is served from /videos or returned as a result URL
```

## Engine Bridge

The external Engine should not hardcode temporary tunnel URLs. It should read:

```text
GET /api/engine/manifest
```

That endpoint returns:

- `baseUrl`
- public demo endpoints
- authenticated endpoints
- research endpoints
- upload limits
- field names
- queue behavior

See [ENGINE_INTEGRATION.md](./ENGINE_INTEGRATION.md).
