# VideoLM Factory

VideoLM Factory is a full-stack video generation workspace. It combines research ingestion, NotebookLM automation, Gemini-compatible generation, FFmpeg rendering, and a queue-backed API that can be used from the web UI or from an external Engine.

Current reviewer URL:

```text
https://54-162-84-165.sslip.io
```

Hosted reviewer demo:

```text
https://54-162-84-165.sslip.io/engine-demo
```

Engine contract:

```text
https://54-162-84-165.sslip.io/api/engine/manifest
```

## What This Repo Contains

- React + Vite frontend for creating videos, running NotebookLM research, uploading sources, and downloading generated artifacts.
- NestJS backend that serves the app and exposes `/api/...` endpoints.
- BullMQ + Redis render queue so heavy FFmpeg jobs run one at a time.
- NotebookLM integration through [`notebooklm-mcp-cli`](https://github.com/jacob-bd/notebooklm-mcp-cli).
- Docker Compose production stack with Caddy HTTPS reverse proxy.
- Public no-auth demo bridge for reviewers and external Engine smoke tests.

## Documentation

- [Architecture](./docs/ARCHITECTURE.md)
- [API Reference](./docs/API.md)
- [NotebookLM Setup](./docs/NOTEBOOKLM_SETUP.md)
- [Engine Integration](./docs/ENGINE_INTEGRATION.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Operations](./docs/OPERATIONS.md)
- [Security Notes](./docs/SECURITY.md)
- [AWS Production Runbook](./AWS_DEPLOY_TRANSPLANT.md)

## Quick Health Check

```bash
export APP_URL="https://54-162-84-165.sslip.io"

curl -fsS "$APP_URL/api/engine/health"
curl -fsS "$APP_URL/api/video/demo/health"
```

Expected response:

```json
{
  "status": "ok",
  "service": "VideoLM Engine Bridge",
  "baseUrl": "https://54-162-84-165.sslip.io",
  "timestamp": "..."
}
```

If a client receives HTML or `Unexpected token '<'`, it is calling a frontend route instead of an API route. API clients must call `/api/...`.

## Recommended Reviewer Path

Start with the hosted demo instead of local setup:

1. Open `https://54-162-84-165.sslip.io/engine-demo`.
2. Play one of the pre-rendered MP4s.
3. Click `Generate demo video` to submit a short deterministic render to the hosted queue.
4. Watch `/api/video/:projectId/status` progress through queue and render stages.

The hosted demo does not require Gemini quota, Pollinations, local FFmpeg, NotebookLM login, or local environment setup. Local installation remains available for developers who want to inspect or extend the system.

## Local Development

Requirements:

- Node.js 20+
- npm
- Redis for queue-backed rendering
- FFmpeg
- Python 3 and `uv` if using NotebookLM locally

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Run frontend and backend together:

```bash
npm run dev
```

Backend only:

```bash
cd server
npm install
npm run dev
```

## NotebookLM Setup

Install the upstream CLI:

```bash
uv tool install notebooklm-mcp-cli
```

Log in with the browser-based flow:

```bash
nlm login
nlm login --check
nlm doctor
```

The default profile stores cookies at:

```text
~/.notebooklm-mcp-cli/profiles/default/cookies.json
```

VideoLM can use that file directly on the server, or users can paste/upload their `cookies.json` in the Research Lab UI. Full setup details are in [docs/NOTEBOOKLM_SETUP.md](./docs/NOTEBOOKLM_SETUP.md).

## Production Docker

Create `.env` in the repo root:

```bash
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
HF_TOKENS=...
JWT_SECRET=replace-this
NLM_HOME=/home/ubuntu/.notebooklm-mcp-cli
PUBLIC_BASE_URL=https://54-162-84-165.sslip.io
```

Start the stack:

```bash
docker compose up -d --build
```

Expected containers:

```text
videolm_factory
videolm_redis
videolm_caddy
```

Caddy serves HTTPS on port `443` and reverse-proxies to the app container on port `3001`.

## Public Demo Flow

The no-auth demo bridge is intended for reviewers and external Engine integration tests.

```text
GET  /engine-demo
GET  /api/engine/manifest
GET  /api/video/demo/health
POST /api/video/demo/assemble
GET  /api/video/:projectId/status
GET  /videos/*.mp4
```

`POST /api/video/demo/assemble` expects `multipart/form-data`:

```text
audio      required WAV/MP3 narration file
images     required JPG/PNG/WebP scene files, up to 100
script     optional script text for captions
bgMusic    optional background music upload
bgMusicId  optional file name from server/data/music
projectId  optional stable id from the external Engine
```

Use [docs/API.md](./docs/API.md) for exact request and response shapes.

## Validation

```bash
npm run build
cd server && npm test -- --runInBand
curl -fsS https://54-162-84-165.sslip.io/api/engine/manifest
curl -fsS https://54-162-84-165.sslip.io/api/video/demo/health
```

## Important Paths

```text
App.tsx                         Main React shell
components/ResearchDashboard.tsx NotebookLM research UI
services/ffmpegService.ts        Browser-side video assembly client
server/src/engine                Engine manifest and health endpoints
server/src/research              NotebookLM research API
server/src/video                 FFmpeg render API and queue bridge
server/public/videos             Generated video files
server/data/database.sqlite      SQLite database
docker-compose.yml               Production services
Caddyfile                        HTTPS reverse proxy
```

## Cost And Runtime Notes

This stack is CPU-bound and can run without a GPU. For a short review window, the main AWS costs are EC2 instance hours, EBS disk, snapshots, data transfer, and public IPv4. Stop unrelated VMs, keep one production VM online, and set a billing alert.
