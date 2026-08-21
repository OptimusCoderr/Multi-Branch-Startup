#!/usr/bin/env bash
#
# Tears down the local dev Postgres container (if any) and brings up a
# brand-new one, empty, from scratch — then applies every migration and
# reseeds it. Run this any time `npx prisma migrate dev`/`prisma migrate
# deploy` can't reach localhost:5432, or whenever you just want a clean
# slate. Every run wipes local dev data on purpose — that's the point.
#
# Reads DATABASE_URL / RUNTIME_DATABASE_URL from .env so the fresh
# container's roles/password/database name always match what the app
# actually expects, without ever hardcoding a real credential into this
# script (which would land in git history — .env itself is gitignored).
#
# Refuses to run against anything that isn't localhost/127.0.0.1, so a
# misconfigured .env can't point this at a real/remote database and wipe
# it — this script only ever touches the local Docker container it
# creates.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

CONTAINER_NAME="inventory-pg"
IMAGE="postgres:16"

if [ ! -f .env ]; then
  echo "No .env found — copy .env.example to .env first (see README.md)." >&2
  exit 1
fi

# Load .env into the environment (DATABASE_URL, RUNTIME_DATABASE_URL, etc.)
set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set in .env." >&2
  exit 1
fi

# --- Parse postgresql://user:pass@host:port/dbname?query out of a URL ---
parse_url() {
  local url="$1" rest userpass hostport
  rest="${url#postgresql://}"
  userpass="${rest%%@*}"
  rest="${rest#*@}"
  hostport="${rest%%/*}"
  rest="${rest#*/}"
  PARSED_USER="${userpass%%:*}"
  PARSED_PASS="${userpass#*:}"
  PARSED_HOST="${hostport%%:*}"
  PARSED_PORT="${hostport#*:}"
  PARSED_DB="${rest%%\?*}"
}

parse_url "$DATABASE_URL"
APP_USER="$PARSED_USER"
APP_PASS="$PARSED_PASS"
DB_HOST="$PARSED_HOST"
DB_PORT="$PARSED_PORT"
DB_NAME="$PARSED_DB"

if [ "$DB_HOST" != "localhost" ] && [ "$DB_HOST" != "127.0.0.1" ]; then
  echo "DATABASE_URL points at '$DB_HOST', not localhost — refusing to run (this script only manages a local Docker container, never a remote database)." >&2
  exit 1
fi

RUNTIME_USER=""
RUNTIME_PASS=""
if [ -n "${RUNTIME_DATABASE_URL:-}" ]; then
  parse_url "$RUNTIME_DATABASE_URL"
  RUNTIME_USER="$PARSED_USER"
  RUNTIME_PASS="$PARSED_PASS"
fi

echo "==> Stopping/removing any existing '$CONTAINER_NAME' container"
docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

echo "==> Starting a fresh $IMAGE container (db=$DB_NAME, user=$APP_USER, port=$DB_PORT)"
docker run \
  --name "$CONTAINER_NAME" \
  -e POSTGRES_USER="$APP_USER" \
  -e POSTGRES_PASSWORD="$APP_PASS" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "$DB_PORT:5432" \
  -d "$IMAGE" >/dev/null

echo "==> Waiting for Postgres to accept connections"
for _ in $(seq 1 30); do
  if docker exec "$CONTAINER_NAME" pg_isready -U "$APP_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! docker exec "$CONTAINER_NAME" pg_isready -U "$APP_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  echo "Postgres never became ready — check 'docker logs $CONTAINER_NAME'." >&2
  exit 1
fi

if [ -n "$RUNTIME_USER" ] && [ "$RUNTIME_USER" != "$APP_USER" ]; then
  echo "==> Creating least-privilege runtime role '$RUNTIME_USER'"
  # Escape any literal single-quote in the password so it can't break out
  # of the SQL string literal below.
  RUNTIME_PASS_ESCAPED="${RUNTIME_PASS//\'/\'\'}"
  docker exec -i "$CONTAINER_NAME" psql -U "$APP_USER" -d "$DB_NAME" \
    -c "CREATE ROLE \"$RUNTIME_USER\" WITH LOGIN PASSWORD '$RUNTIME_PASS_ESCAPED';"
fi

echo "==> Applying migrations"
npx prisma migrate deploy

if [ -n "$RUNTIME_USER" ] && [ -f prisma/grants.sql ]; then
  echo "==> Applying least-privilege grants (prisma/grants.sql)"
  docker exec -i "$CONTAINER_NAME" psql -U "$APP_USER" -d "$DB_NAME" < prisma/grants.sql
fi

echo "==> Seeding"
npm run db:seed

echo
echo "Done — a fresh '$DB_NAME' database is up on localhost:$DB_PORT."
echo "Run 'npm run dev' to start the app."
