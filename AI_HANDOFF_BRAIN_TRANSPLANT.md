# 🧠 AI HANDOFF: BRAIN TRANSPLANT (VideoLM / YouTubeVideoMaster)

> **CRITICAL DIRECTIVE FOR THE RECEIVING AI:** 
> Read this entire document before writing a single line of code or making any assumptions. This is the complete neural mapping of the project, the user's persona, the Hack Club context, and the technical architecture up to **April 23, 2026**.

---

## 🎯 1. META-CONTEXT & DEADLINES
*   **Project Name:** VideoLM (formerly YouTubeVideoMaster - Flavortown Edition)
*   **Author Persona:** EngThi / ChefThi
*   **Target Audience:** Hack Club Flavortown Reviewers & the Open Source Community.
*   **Core Philosophy:** "Useful Open Source Engineering" > "Generic SaaS". It must solve real problems transparently.
*   **Hard Deadline:** April 25th, 2026. (Currently 48 hours away).
*   **Goal:** Deploy a 24/7 VM where reviewers can test the pipeline end-to-end without crashing.

## 🗣️ 2. THE PERSONA & COMMUNICATION STYLE
When talking to the user or writing DevLogs, adopt the **"Senior/Hacker"** or **"Jr Esperto" (Smart Junior)** persona:
*   **Tone:** Highly technical, direct, confident, but collaborative. Speak in Portuguese or English depending on the prompt, but DevLogs are in English.
*   **Structure:** Always highlight the **"Technical Win"**. Explain *why* something broke and *how* you engineered a robust solution (e.g., "Added a fallback," "Resolved a circular dependency").
*   **No Fluff:** Don't just say "I fixed it". Say "I implemented an automated housekeeping worker to prevent VM disk exhaustion."

## 🏗️ 3. ARCHITECTURE DEEP DIVE (THE TECH SAUCE)
This is a hybrid, multi-layered orchestrator.

### 🔌 Stack:
*   **Frontend:** React + Vite + TailwindCSS. Runs on port `5173` (or `9002` in Google IDX).
*   **Backend:** NestJS + TypeORM + SQLite. Runs on port `3001`. Payload limit increased to 100MB.
*   **Research Engine:** Python CLI (`notebooklm-mcp-cli` via `uvx`). Acts as a bridge to Google Studio.
*   **Media Engine:** `fluent-ffmpeg` wrapping `ffmpeg-static`.

### 🤖 AI Arsenal:
*   **Orchestration & Text:** `gemini-3-flash-preview` (The brain).
*   **Storyboard Generation:** Gemini 3 Flash reads NLM sources and generates 10 cinematic prompts.
*   **Image Generation:** `gemini-2.5-flash-image` -> Fallback: `FLUX.1-schnell` (HF) -> **Final Unbreakable Fallback:** `Pollinations Turbo` (URL-based, no quota limits).
*   **Video Generation (Veo Lab):** `gemini-3-flash-preview` (Modalities: `["VIDEO"]`).

## ⚙️ 4. CORE WORKFLOWS (HOW IT WORKS)

### A. The "Premium" Cinematic Flow (NotebookLM Native)
1. User pastes URLs in the **Research Dashboard**.
2. Backend uses Python CLI to create a Notebook and `add url`.
3. Backend triggers `createVideoOverview` passing a style (`watercolor`, `anime`, `classic`).
4. **Smart Polling:** `test_full_research.ts` or the frontend polls `/api/research/:id/download`.
5. **Intelligent Selection:** Backend prioritizes `.mp4` (video) over `.m4a` (audio) and downloads the 50MB+ file to `public/videos/`.

### B. The Factual Assembly Flow (FFmpeg)
If native video isn't used, the system falls back to generating images from the storyboard and stitching them with the research audio.
*   **Cinema Transitions:** 1-second crossfades (`xfade`) and smooth Ken Burns effects applied via complex filter graphs.

### C. ZIP Dev Mode (Instant Asset Injection)
For rapid UI testing without burning API quotas.
1. User uploads a `.zip` (script.txt, audio.wav, images).
2. Frontend `JSZip` extracts everything into Blob URLs.
3. Pipeline bypasses SCRIPT, AUDIO, and VISUAL AI generation stages.
4. Blobs are sent via `FormData` directly to the `assembleVideo` endpoint.

## 🚨 5. CRITICAL FIXES & HACKS (DO NOT REVERT)
These were hard-fought victories. If you break them, the factory dies.

1.  **Persistence Hack:** `server/src/app.module.ts` has the SQLite database path **hardcoded** to an absolute/relative path (`./data/database.sqlite`). Do not revert to purely `process.env` without ensuring Docker volume mapping works.
2.  **Circular Dependency:** `AiModule` and `VideoModule` depend on each other. This was fixed using `@Inject(forwardRef(() => ...))` in both the modules and the service constructors.
3.  **Auto-Pilot Housekeeping:** `server/src/main.ts` runs a `setInterval` every 1 hour calling `videoService.maintainDiskSpace()`. It deletes files older than 24h but **PROTECTS** demo videos containing IDs `05163177` and `79471770`.
4.  **The Cookie Dependency:** NotebookLM research **WILL FAIL** if the `~/.notebooklm-mcp-cli/profiles/default/cookies.json` is missing or expired. The user must provide a valid session.

## 🚚 6. DEPLOYMENT & VM SETUP
*   **Dockerfile:** 3-stage build. Stage 3 installs Node, Python, `uv`, and FFmpeg.
*   **docker-compose.yml:** Maps volumes for `/data`, `/public/videos`, and the `.notebooklm-mcp-cli` profile.
*   **SETUP_VM.sh:** A bash script that installs Docker, Python, and FFmpeg on a raw Linux machine in one click.

## 🚦 7. CURRENT STATUS (April 23, 2026)
*   The system is **100% functional** and feature-complete for the Hack Club submission.
*   All tests pass. The codebase is clean (git history sanitized).
*   The focus is strictly on **keeping the VM alive 24/7** and ensuring the UI is flawless for reviewers.

## 💻 8. CHEAT SHEET: COMMANDS
*   **Run Dev Backend:** `cd server && npm run dev`
*   **Run Dev Frontend:** `npm run dev` (Root)
*   **Test Elite Pipeline (Full Run):** `cd server && npx ts-node src/test_full_research.ts`
*   **Check DB Status:** `cd server && npx ts-node src/check_db.ts`
*   **Clean Git Tracking (if needed):** `git rm -r --cached server/dist/`

---
**END OF TRANSMISSION.** 
If you are the new AI taking over, acknowledge receipt of this brain transplant and ask the user what the immediate next step is for the final 48 hours of the Hackathon.
