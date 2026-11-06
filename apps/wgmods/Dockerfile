# The publisher and the browser it drives, in one image. Build context is this
# folder only, like apps/sentinel and apps/proxy: no workspace deps.
#
# The Playwright image ships the Chromium that playwright-core 1.65.0 expects,
# so the two versions move together or not at all. On top of it: a virtual
# display for the headed browser, and x11vnc + noVNC so a person can log in to
# Wargaming in that very window through remote.ts.
FROM mcr.microsoft.com/playwright:v1.65.0-noble
RUN apt-get update \
  && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json entrypoint.sh ./
COPY src ./src
RUN chmod +x entrypoint.sh
ENV DISPLAY=:99
CMD ["./entrypoint.sh"]
