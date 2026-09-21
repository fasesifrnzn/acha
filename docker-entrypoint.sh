#!/bin/sh
set -eu

echo "========================================"
echo "ACHA — inicialização de produção"
echo "========================================"

echo "[1/3] Verificando/criando schema MySQL..."
node scripts/init-mysql-schema.js

echo "[2/3] Verificando migração inicial..."
if [ ! -f "${DB_FILE:-/app/data/db.json}" ]; then
  echo "ERRO: arquivo ${DB_FILE:-/app/data/db.json} não encontrado."
  echo "Disponibilize o backup db.json no diretório data/ do servidor."
  exit 1
fi

MIGRATION_MODE="${MIGRATION_MODE:-initial}" node scripts/migrate-json-to-mysql.js

echo "[3/3] Iniciando ACHA..."
exec node server.js
