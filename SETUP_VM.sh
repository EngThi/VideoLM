#!/bin/bash
# VideoLM VM Provisioning Script
# Use: chmod +x SETUP_VM.sh && ./SETUP_VM.sh

echo "🚀 Starting VideoLM VM Setup..."

# 1. Configure 4GB Swap
echo "⚙️ Configuring 4GB Swap..."
if [ ! -f "/swapfile" ]; then
    sudo fallocate -l 4G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap configured."
else
    echo "✅ Swap file already exists."
fi

# 2. Update System
sudo apt-get update && sudo apt-get upgrade -y

# 3. Install Docker & Docker Compose
if ! [ -x "$(command -v docker)" ]; then
    echo "🐳 Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
fi

# 4. Install Python & UV (For Research Engine)
echo "🐍 Installing Python & UV..."
sudo apt-get install -y python3 python3-pip curl
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# 5. Install FFmpeg & Chromium (for lightweight NLM Auth)
echo "🎞️ Installing FFmpeg & Chromium..."
sudo apt-get install -y ffmpeg chromium-browser

# 6. Configure NLM CLI for 4GB VM Resilience
echo "🛡️ Hardening NLM CLI for 4GB VM..."
uvx --from notebooklm-mcp-cli nlm config set auth.browser chromium || true
uvx --from notebooklm-mcp-cli nlm config set output.short_ids true || true

# 7. Clone and Prepare (If not in folder)
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
