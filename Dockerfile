FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001
ENV DB_FILE=/var/data/db.json

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

RUN mkdir -p /var/data/backups

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:5001/api/health >/dev/null || exit 1

CMD ["node", "server.js"]
