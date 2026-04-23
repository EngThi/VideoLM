#!/bin/bash
# VideoLM VM Provisioning Script
# Use: chmod +x SETUP_VM.sh && ./SETUP_VM.sh

echo "🚀 Starting VideoLM VM Setup..."

# 1. Update System
sudo apt-get update && sudo apt-get upgrade -y

# 2. Install Docker & Docker Compose
if ! [ -x "$(command -v docker)" ]; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# 3. Install Python & UV (For Research Engine)
echo "🐍 Installing Python & UV..."
sudo apt-get install -y python3 python3-pip curl
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# 4. Install FFmpeg
echo "🎞️ Installing FFmpeg..."
sudo apt-get install -y ffmpeg

# 5. Clone and Prepare (If not in folder)
if [ ! -f "docker-compose.yml" ]; then
    echo "📂 Please run this script inside the project folder."
    exit 1
fi

echo "✅ System dependencies installed!"
echo "------------------------------------------------"
echo "👉 NEXT STEPS:"
echo "1. Log out and log back in (to activate docker group)."
echo "2. Run 'uvx --from notebooklm-mcp-cli nlm login --manual' to set up session."
echo "3. Run 'docker-compose up -d --build' to start the factory."
echo "------------------------------------------------"
