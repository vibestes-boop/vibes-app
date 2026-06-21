# Render-Dienst: Foto + animierte GIPHY-Sticker → MP4 (via ffmpeg)
FROM node:20-slim

# ffmpeg (mit libx264) installieren
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
