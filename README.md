# AI Video Factory: Automated YouTube Production Pipeline

AI Video Factory is a full-stack automation tool designed to transform a single topic into a fully rendered YouTube video. Unlike simple wrappers, this project implements a resilient background processing architecture to handle heavy video encoding tasks without compromising user experience.

Built for the **Hack Club Flavortown** marathon, the project focuses on deep integration between Large Language Models (Gemini) and native media processing tools (FFmpeg).

---

## 🏗 System Architecture

The project is split into a decoupled Frontend/Backend architecture to ensure scalability and separation of concerns.

### Backend (NestJS + FFmpeg)
The core logic resides in a NestJS server that orchestrates the "Immortal Pipeline". 
- **Resilient Rendering**: We migrated to a background worker pattern. The server initiates the FFmpeg process and immediately returns a tracking ID, allowing the render to persist even if the network connection is interrupted.
- **Static Binary Distribution**: To eliminate the "it works on my machine" problem, we bundle `ffmpeg-static` and `ffprobe-static`. This ensures a zero-dependency deployment where the binary is matched to the OS architecture automatically.
- **Data Persistence**: Uses TypeORM with SQLite for local development to track project states (`idle`, `processing`, `completed`, `error`) and asset metadata.

### Frontend (React + Vite)
- **Real-time Monitoring**: Uses a reactive state machine to track the 7-stage pipeline progress.
- **Asset Management**: Handles multi-part form uploads for local asset injection (Dev Mode), allowing for rapid testing without burning API credits.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 20.x** or higher.
- **Google Gemini API Key**: Required for script and asset generation.

### Local Installation

1. **Clone and Install**
   ```bash
   git clone https://github.com/EngThi/ai-video-factory.git
   cd ai-video-factory
   npm install
   ```
   *Note: The root install will automatically trigger the server-side dependency installation.*

2. **Configuration**
   Create a `server/.env.local` file with the following variables:
   ```env
   GEMINI_API_KEY=your_key_here
   DATABASE_PATH=./data/database.sqlite
   ```

3. **Launch Development Environment**
   ```bash
   npm run dev
   ```
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:3001`

---

## 🐳 Docker Deployment (One-Click)

The project includes a multi-stage Dockerfile optimized for production. It handles the frontend build (Vite), the backend compilation (TypeScript), and installs the necessary system libraries for FFmpeg's font and image filters.

```bash
docker build -t video-factory .
docker run -p 3001:3001 --env-file server/.env.local video-factory
```

---

## 📂 Project Structure & Navigation

- `/server/src/video`: The "Engine Room". Contains the logic for FFmpeg complex filters, Ken Burns effects, and ducking audio mixing.
- `/server/src/ai`: Integration with Google Generative AI, including prompt engineering for structured JSON outputs.
- `/components`: Modular React components for the pipeline UI.
- `/services/ffmpegService.ts`: Frontend-side orchestrator that prepares the FormData for the backend.

---

## 🗺 Roadmap: The Path to SaaS

This project is currently in **Phase 1 (Hardening)**. Future milestones include:

- **Authentication**: Implementing JWT-based auth to allow per-user project history.
- **Monetization**: Stripe integration for credit-based video generation.
- **Advanced Polish**: Transitioning from static images to video clips using Veo 3.1 or Kling, and implementing smart-cut editing based on audio peaks.

---

## ⚖️ License
Distributed under the MIT License. See `LICENSE` for more information.

**Developed as part of the Hack Club Flavortown Marathon.**
