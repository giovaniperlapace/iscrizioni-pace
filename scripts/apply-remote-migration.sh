#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage:
  apply-remote-migration.sh staging <migration.sql>
  apply-remote-migration.sh production <migration.sql> --confirm-production <migration-version>
USAGE
}

if [ "$#" -lt 2 ]; then
  usage
  exit 2
fi

TARGET="$1"
MIGRATION_PATH="$2"
shift 2

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

case "$TARGET" in
  staging)
    ENV_FILE="$ROOT_DIR/.env.staging.local"
    if [ "$#" -ne 0 ]; then
      usage
      exit 2
    fi
    ;;
  production)
    ENV_FILE="$ROOT_DIR/.env.production.local"
    ;;
  *)
    echo "Target non valido: usare staging o production." >&2
    exit 2
    ;;
esac

if [ ! -f "$MIGRATION_PATH" ]; then
  echo "Migration non trovata: $MIGRATION_PATH" >&2
  exit 2
fi

BASE_NAME="$(basename "$MIGRATION_PATH")"
VERSION="${BASE_NAME%%_*}"
NAME="${BASE_NAME#${VERSION}_}"
NAME="${NAME%.sql}"

if ! [[ "$VERSION" =~ ^[0-9]{14}$ ]]; then
  echo "Il nome della migration deve iniziare con un timestamp di 14 cifre: $BASE_NAME" >&2
  exit 2
fi

if ! [[ "$NAME" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Il nome della migration puo' contenere soltanto lettere, numeri e underscore: $BASE_NAME" >&2
  exit 2
fi

if [ "$TARGET" = "production" ]; then
  if [ "$#" -ne 2 ] || [ "$1" != "--confirm-production" ] || [ "$2" != "$VERSION" ]; then
    echo "Production richiede: --confirm-production $VERSION" >&2
    exit 2
  fi
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Configurazione $TARGET assente: $ENV_FILE" >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "Variabile richiesta non configurata in $ENV_FILE: $name" >&2
    exit 2
  fi
}

for name in \
  DEPLOYMENT_ENVIRONMENT \
  SERVER_SSH_HOST \
  SERVER_SSH_PORT \
  SERVER_SSH_USER \
  SERVER_SSH_KEY \
  SUPABASE_COOLIFY_STACK_ID \
  SUPABASE_DB_CONTAINER; do
  require_env "$name"
done

if [ "$DEPLOYMENT_ENVIRONMENT" != "$TARGET" ]; then
  echo "DEPLOYMENT_ENVIRONMENT=$DEPLOYMENT_ENVIRONMENT non coincide con il target $TARGET." >&2
  exit 2
fi

if [[ "$SERVER_SSH_KEY" != /* ]] || [ ! -f "$SERVER_SSH_KEY" ]; then
  echo "SERVER_SSH_KEY deve essere un file esistente con path assoluto." >&2
  exit 2
fi

KNOWN_PRODUCTION_DB_CONTAINER="supabase-db-ammnuajlmd83t94cfy3us6cw"
if [ "$TARGET" = "staging" ] && [ "$SUPABASE_DB_CONTAINER" = "$KNOWN_PRODUCTION_DB_CONTAINER" ]; then
  echo "Blocco di sicurezza: il target staging indica il container production noto." >&2
  exit 2
fi

DB_USER="${SUPABASE_DB_USER:-postgres}"
DB_NAME="${SUPABASE_DB_NAME:-postgres}"
REMOTE_SQL="/tmp/iscrizioni-pace-${TARGET}-${BASE_NAME}"
REMOTE="$SERVER_SSH_USER@$SERVER_SSH_HOST"

for safe_value in "$SUPABASE_COOLIFY_STACK_ID" "$SUPABASE_DB_CONTAINER" "$DB_USER" "$DB_NAME"; do
  if ! [[ "$safe_value" =~ ^[A-Za-z0-9_-]+$ ]]; then
    echo "Stack, container, utente e database possono contenere soltanto lettere, numeri, trattini e underscore." >&2
    exit 2
  fi
done

SSH_OPTS=(
  -i "$SERVER_SSH_KEY"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
  -p "$SERVER_SSH_PORT"
)

SCP_OPTS=(
  -i "$SERVER_SSH_KEY"
  -o BatchMode=yes
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
  -P "$SERVER_SSH_PORT"
)

echo "Target verificato: $TARGET"
echo "Stack: $SUPABASE_COOLIFY_STACK_ID"
echo "Container database: $SUPABASE_DB_CONTAINER"
echo "Controllo migration $VERSION..."

ssh "${SSH_OPTS[@]}" "$REMOTE" "docker inspect --type container '$SUPABASE_DB_CONTAINER' >/dev/null"

if ssh "${SSH_OPTS[@]}" "$REMOTE" "docker exec '$SUPABASE_DB_CONTAINER' psql -U '$DB_USER' -d '$DB_NAME' -At -c \"select 1 from supabase_migrations.schema_migrations where version='$VERSION';\" 2>/dev/null" | grep -qx "1"; then
  echo "Migration $VERSION già registrata. Nessuna modifica eseguita."
  exit 0
fi

echo "Copia di $BASE_NAME sul server..."
scp "${SCP_OPTS[@]}" "$MIGRATION_PATH" "$REMOTE:$REMOTE_SQL"

echo "Applicazione e registrazione atomica sul database $TARGET..."
ssh "${SSH_OPTS[@]}" "$REMOTE" "docker cp '$REMOTE_SQL' '$SUPABASE_DB_CONTAINER:$REMOTE_SQL' && docker exec -i '$SUPABASE_DB_CONTAINER' psql -U '$DB_USER' -d '$DB_NAME' -X -v ON_ERROR_STOP=1 -1 -f '$REMOTE_SQL' -f -" <<SQL
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

ssh "${SSH_OPTS[@]}" "$REMOTE" "docker exec '$SUPABASE_DB_CONTAINER' psql -U '$DB_USER' -d '$DB_NAME' -At -c \"select version || ':' || coalesce(name,'') from supabase_migrations.schema_migrations where version='$VERSION';\" && docker exec '$SUPABASE_DB_CONTAINER' rm -f '$REMOTE_SQL' && rm -f '$REMOTE_SQL'"

echo "Migration completata su $TARGET."
