# Setup Guide - AI Video Factory

## Prerequisites

You need:
- Node.js 18+ (https://nodejs.org/)
- FFmpeg (platform-specific below)
- Gemini API Key (free at https://ai.google.dev/)

## Installation

```bash
git clone [https://github.com/EngThi/ai-video-factory.git](https://github.com/EngThi/ai-video-factory.git)
cd ai-video-factory
npm install

Install FFmpeg
Linux (Ubuntu/Debian):

Bash

sudo apt update
sudo apt install ffmpeg
ffmpeg -version
macOS:

Bash

brew install ffmpeg
ffmpeg -version
Windows:

Download from https://ffmpeg.org/download.html

Extract to C:\ffmpeg

Add to PATH environment variable

Verify: ffmpeg -version

Get Gemini API Key
Go to https://ai.google.dev/

Click "Get API Key"

Create free Google account

Copy your key

Configure Environment
Create .env.local:

Snippet de código

GEMINI_API_KEY=your_key_here
VITE_BACKEND_URL=http://localhost:3000
Run Development
Bash

npm run dev
Should see:

Frontend: http://localhost:5173

Backend: http://localhost:3000

Docker
Bash

docker build -t ai-video-factory .
docker run -p 3000:3000 ai-video-factory
Troubleshooting
FFmpeg not found: Install FFmpeg above or set FFMPEG_PATH

Port 3000 in use: PORT=3001 npm run server:dev

Cannot find module: rm -rf node_modules && npm install

API error: Check .env.local exists and key is correct