# Self-contained image for the sentinel. Build context is this folder only, like
# apps/proxy: the sentinel has zero workspace deps on purpose, because it has to
# keep working when the rest of the stack is the thing that is failing. Run via
# tsx, matching the other tsx apps (worker/bot/proxy).
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
CMD ["npm", "start"]
