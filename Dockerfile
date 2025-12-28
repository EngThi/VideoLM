
# Build the backend
FROM node:18-alpine AS backend-build
WORKDIR /app/server
COPY server/package*.json ./
# Install dependencies (skipping @ffmpeg-installer/ffmpeg in production as we use apk)
# We need to install nest cli dev dependencies to build, or at least run the build script.
# npm install will install devDependencies by default.
RUN npm install
COPY server/ .
RUN npm run build

# Build the frontend
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production image
FROM node:18-alpine
WORKDIR /app

# Install native ffmpeg
RUN apk add --no-cache ffmpeg

# Copy backend
# NestJS build output is usually in dist/
COPY --from=backend-build /app/server/dist ./server/dist
COPY --from=backend-build /app/server/package*.json ./server/
COPY --from=backend-build /app/server/node_modules ./server/node_modules

# Copy frontend static files to backend public folder (if we want backend to serve frontend)
# Alternatively, serve frontend with Nginx or a separate service.
# Here, we will configure Express to serve static files from the frontend build.
COPY --from=frontend-build /app/dist ./client/dist

# Set up environment
WORKDIR /app/server
ENV NODE_ENV=production
ENV PORT=3000
ENV FFMPEG_PATH=/usr/bin/ffmpeg

EXPOSE 3000

# We need to modify the backend to serve the frontend files
CMD ["node", "dist/main.js"]
