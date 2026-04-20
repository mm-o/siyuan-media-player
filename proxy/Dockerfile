FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY media-proxy-server.mjs ./

EXPOSE 16810

CMD ["node", "media-proxy-server.mjs"]
