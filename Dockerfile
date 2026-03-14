# Stage 1: Build Frontend
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Build Backend
FROM node:18-alpine AS backend-builder
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm install
COPY server/ server/
RUN cd server && npm run build

# Stage 3: Final Production Image
FROM node:18-alpine
WORKDIR /app

# Install FFmpeg
RUN apk add --no-cache ffmpeg

# Copy frontend build from builder stage
COPY --from=builder /app/dist ./dist/frontend

# Copy backend build from backend-builder stage
COPY --from=backend-builder /app/dist ./dist/backend
COPY --from=backend-builder /app/package*.json ./

# Install only production dependencies for the server
RUN npm ci --only=production

# Expose the port the server will run on
EXPOSE 3001

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3001

# Start the server
CMD ["node", "dist/backend/main"]