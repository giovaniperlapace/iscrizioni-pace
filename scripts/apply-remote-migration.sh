#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 supabase/migrations/<version>_<name>.sql" >&2
  exit 2
fi

MIGRATION_PATH="$1"

if [ ! -f "$MIGRATION_PATH" ]; then
  echo "Migration not found: $MIGRATION_PATH" >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ENV_FILE"
  set +a
fi

SSH_HOST="${SERVER_SSH_HOST:-91.99.81.31}"
SSH_PORT="${SERVER_SSH_PORT:-22}"
SSH_USER="${SERVER_SSH_USER:-root}"
SSH_KEY="${SERVER_SSH_KEY:-$HOME/.ssh/id_ed25519_hetzner_20260613}"
STACK_ID="${SUPABASE_COOLIFY_STACK_ID:-ammnuajlmd83t94cfy3us6cw}"
DB_CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-db-ammnuajlmd83t94cfy3us6cw}"
REMOTE_ENV_FILE="${SUPABASE_REMOTE_ENV_FILE:-/data/coolify/services/$STACK_ID/.env}"

BASE_NAME="$(basename "$MIGRATION_PATH")"
VERSION="${BASE_NAME%%_*}"
NAME="${BASE_NAME#${VERSION}_}"
NAME="${NAME%.sql}"
REMOTE_SQL="/tmp/iscrizioni-pace-migration-${BASE_NAME}"

if ! [[ "$VERSION" =~ ^[0-9]{14}$ ]]; then
  echo "Migration filename must start with a 14-digit timestamp: $BASE_NAME" >&2
  exit 2
fi

SSH_OPTS=(
  -i "$SSH_KEY"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
  -p "$SSH_PORT"
)

SCP_OPTS=(
  -i "$SSH_KEY"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
  -P "$SSH_PORT"
)

REMOTE="$SSH_USER@$SSH_HOST"

echo "Checking migration $VERSION on $REMOTE..."
if ssh "${SSH_OPTS[@]}" "$REMOTE" "docker exec $DB_CONTAINER psql -U postgres -d postgres -At -c \"select 1 from supabase_migrations.schema_migrations where version='$VERSION';\" 2>/dev/null" | grep -qx "1"; then
  echo "Migration $VERSION is already registered. Nothing to do."
  exit 0
fi

echo "Copying $BASE_NAME to server..."
scp "${SCP_OPTS[@]}" "$MIGRATION_PATH" "$REMOTE:$REMOTE_SQL"

echo "Applying migration inside $DB_CONTAINER..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "docker cp '$REMOTE_SQL' '$DB_CONTAINER:$REMOTE_SQL' && docker exec '$DB_CONTAINER' psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f '$REMOTE_SQL'"

echo "Registering migration $VERSION and reloading PostgREST schema..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "docker exec -i '$DB_CONTAINER' psql -U postgres -d postgres -v ON_ERROR_STOP=1" <<SQL
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
insert into supabase_migrations.schema_migrations(version, name, statements)
values ('$VERSION', '$NAME', array[]::text[])
on conflict (version) do update set name = excluded.name;
notify pgrst, 'reload schema';
SQL

echo "Verifying registration..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "docker exec '$DB_CONTAINER' psql -U postgres -d postgres -At -c \"select version || ':' || coalesce(name,'') from supabase_migrations.schema_migrations where version='$VERSION';\""

echo "Done."
