#!/usr/bin/env bash
# Sube archivos locales a Hostinger por SFTP (llave SSH, sin contraseña).
# Este hosting NO tiene respaldos propios: antes de cada subida real el script
#   1) compara cada archivo con el que está en el servidor,
#   2) descarga la versión del servidor a backups/<fecha>/ (local),
#   3) exporta la base de datos a ~/backups-deploy/ en el servidor (fuera de public_html).
#
# Uso:
#   ./deploy.sh <archivo|carpeta> [...]   sube esas rutas (relativas a la raíz del repo)
#   ./deploy.sh --changed                 sube lo modificado en wp-content desde el último deploy
#   ./deploy.sh --dry-run ...             compara con el servidor y muestra qué haría, sin tocar nada
#   ./deploy.sh --ls [ruta]               lista una carpeta remota
#   ./deploy.sh --restore <fecha>         vuelve a subir los archivos guardados en backups/<fecha>/
set -euo pipefail
cd "$(dirname "$0")"

[ -f .deploy.env ] || { echo "Falta .deploy.env"; exit 1; }
# shellcheck disable=SC1091
source .deploy.env
: "${SSH_HOST:?}" "${REMOTE_ROOT:?}"

DRY=0; CHANGED=0; LS=0; RESTORE=""; PATHS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --changed) CHANGED=1 ;;
    --ls) LS=1 ;;
    --restore) shift; RESTORE="${1:?indicá la fecha del backup}" ;;
    *) PATHS+=("$1") ;;
  esac
  shift
done

if [ "$LS" = 1 ]; then
  ssh "$SSH_HOST" "ls -la \"$REMOTE_ROOT/${PATHS[0]:-}\""; exit
fi

SRC="."   # de dónde salen los archivos locales
UPLOAD=(); DELETE=()
if [ -n "$RESTORE" ]; then
  SRC="backups/$RESTORE/files"
  [ -d "$SRC" ] || { echo "No existe $SRC"; exit 1; }
  while IFS= read -r f; do UPLOAD+=("${f#$SRC/}"); done < <(find "$SRC" -type f)
elif [ "$CHANGED" = 1 ]; then
  BASE=$(cat .deploy-last 2>/dev/null || git rev-parse HEAD~1)
  while IFS=$'\t' read -r st f; do
    case "$st" in D) DELETE+=("$f") ;; *) UPLOAD+=("$f") ;; esac
  done < <(git diff --name-status --no-renames "$BASE" -- wp-content)
  # Archivos nuevos sin versionar, salvo los de uploads (ahí escribe el sitio local: logs, cachés)
  while IFS= read -r f; do UPLOAD+=("$f"); done < <(git ls-files --others --exclude-standard -- wp-content ':!wp-content/uploads')
else
  [ ${#PATHS[@]} -gt 0 ] || { echo "Indicá rutas, --changed o --restore"; exit 1; }
  for p in "${PATHS[@]}"; do
    if [ -d "$p" ]; then while IFS= read -r f; do UPLOAD+=("$f"); done < <(find "$p" -type f | sed 's#^\./##')
    else UPLOAD+=("${p#./}"); fi
  done
fi

[ ${#UPLOAD[@]} -gt 0 ] || [ ${#DELETE[@]} -gt 0 ] || { echo "Nada para subir."; exit 0; }

# ---------- 1) Traer del servidor la versión actual de los archivos afectados ----------
TS=$(date +%Y%m%d-%H%M%S)
if [ "$DRY" = 1 ]; then SNAP=$(mktemp -d); trap 'rm -rf "$SNAP"' EXIT
else SNAP="backups/$TS/files"; mkdir -p "$SNAP"; fi

printf '%s\n' "${UPLOAD[@]}" "${DELETE[@]}" \
  | ssh "$SSH_HOST" "cd \"$REMOTE_ROOT\" && while IFS= read -r f; do [ -f \"\$f\" ] && printf '%s\n' \"\$f\"; done | tar czf - -T -" \
  | tar xzf - -C "$SNAP"

# ---------- 2) Comparar ----------
TODO=(); N_NEW=0; N_DIFF=0; N_SAME=0
for f in "${UPLOAD[@]}"; do
  if [ ! -f "$SNAP/$f" ]; then echo "  + NUEVO     $f"; TODO+=("$f"); N_NEW=$((N_NEW+1))
  elif cmp -s "$SRC/$f" "$SNAP/$f"; then echo "  = igual     $f"; N_SAME=$((N_SAME+1))
  else
    echo "  ~ DISTINTO  $f  ($(diff "$SNAP/$f" "$SRC/$f" | grep -c '^[<>]' || true) líneas cambian)"
    TODO+=("$f"); N_DIFF=$((N_DIFF+1))
  fi
done
for f in "${DELETE[@]}"; do
  if [ -f "$SNAP/$f" ]; then echo "  - BORRAR    $f"; else echo "  · ya no está $f"; fi
done
echo "Resumen: $N_NEW nuevos, $N_DIFF distintos, $N_SAME iguales (no se suben), ${#DELETE[@]} a borrar."

if [ "$DRY" = 1 ]; then echo "(dry-run: no se subió ni respaldó nada)"; exit 0; fi
if [ ${#TODO[@]} -eq 0 ] && [ ${#DELETE[@]} -eq 0 ]; then
  echo "El servidor ya está igual. Nada para subir."; rm -rf "backups/$TS"; exit 0
fi

# ---------- 3) Respaldar base de datos en el servidor ----------
echo "Respaldando base de datos..."
# mysqldump directo (Hostinger deshabilita proc_open, así que `wp db export` no funciona).
# Si el respaldo falla o queda incompleto, el script se corta acá y NO sube nada.
if ! ssh "$SSH_HOST" "bash -s" <<EOF
set -euo pipefail
mkdir -p ~/backups-deploy
cd "$REMOTE_ROOT"
F=~/backups-deploy/db-$TS.sql.gz
MYSQL_PWD="\$(wp config get DB_PASSWORD)" mysqldump --single-transaction --no-tablespaces \
  -h "\$(wp config get DB_HOST)" -u "\$(wp config get DB_USER)" "\$(wp config get DB_NAME)" | gzip > "\$F"
zcat "\$F" | tail -1 | grep -q "Dump completed" || { rm -f "\$F"; echo "Respaldo incompleto"; exit 1; }
echo "  DB: \$F (\$(du -h "\$F" | cut -f1))"
EOF
then
  echo "ERROR: falló el respaldo de la base. No se subió nada."; exit 1
fi
printf '%s\n' "${TODO[@]}" > "backups/$TS/subidos.txt"
printf '%s\n' "${DELETE[@]}" > "backups/$TS/borrados.txt"
echo "  Archivos previos: backups/$TS/files/"

# ---------- 4) Subir ----------
BATCH=$(mktemp)
declare -A MADE=()
for f in "${TODO[@]}"; do
  acc=""
  IFS='/' read -ra parts <<< "$(dirname "$f")"
  for part in "${parts[@]}"; do
    [ "$part" = "." ] && continue
    acc="${acc:+$acc/}$part"
    [ -z "${MADE[$acc]:-}" ] && { echo "-mkdir \"$REMOTE_ROOT/$acc\"" >> "$BATCH"; MADE[$acc]=1; }
  done
  echo "put \"$SRC/$f\" \"$REMOTE_ROOT/$f\"" >> "$BATCH"
done
for f in "${DELETE[@]}"; do echo "-rm \"$REMOTE_ROOT/$f\"" >> "$BATCH"; done

sftp -q -b "$BATCH" "$SSH_HOST" > /dev/null
rm -f "$BATCH"
[ -z "$RESTORE" ] && git rev-parse HEAD > .deploy-last
echo "Listo: ${#TODO[@]} subidos, ${#DELETE[@]} borrados. Backup: $TS"
