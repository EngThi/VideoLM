# Deployment

This project is currently deployed on an Ubuntu EC2 VM with Docker Compose and Caddy.

Production URL:

```text
https://54-162-84-165.sslip.io
```

## Services

```text
videolm_factory  NestJS backend + React static build + FFmpeg
videolm_redis    Redis for BullMQ
videolm_caddy    HTTPS reverse proxy
```

## Required AWS Inbound Rules

The EC2 security group must allow:

```text
TCP 22   SSH, restricted to your IP when possible
TCP 80   HTTP, public, required for Caddy/Let's Encrypt
TCP 443  HTTPS, public, reviewer traffic
```

Port `3001` does not need to be public if Caddy is active.

## Environment

Create `.env` in the repo root:

```bash
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
HF_TOKENS=...
JWT_SECRET=replace-with-a-real-secret
NLM_HOME=/home/ubuntu/.notebooklm-mcp-cli
PUBLIC_BASE_URL=https://54-162-84-165.sslip.io
```

## Deploy

```bash
cd ~/VideoLM
docker compose up -d --build
docker compose ps
```

## Validate

```bash
curl -fsS https://54-162-84-165.sslip.io/api/engine/manifest
curl -fsS https://54-162-84-165.sslip.io/api/video/demo/health
curl -fsS https://54-162-84-165.sslip.io/api/video/music
```

Expected:

```text
HTTP 200 with JSON
```

## Fixed URL Strategy

This deployment uses:

```text
54-162-84-165.sslip.io
```

`sslip.io` maps the hostname to the embedded IP address. Caddy obtains and renews a Let's Encrypt certificate for that hostname.

This is suitable for a short review window as long as:

- the EC2 public IP does not change
- ports `80` and `443` remain open
- the EC2 instance stays running

For longer-term production, allocate an Elastic IP or use a real domain.

## Rebuild After Changes

```bash
docker compose up -d --build videolm
docker compose up -d caddy
```

## Stop

```bash
docker compose down
```

Do not stop the VM while reviewers need access.
