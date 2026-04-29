# API Reference

Base URL:

```text
https://54-162-84-165.sslip.io
```

Current machine-readable contract:

```text
GET /api/engine/manifest
```

## Engine Endpoints

### GET `/api/engine/health`

Returns the current public base URL and health status.

```bash
curl -fsS https://54-162-84-165.sslip.io/api/engine/health
```

### GET `/api/engine/manifest`

Returns the integration contract for external clients.

```bash
curl -fsS https://54-162-84-165.sslip.io/api/engine/manifest
```

External clients should prefer this endpoint over hardcoded docs.

## Public Demo Video Endpoints

These endpoints are no-auth and intended for reviewers or external Engine smoke tests.

### GET `/api/video/demo/health`

```bash
curl -fsS https://54-162-84-165.sslip.io/api/video/demo/health
```

### POST `/api/video/demo/assemble`

Starts an asynchronous FFmpeg render job.

Request type:

```text
multipart/form-data
```

Fields:

```text
audio      file, required, WAV/MP3 narration
images     file[], required, JPG/PNG/WebP scene images, max 100
duration   number or string, optional
script     string, optional
bgMusic    file, optional, MP3/WAV background music
bgMusicId  string, optional, file name from server/data/music
projectId  string, optional, stable external id
```

Example:

```bash
curl -fsS -X POST "$APP_URL/api/video/demo/assemble" \
  -F "projectId=engine_smoke_001" \
  -F "duration=12" \
  -F "script=Short demo script." \
  -F "audio=@./narration.wav" \
  -F "images=@./scene-001.png" \
  -F "images=@./scene-002.png"
```

Response:

```json
{
  "message": "Video assembly queued — use /status to track progress",
  "projectId": "engine_smoke_001",
  "videoUrl": "/videos/...",
  "statusUrl": "/api/video/engine_smoke_001/status"
}
```

### GET `/api/video/:projectId/status`

Polls the render status.

```bash
curl -fsS "$APP_URL/api/video/engine_smoke_001/status"
```

Possible status values include:

```text
queued
processing
completed
done
error
```

When complete, the response includes a video URL or path.

## Auth Endpoints

### POST `/api/auth/register`

```json
{
  "email": "user@example.com",
  "password": "strong-password"
}
```

### POST `/api/auth/login`

```json
{
  "email": "user@example.com",
  "password": "strong-password"
}
```

Authenticated endpoints expect:

```text
Authorization: Bearer <jwt>
```

## Authenticated Video Endpoint

### POST `/api/video/assemble`

Same payload shape as `/api/video/demo/assemble`, but requires a JWT.

Use this for the main app flow. Use the demo endpoint for public reviewer smoke tests.

## Research Endpoints

### GET `/api/research/nlm/profiles`

Lists NotebookLM profiles known to the server.

### POST `/api/research/nlm/profiles`

Saves user-provided NotebookLM cookies.

Body:

```json
{
  "profileId": "default",
  "cookiesJson": "[...]"
}
```

or:

```json
{
  "profileId": "default",
  "cookies": []
}
```

### GET `/api/research/nlm/notebooks?profileId=default`

Lists notebooks for a NotebookLM profile.

### GET `/api/research/nlm/notebooks/:notebookId/sources?profileId=default`

Lists sources inside a notebook.

### POST `/api/research/:projectId/sources`

Adds URL sources to a project.

```json
{
  "urls": ["https://hackclub.com/"]
}
```

### POST `/api/research/:projectId/source-files`

Adds uploaded documents to an existing notebook.

Request type:

```text
multipart/form-data
```

Fields:

```text
files       file[], required, max 12
notebookId  string, required
profileId   string, optional
```

### POST `/api/research/:projectId/trigger`

Starts NotebookLM generation.

```json
{
  "type": "video",
  "style": "watercolor",
  "liveResearch": false,
  "notebookId": "optional-existing-notebook-id",
  "profileId": "default"
}
```

Supported style values:

```text
auto_select
classic
whiteboard
watercolor
anime
kawaii
retro_print
heritage
paper_craft
custom
```

### GET `/api/research/:projectId/download`

Polls NotebookLM output download status.

### POST `/api/research/:projectId/assemble`

Assembles a research-derived final video.

## Avoiding HTML Responses

Only `/api/...` paths are API paths. Frontend paths return HTML.

Wrong:

```text
/research
/api/research
```

Right:

```text
/api/research/:projectId/sources
/api/research/:projectId/trigger
/api/research/:projectId/download
```
