# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app
COPY package*.json ./
# Root level dependencies (vite, react, etc)
RUN npm install
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

# Install system dependencies for FFmpeg static binaries (libraries like libfontconfig, etc)
RUN apt-get update && apt-get install -y \
    libfontconfig1 \
    libfreetype6 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy built frontend from Stage 1 to the 'dist' folder at root
COPY --from=frontend-builder /app/dist ./dist

# Copy backend build and node_modules from Stage 2
COPY --from=backend-builder /app/server/dist ./server/dist
COPY --from=backend-builder /app/server/node_modules ./server/node_modules
COPY --from=backend-builder /app/server/package*.json ./server/
COPY --from=backend-builder /app/server/.env.local ./server/.env.local

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
