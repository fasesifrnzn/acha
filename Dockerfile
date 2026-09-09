FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_FILE=/app/data/db.json

COPY package.json ./
COPY server.js ./
COPY app.js ./
COPY style.css ./
COPY acha-logo.svg ./
COPY *.html ./
COPY data ./data

# A aplicação não possui dependências externas neste estágio.
# O banco JSON faz parte do código versionado em /app/data/db.json.
# Nesta fase, o Git é a fonte de verdade dos dados até a migração para MySQL.
RUN mkdir -p /app/data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/api/health >/dev/null || exit 1

CMD ["node", "server.js"]

# As redes Docker são associadas ao container no runtime.
# O docker-compose.yml conecta o container principal às redes
# externas database_network e proxy_network.
