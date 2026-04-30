# Ship Submission

## Ship message

I built LM Engine, a production-ready video and research artifact factory that turns sources, NotebookLM outputs, and generated media into reviewer-friendly videos and infographics. It includes a SaaS-style frontend, a stable HTTPS deployment on AWS, a public Engine bridge, browser-saved user API key settings, NotebookLM profile/cookie support, and an FFmpeg render pipeline that applies the EngThi Engine branding overlay to generated videos and infographics.

The hardest part was making the whole system feel reliable end to end instead of just having separate demos. I had to connect the frontend, backend, NotebookLM CLI workflow, Gemini/OpenRouter-style API settings, queue-based rendering, Caddy HTTPS, and EC2 deployment into one flow that reviewers can actually open and test. I also had to fix cases where AI responses were not valid JSON, replace temporary tunnel URLs with a stable production URL, and make sure generated artifacts download as real MP4/PNG files instead of failing silently.

I am proud that it now works as a real shipped system: reviewers can open the hosted app, test the public demo video bridge, inspect the Engine manifest, generate/download rendered artifacts, and read the docs for local setup, NotebookLM login, API keys, deployment, operations, and security.

## Review Instructions

Production URL:

https://54-162-84-165.sslip.io

Useful public checks:

- Engine health: https://54-162-84-165.sslip.io/api/engine/health
- Engine manifest: https://54-162-84-165.sslip.io/api/engine/manifest
- Demo video bridge health: https://54-162-84-165.sslip.io/api/video/demo/health

Generated artifacts to verify:

- 1 minute MP4 render: https://54-162-84-165.sslip.io/videos/one_minute_brand_demo_1777509382_1777509382929.mp4
- Infographic 1: https://54-162-84-165.sslip.io/videos/lm_engine_flow.png
- Infographic 2: https://54-162-84-165.sslip.io/videos/reviewer_readiness.png
- Infographic 3: https://54-162-84-165.sslip.io/videos/notebooklm_outputs.png

What to test in the app:

- Open the hosted URL and inspect the LM Engine section.
- Try the Create Video flow with a short script and generated/uploaded images.
- Open Settings and confirm user API keys can be saved in browser storage.
- Check the docs linked from the README for local setup, deployment, Engine integration, NotebookLM profile setup, and operations.

Local setup:

```bash
npm install
npm run build
npm test -- --runInBand
npm run dev
```

NotebookLM setup, if testing that integration locally:

```bash
uv tool install notebooklm-mcp-cli
nlm login
nlm login --check
```

The hosted demo already has the server-side deployment configured. User-provided API keys are optional in the browser Settings page; if a reviewer does not add keys, the app falls back to the configured server environment where available.
