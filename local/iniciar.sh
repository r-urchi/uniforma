#!/usr/bin/env bash
# Levanta una copia LOCAL de uniforma.com.ar en http://127.0.0.1:9400
# - Código: plugins, tema y fotos del proyecto (wp-content).
# - Base: copia de producción en local/db.sql (bajada del respaldo del servidor).
# - Usuario: local-admin / admin
# Nada de lo que hagas acá toca el sitio real. Al cerrar (Ctrl+C) la base vuelve
# a cero: la próxima vez arranca de nuevo desde la copia de producción.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f local/db.sql ] || { echo "Falta local/db.sql"; exit 1; }

# Adaptar el dump de MariaDB para SQLite (quita comentarios condicionales y LOCK TABLES)
grep -v -E '^(/\*|LOCK TABLES|UNLOCK TABLES)' local/db.sql > local/db-sqlite.sql

# Git Bash convierte "/wordpress/..." en "C:\Program Files\Git\wordpress\...": desactivarlo
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*'

# Plugins que se montan. Quedan afuera litespeed-cache y hostinger (solo funcionan en el
# servidor); WordPress los desactiva solo al no encontrarlos.
PLUGINS=(woocommerce advanced-custom-fields woo-coupons-bulk-editor
         uniforma-importador-catalogo uniforma-alta-productos uniforma-fotos-noviembre)
MOUNTS=()
for p in "${PLUGINS[@]}"; do
  MOUNTS+=("--mount=./wp-content/plugins/$p:/wordpress/wp-content/plugins/$p")
done
rm -f local/debug.log

npx -y @wp-playground/cli@3.1.63 server \
  --php=8.3 \
  --wp=7.0.9 \
  --port=9400 \
  "${MOUNTS[@]}" \
  --mount=./wp-content/themes:/wordpress/wp-content/themes \
  --mount=./wp-content/uploads:/wordpress/wp-content/uploads \
  --mount=./local:/import \
  --blueprint=./local/blueprint.json
