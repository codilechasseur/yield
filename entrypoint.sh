#!/bin/sh
# PocketBase entrypoint — auto-initialises admin + schema on first boot.
# Subsequent boots skip init (sentinel file /pb/pb_data/.initialized).

PB_URL="http://localhost:8090"
SENTINEL="/pb/pb_data/.initialized"

init() {
  echo "[init] Waiting for PocketBase to become ready..."
  until curl -sf "${PB_URL}/api/health" > /dev/null 2>&1; do sleep 1; done

  if [ -f "$SENTINEL" ]; then
    echo "[init] Already initialised — skipping."
    return 0
  fi

  echo "[init] First boot — creating superuser..."

  # Create the initial superuser (endpoint is open when 0 superusers exist).
  CREATE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST "${PB_URL}/api/collections/_superusers/records" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${PB_ADMIN_EMAIL}\",\"password\":\"${PB_ADMIN_PASSWORD}\",\"passwordConfirm\":\"${PB_ADMIN_PASSWORD}\"}")

  if [ "$CREATE" = "200" ] || [ "$CREATE" = "201" ]; then
    echo "[init] Superuser created ✓"
  else
    echo "[init] Superuser creation returned HTTP ${CREATE} — may already exist, continuing."
  fi

  echo "[init] Authenticating..."
  AUTH_RESP=$(curl -sf \
    -X POST "${PB_URL}/api/collections/_superusers/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"${PB_ADMIN_EMAIL}\",\"password\":\"${PB_ADMIN_PASSWORD}\"}")

  if [ -z "$AUTH_RESP" ]; then
    echo "[init] ERROR: Authentication failed. Check PB_ADMIN_EMAIL / PB_ADMIN_PASSWORD."
    return 1
  fi

  TOKEN=$(echo "$AUTH_RESP" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

  echo "[init] Importing schema..."
  IMPORT=$(curl -s -o /dev/null -w "%{http_code}" \
    -X PUT "${PB_URL}/api/collections/import" \
    -H "Content-Type: application/json" \
    -H "Authorization: ${TOKEN}" \
    -d "{\"collections\":$(cat /pb/pb_schema.json),\"deleteMissing\":false}")

  if [ "$IMPORT" = "200" ] || [ "$IMPORT" = "204" ]; then
    echo "[init] Schema imported ✓"
    touch "$SENTINEL"
    echo "[init] Done — Yield is ready."
  else
    echo "[init] ERROR: Schema import returned HTTP ${IMPORT}."
    return 1
  fi
}

# Run init in background so PocketBase can start as the main (PID 1) process.
init &

exec /pb/pocketbase serve --http=0.0.0.0:8090 --dir=/pb/pb_data
