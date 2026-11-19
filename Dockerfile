FROM node:22-slim

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm install --no-audit --no-fund

# Copy application source
COPY . .

# Build Vite + PWA client bundle and grant ownership to non-root UID 1000 (node)
RUN npm run build && chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

CMD ["npm", "start"]
