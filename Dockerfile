# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
# Root level dependencies (vite, react, etc)
RUN npm install --ignore-scripts
COPY . .
RUN npx vite build

# Stage 2: Build Backend
FROM node:20-slim AS backend-builder
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ .
RUN npm run build

# Stage 3: Final Production Image
FROM node:20-slim
WORKDIR /app

# Install system dependencies + Python for Research Engine (NotebookLM)
RUN apt-get update && apt-get install -y \
    libfontconfig1 \
    libfreetype6 \
    ca-certificates \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    procps \
    && curl -LsSf https://astral.sh/uv/install.sh | sh \
    && rm -rf /var/lib/apt/lists/*

# Add uv to PATH
ENV PATH="/root/.local/bin:${PATH}"

# Copy built frontend from Stage 1 to the 'dist' folder at root
COPY --from=frontend-builder /app/dist ./dist

# Copy backend build and node_modules from Stage 2
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=backend-builder /app/server/node_modules ./server/node_modules
COPY --from=backend-builder /app/server/package*.json ./server/

# Expose the backend port
EXPOSE 3001

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

# Create required directories
RUN mkdir -p server/public/videos server/temp server/data/music server/cache

# Start the server directly from the server folder context
WORKDIR /app/server
CMD ["node", "dist/main"]
