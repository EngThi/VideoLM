FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
# Ignore postinstall scripts that try to install server dependencies
RUN npm install --ignore-scripts

COPY . .

# Vite development server (default for this project structure)
# or build and serve. For dev environment, we use dev server.
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
# [GW] Last check at Fri Jan  9 05:54:40 PM UTC 2026
# [GW] Last check at Fri Jan  9 05:55:31 PM UTC 2026
# [GW] Last check at Fri Jan  9 05:57:01 PM UTC 2026
# [GW] Last check at Fri Jan  9 05:58:51 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:01:02 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:05:02 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:05:32 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:06:43 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:08:23 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:08:33 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:09:23 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:09:53 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:10:23 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:10:33 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:11:04 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:11:54 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:16:15 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:18:35 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:19:36 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:20:06 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:20:46 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:21:26 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:21:46 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:22:27 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:23:07 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:23:27 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:25:07 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:25:17 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:25:27 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:25:58 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:28:08 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:28:18 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:28:28 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:29:09 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:30:39 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:30:59 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:31:59 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:33:50 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:34:40 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:34:50 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:35:40 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:36:10 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:36:50 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:37:51 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:38:31 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:39:22 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:39:42 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:40:22 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:41:02 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:41:32 PM UTC 2026
# [GW] Last check at Fri Jan  9 06:42:53 PM UTC 2026
