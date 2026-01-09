FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Vite development server (default for this project structure)
# or build and serve. For dev environment, we use dev server.
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
