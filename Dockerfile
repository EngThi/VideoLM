FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
# Ignore postinstall scripts that try to install server dependencies
RUN npm install --ignore-scripts

COPY . .

# Vite development server (default for this project structure)
# or build and serve. For dev environment, we use dev server.
EXPOSE 5173

# Correct command to only start the frontend dev server
CMD ["npx", "vite", "--host"]
