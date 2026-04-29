# Security Notes

This repository handles API keys, NotebookLM cookies, generated media, and user uploads. Treat the production VM as a private deployment even when the reviewer URL is public.

## Do Not Commit

Do not commit:

```text
.env
SECRETS/
*.pem
cookies.json
server/data/database.sqlite
server/public/videos/
server/cache/
server/backend.log
```

## NotebookLM Cookies

`cookies.json` grants access to a Google session. Treat it like a password.

Recommended practices:

- use a dedicated demo Google account
- avoid sharing personal account cookies
- rotate or re-login after the review window
- remove stale profiles from the server when no longer needed

## Public Demo Endpoint

`/api/video/demo/assemble` is intentionally public for reviewers and external Engine smoke tests. It can consume CPU, disk, and bandwidth.

For a longer production period:

- add a shared reviewer token
- rate-limit public demo endpoints
- restrict max duration
- monitor disk usage
- consider disabling the public demo bridge after review

## Authenticated Endpoints

The full app uses JWT auth for `/api/video/assemble`. Keep `JWT_SECRET` private and set a real production value.

## AWS Exposure

Recommended inbound rules:

```text
22   SSH, restrict to your IP if possible
80   public, needed by Caddy and Let's Encrypt
443  public, app traffic
```

Avoid exposing Redis publicly. Redis is only needed inside Docker networking.
