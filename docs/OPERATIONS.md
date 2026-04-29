# Operations

## Common Commands

Check containers:

```bash
docker compose ps
```

View app logs:

```bash
docker logs --tail=200 -f videolm_factory
```

View Caddy logs:

```bash
docker logs --tail=200 -f videolm_caddy
```

Restart the app:

```bash
docker compose restart videolm
```

Rebuild the app:

```bash
docker compose up -d --build videolm
```

## Health Checks

```bash
curl -fsS https://54-162-84-165.sslip.io/api/engine/health
curl -fsS https://54-162-84-165.sslip.io/api/video/demo/health
```

## Disk Usage

Generated videos and caches can fill a small VM.

Check:

```bash
df -h
du -sh server/public/videos server/cache server/data
```

Clean old generated files:

```bash
find server/public/videos -type f -mtime +3 -delete
find server/cache -type f -mtime +3 -delete
docker system prune -f
```

## NotebookLM Session Check

On the host:

```bash
nlm login --check
nlm doctor
```

Inside Docker:

```bash
docker compose exec videolm ls -l /root/.notebooklm-mcp-cli/profiles/default/cookies.json
```

If the session is expired:

```bash
nlm login
docker compose restart videolm
```

## Queue Behavior

The render queue should be treated as one heavy worker. If several users submit renders at once, later jobs wait.

For user-facing progress:

```bash
curl -fsS "$APP_URL/api/video/<projectId>/status"
```

Do not restart the app during an important active render unless the job is stuck.

## Symptoms And Fixes

### Browser opens but API client fails with HTML

The client is calling the wrong URL. Use `/api/...`.

Check:

```bash
curl -i "$APP_URL/api/engine/manifest"
```

### Caddy cannot issue certificate

Check AWS inbound rules for ports `80` and `443`.

```bash
docker logs --tail=200 videolm_caddy
```

### Render jobs never finish

Check app logs:

```bash
docker logs --tail=300 videolm_factory
```

Check disk:

```bash
df -h
```

Check Redis:

```bash
docker logs --tail=100 videolm_redis
```

### NotebookLM notebooks do not load

Check the profile cookies and run:

```bash
nlm login --check
nlm doctor
```
