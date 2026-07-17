# Self-contained image for the WG egress proxy. The build context is this folder
# only (apps/proxy). The proxy has zero workspace deps, so we do not need the
# monorepo here. Run via tsx, matching the other tsx apps (worker/bot).
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
CMD ["npm", "start"]
