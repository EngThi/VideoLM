# 🎬 AI Video Factory



> **Automate YouTube video creation from topic to upload.**



Transform any topic into a polished, ready-to-upload YouTube video automatically. AI generates scripts with real web sources, creates natural narration, designs custom visuals, and assembles the final video—all in minutes.



## ✨ Features



- 🧠 **AI-Powered Script Generation** - Gemini creates scripts with real web sources and citations

- 🎙️ **Natural Voice Narration** - Google Text-to-Speech with multiple voices

- 🎨 **Automated Visuals** - AI generates custom images that match your script

- 🎬 **One-Click Video Assembly** - FFmpeg handles video composition seamlessly

- 🔄 **End-to-End Pipeline** - 7-stage automated workflow from idea to video

- 💾 **Production-Ready** - Docker support, TypeScript, full error handling



## 🎯 How It Works



1. **Enter a Topic** → System generates content ideas

2. **Pick an Idea** → AI creates a detailed script with web sources

3. **Generate Assets** → Automatic narration and custom visuals

4. **Assemble Video** → FFmpeg combines everything into MP4

5. **Download & Upload** → Ready for YouTube



## 🛠️ Tech Stack



**Frontend:**

- React 19 + TypeScript

- Vite (fast dev server)

- Real-time pipeline monitoring



**Backend:**

- NestJS (Node.js framework)

- Express + TypeORM

- SQLite (dev) / PostgreSQL (production)



**AI & Video:**

- Google Gemini API (text, images, video, TTS)

- Fluent-FFmpeg (video processing)

- FFmpeg (system dependency)



## 🚀 Quick Start



### Prerequisites

- Node.js 18+

- FFmpeg installed

- Google Gemini API key



### Installation



```bash

# Clone the repo

git clone https://github.com/EngThi/ai-video-factory.git

cd ai-video-factory



# Install dependencies

npm install

```



### Environment Setup



Create `.env.local` in the root directory:



```env

GEMINI_API_KEY=your_api_key_here

VITE_BACKEND_URL=http://localhost:3000

```



### Running Locally



```bash

# Development (frontend on 5173, backend on 3000)

npm run dev



# Production build

npm run build



# Production start

npm run server:start

```



## 🐳 Docker Deployment



```bash

# Build image

docker build -t ai-video-factory .



# Run container

docker run -p 3000:3000 ai-video-factory



# Access at http://localhost:3000

```



## 📊 Pipeline Architecture



```

Topic Input

    ↓

💡 Ideation (Generate 3-5 content ideas)

    ↓

📄 Script Generation (Web research + AI writing)

    ↓

🎙️ Audio Generation (TTS narration)

    ↓

🎨 Visual Generation (Image prompts + AI images)

    ↓

🎬 Video Assembly (FFmpeg concatenation)

    ↓

✅ Quality Check (Auto-validation)

    ↓

📤 Upload Ready (Download or auto-upload)

```



## 📁 Project Structure



```

.

├── Frontend (React + Vite)

│   ├── App.tsx

│   ├── components/

│   ├── services/

│   └── types.ts

│

├── Backend (NestJS)

│   └── server/src/

│       ├── ai/          (Gemini integration)

│       ├── video/       (FFmpeg service)

│       └── projects/    (Database)

│

└── Docker & Config

    ├── Dockerfile

    └── package.json

```



## 🔌 API Endpoints



### AI Service (`/api/ai/`)



- `POST /ideas` - Generate content ideas

- `POST /script` - Generate script with web sources

- `POST /image-prompts` - Generate image prompts from script

- `POST /image` - Generate image from prompt

- `POST /narration` - Generate audio narration

- `POST /veo` - Generate video with Veo 2.0

- `POST /thumbnail` - Generate thumbnail



### Video Service (`/api/`)



- `POST /assemble` - Assemble video from audio + images



## 📋 Requirements



### System

- Linux, macOS, or Windows

- 2GB+ RAM recommended

- FFmpeg available in PATH



### API Keys

- Google Gemini API key

- Optional: YouTube API for auto-upload



## 🎓 Learning Resources



- [Gemini API Docs](https://ai.google.dev/)

- [NestJS Documentation](https://docs.nestjs.com/)

- [FFmpeg Wiki](https://trac.ffmpeg.org/wiki)

- [React Documentation](https://react.dev/)



## 📝 License



MIT License - feel free to use this for your projects!



## 🤝 Contributing



Contributions welcome! Please feel free to submit PRs or open issues.



## 📧 Questions?



Have questions about the project? Open an issue on GitHub!



---



**Built with ❤️ for automated content creation**
