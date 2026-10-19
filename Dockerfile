FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY bot.js ./
COPY src ./src

# Tokens are persisted here (mounted as a volume)
ENV TOKENS_PATH=/data/tokens.json
RUN mkdir /data && chown node:node /data

USER node
CMD ["node", "bot.js"]
