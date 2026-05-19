FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .
RUN npx tsc --skipLibCheck || true

EXPOSE 3001

ENV NODE_ENV=production

CMD ["sh", "-c", "node dist/server.js 2>/dev/null || npx ts-node src/server.ts"]
