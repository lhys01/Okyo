FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production
ENV WAITLIST_DATABASE_PATH=/data/waitlist.sqlite
EXPOSE 8080
CMD ["node", "src/server.mjs"]
