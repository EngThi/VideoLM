FROM node:18-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN echo "Forcing cache invalidation" && npx nest build

EXPOSE 3001

CMD ["node", "dist/main.js"]
