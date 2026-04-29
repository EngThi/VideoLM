# Engine Integration

The external Engine should integrate with VideoLM through the stable HTTPS base URL and the machine-readable manifest.

Base URL:

```text
https://54-162-84-165.sslip.io
```

Manifest:

```text
GET https://54-162-84-165.sslip.io/api/engine/manifest
```

## Recommended Engine Configuration

Environment variable:

```bash
VIDEOLM_BASE_URL=https://54-162-84-165.sslip.io
```

Better: fetch the manifest on startup and use `baseUrl` from the response.

```bash
curl -fsS "$VIDEOLM_BASE_URL/api/engine/manifest"
```

## Public Smoke Test

```bash
curl -fsS "$VIDEOLM_BASE_URL/api/engine/health"
curl -fsS "$VIDEOLM_BASE_URL/api/video/demo/health"
curl -fsS "$VIDEOLM_BASE_URL/api/video/music"
```

## Demo Assembly Contract

Endpoint:

```text
POST /api/video/demo/assemble
```

Request:

```text
multipart/form-data
```

Fields:

```text
audio      required file
images     required file[], max 100
duration   optional number/string
script     optional string
bgMusic    optional file
bgMusicId  optional string
projectId  optional string
```

The endpoint queues work asynchronously. The response includes `projectId` and `statusUrl`.

Polling:

```text
GET /api/video/:projectId/status
```

## Minimal Engine Pseudocode

```ts
const baseUrl = process.env.VIDEOLM_BASE_URL;

const manifest = await fetch(`${baseUrl}/api/engine/manifest`).then(r => r.json());

const form = new FormData();
form.append('projectId', 'engine_job_001');
form.append('duration', '12');
form.append('script', 'Short narration script.');
form.append('audio', audioBlob, 'narration.wav');
form.append('images', scene1Blob, 'scene-001.png');
form.append('images', scene2Blob, 'scene-002.png');

const queued = await fetch(manifest.publicEndpoints.videoDemoAssemble.url, {
  method: 'POST',
  body: form,
}).then(r => r.json());

while (true) {
  const status = await fetch(`${manifest.baseUrl}/api/video/${queued.projectId}/status`).then(r => r.json());
  if (status.status === 'completed' || status.status === 'done') break;
  if (status.status === 'error') throw new Error(status.error || 'VideoLM render failed');
  await new Promise(resolve => setTimeout(resolve, 5000));
}
```

## Research Integration

For NotebookLM research, the Engine can use:

```text
POST /api/research/:projectId/sources
POST /api/research/:projectId/source-files
POST /api/research/:projectId/trigger
GET  /api/research/:projectId/download
POST /api/research/:projectId/assemble
```

Use `profileId` to select a NotebookLM profile. Use `notebookId` when targeting an existing notebook.

Example trigger:

```json
{
  "type": "video",
  "style": "watercolor",
  "liveResearch": false,
  "profileId": "default",
  "notebookId": "optional-existing-notebook-id"
}
```

## Error Handling

The API returns JSON for `/api/...` paths.

If the Engine sees HTML or gets a JSON parser error like `Unexpected token '<'`, the URL is wrong. It is probably calling a frontend route or an outdated tunnel URL.

Use:

```text
/api/engine/manifest
/api/video/demo/health
/api/video/demo/assemble
```

Do not use:

```text
/research
/api/research
trycloudflare.com URLs from old runs
```

## Queue Behavior

Video renders are queued. The current production VM should be treated as a single heavy-render lane. If multiple users submit jobs at once, the first queued job is processed first and later jobs wait in Redis.

The Engine should:

- send a stable `projectId`
- show queued/progress state to users
- poll instead of retrying duplicate jobs
- avoid submitting the same render repeatedly unless the previous job failed
