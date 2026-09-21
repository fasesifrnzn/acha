FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV DB_FILE=/app/data/db.json

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY app.js ./
COPY style.css ./
COPY acha-logo.svg ./
COPY *.html ./
COPY docentes-editor.js ./
COPY database ./database
COPY scripts ./scripts
COPY docker-entrypoint.sh ./

RUN chmod +x /app/docker-entrypoint.sh
RUN mkdir -p /app/data/backups

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3   CMD wget -q -O - http://127.0.0.1:5000/api/health >/dev/null || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
