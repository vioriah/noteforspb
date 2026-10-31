FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends gfortran util-linux \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json server.js ./
COPY public ./public
COPY scripts ./scripts

ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
USER node
CMD ["node", "server.js"]
