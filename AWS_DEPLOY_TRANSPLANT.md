# AWS Production Runbook

This runbook documents the current EC2 deployment used for review.

Production URL:

```text
https://54-162-84-165.sslip.io
```

Engine manifest:

```text
https://54-162-84-165.sslip.io/api/engine/manifest
```

## Target Runtime

```text
Host: Ubuntu EC2
App: Docker Compose
Frontend/backend: videolm_factory
Queue: Redis
Proxy: Caddy
HTTPS: Let's Encrypt through Caddy
NotebookLM CLI: notebooklm-mcp-cli
```

## Required Files

```text
.env
Caddyfile
docker-compose.yml
server/data/
server/public/videos/
server/cache/
~/.notebooklm-mcp-cli/profiles/default/cookies.json
```

Do not commit `.env`, PEM keys, NotebookLM cookies, SQLite databases, generated videos, or logs.

## Environment

Create `.env` in the deployment directory:

```bash
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
HF_TOKENS=...
JWT_SECRET=replace-with-a-long-random-secret
PUBLIC_BASE_URL=https://54-162-84-165.sslip.io
NLM_HOME=/home/ubuntu/.notebooklm-mcp-cli
```

## NotebookLM Login

Install the CLI:

```bash
uv tool install notebooklm-mcp-cli
```

Log in:

```bash
nlm login
nlm login --check
nlm doctor
```

Expected cookie path:

```text
/home/ubuntu/.notebooklm-mcp-cli/profiles/default/cookies.json
```

See [docs/NOTEBOOKLM_SETUP.md](./docs/NOTEBOOKLM_SETUP.md) for the full guide.

## AWS Security Group

Inbound rules:

```text
22   TCP  SSH, restricted to your IP when possible
80   TCP  HTTP, public, needed for Caddy certificate issuance
443  TCP  HTTPS, public reviewer access
```

The app listens on `3001` inside the VM. It does not need to be exposed publicly when Caddy is active.

## Deploy

```bash
cd ~/VideoLM
docker compose up -d --build
docker compose ps
```

Expected containers:

```text
videolm_factory
videolm_redis
videolm_caddy
```

## Validate

```bash
curl -fsS https://54-162-84-165.sslip.io/api/engine/health
curl -fsS https://54-162-84-165.sslip.io/api/engine/manifest
curl -fsS https://54-162-84-165.sslip.io/api/video/demo/health
curl -fsS https://54-162-84-165.sslip.io/api/video/music
```

Expected:

```text
HTTP 200
Content-Type: application/json
```

If a client sees `Unexpected token '<'`, it is parsing HTML from a frontend route. API clients must call `/api/...`.

## Public Reviewer Endpoints

```text
GET  /api/engine/health
GET  /api/engine/manifest
GET  /api/video/demo/health
POST /api/video/demo/assemble
GET  /api/video/:projectId/status
```

The demo assembly endpoint accepts `multipart/form-data`:

```text
audio      required file
images     required file[], max 100
duration   optional number/string
script     optional string
bgMusic    optional file
bgMusicId  optional string
projectId  optional string
```

## Logs

```bash
docker logs --tail=200 -f videolm_factory
docker logs --tail=200 -f videolm_caddy
docker logs --tail=200 -f videolm_redis
```

## Rebuild

```bash
cd ~/VideoLM
docker compose up -d --build videolm
docker compose up -d caddy
```

## Disk Cleanup

```bash
find server/public/videos -type f -mtime +3 -delete
find server/cache -type f -mtime +3 -delete
docker system prune -f
```

## Review Window Notes

For a short review window, keep only the production VM running. The main costs are EC2 time, EBS storage, public IPv4, snapshots, and data transfer. Set a billing alert and stop unrelated instances.
