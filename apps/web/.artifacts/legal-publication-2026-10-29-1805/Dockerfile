FROM node:22-bookworm-slim
WORKDIR /app
COPY dist ./dist
COPY scripts ./scripts
ENV NODE_ENV=production
ENV WEB_ROOT=/app/dist
EXPOSE 8080
USER node
CMD ["node", "scripts/serve-public-site.mjs"]
