#!/usr/bin/env bash

set -euo pipefail

readonly REMOTE_NAME="origin"
readonly MAIN_BRANCH="main"
readonly BRANCH_PREFIX="codex/"

die() {
  printf 'ERRORE: %s\n' "$*" >&2
  exit 1
}

info() {
  printf '%s\n' "$*"
}

git_root() {
  git rev-parse --show-toplevel 2>/dev/null || die "esegui il comando dentro il repository iscrizioni-pace."
}

is_cloud_path() {
  case "$1" in
    *"/Library/CloudStorage/"*|*"/OneDrive"*|*"/Dropbox"*|*"/iCloud"*) return 0 ;;
    *) return 1 ;;
  esac
}

require_safe_location() {
  if is_cloud_path "$REPO_ROOT"; then
    die "questa copia si trova in una cartella cloud ($REPO_ROOT). Usa un clone locale fuori da OneDrive/Dropbox/iCloud."
  fi
}

require_origin() {
  git remote get-url "$REMOTE_NAME" >/dev/null 2>&1 || die "remote '$REMOTE_NAME' non configurato."
}

require_clean_tree() {
  if [[ -n "$(git status --porcelain=v1)" ]]; then
    die "la working tree contiene modifiche. Chiedi a Codex di controllarle prima di sincronizzare."
  fi
}

current_branch() {
  git branch --show-current
}

fetch_origin() {
  info "Aggiorno le informazioni da GitHub..."
  git fetch --prune "$REMOTE_NAME"
}

remote_branch_exists() {
  git show-ref --verify --quiet "refs/remotes/$REMOTE_NAME/$1"
}

slugify() {
  printf '%s' "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g'
}

start_work() {
  require_safe_location
  require_origin
  require_clean_tree

  local branch
  branch="$(current_branch)"
  [[ "$branch" == "$MAIN_BRANCH" ]] || die "per iniziare un nuovo lavoro devi essere su main; branch corrente: ${branch:-HEAD scollegato}."

  fetch_origin
  git pull --ff-only "$REMOTE_NAME" "$MAIN_BRANCH"

  if [[ $# -eq 0 || -z "${1:-}" ]]; then
    info "main e' aggiornato. Nell'app Codex puoi ora aprire un nuovo worktree basato su main."
    return
  fi

  local slug new_branch
  slug="$(slugify "$1")"
  [[ -n "$slug" ]] || die "il nome del lavoro non contiene caratteri utilizzabili."
  new_branch="${BRANCH_PREFIX}${slug}"

  git show-ref --verify --quiet "refs/heads/$new_branch" && die "il branch locale $new_branch esiste gia'. Usa work:resume."
  remote_branch_exists "$new_branch" && die "il branch remoto $new_branch esiste gia'. Usa work:resume."

  git switch --no-track -c "$new_branch" "$REMOTE_NAME/$MAIN_BRANCH"
  info "Pronto: stai lavorando su $new_branch, creato dall'ultimo origin/main."
}

resume_work() {
  require_safe_location
  require_origin
  require_clean_tree
  [[ $# -eq 1 && "$1" == ${BRANCH_PREFIX}* ]] || die "indica un branch codex/*, per esempio: npm run work:resume -- codex/nome-lavoro"

  local branch="$1"
  fetch_origin

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    git switch "$branch"
  elif remote_branch_exists "$branch"; then
    git switch --track -c "$branch" "$REMOTE_NAME/$branch"
  else
    die "il branch $branch non esiste ne' in locale ne' su GitHub."
  fi

  if remote_branch_exists "$branch"; then
    local behind ahead
    read -r behind ahead < <(git rev-list --left-right --count "$REMOTE_NAME/$branch...$branch")
    if (( behind > 0 && ahead > 0 )); then
      die "il branch locale e quello remoto sono entrambi cambiati. Non risolvere automaticamente: chiedi a Codex."
    fi
    if (( behind > 0 )); then
      git merge --ff-only "$REMOTE_NAME/$branch"
    fi
  fi

  info "Pronto: $branch e' allineato con GitHub."
}

run_quality_checks() {
  info "Eseguo lint..."
  npm run lint
  info "Eseguo typecheck..."
  npm run typecheck
  info "Eseguo i test..."
  npm test

  if [[ "${WORK_SESSION_FULL_CHECK:-0}" == "1" ]]; then
    info "Eseguo anche la build completa..."
    npm run build
  fi
}

guard_staged_files() {
  local path size
  while IFS= read -r -d '' path; do
    case "$path" in
      .env|.env.*|*/.env|*/.env.*|*.pem|*.key|*credentials*|*service-account*)
        [[ "$path" == ".env.example" ]] || die "file potenzialmente segreto nello staging: $path"
        ;;
    esac

    if [[ -f "$path" ]]; then
      size="$(wc -c < "$path" | tr -d ' ')"
      (( size <= 10485760 )) || die "file oltre 10 MB nello staging: $path"
    fi
  done < <(git diff --cached --name-only -z --diff-filter=ACMR)
}

finish_work() {
  require_safe_location
  require_origin
  [[ $# -ge 1 && -n "$1" ]] || die "indica il messaggio di commit, per esempio: npm run work:finish -- \"Descrive la modifica\""

  local branch
  branch="$(current_branch)"
  [[ "$branch" == ${BRANCH_PREFIX}* ]] || die "la chiusura automatica e' consentita solo su un branch codex/*; branch corrente: ${branch:-HEAD scollegato}."
  [[ -n "$(git status --porcelain=v1)" ]] || die "non ci sono modifiche da sincronizzare."

  fetch_origin

  if remote_branch_exists "$branch"; then
    local behind ahead
    read -r behind ahead < <(git rev-list --left-right --count "$REMOTE_NAME/$branch...$branch")
    (( behind == 0 )) || die "su GitHub esistono commit del branch non presenti qui. Esegui work:resume o chiedi a Codex prima di continuare."
  fi

  if ! git merge-base --is-ancestor "$REMOTE_NAME/$MAIN_BRANCH" HEAD; then
    die "origin/main e' cambiato. Chiedi a Codex di integrare origin/main nel branch prima della chiusura."
  fi

  run_quality_checks

  git add -A
  guard_staged_files
  git diff --cached --quiet && die "nessuna modifica valida da committare."

  git commit -m "$1"
  git push --set-upstream "$REMOTE_NAME" "$branch"

  [[ -z "$(git status --porcelain=v1)" ]] || die "il push e' riuscito, ma la working tree non e' pulita. Chiedi a Codex di controllare."

  local local_sha remote_sha
  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git ls-remote "$REMOTE_NAME" "refs/heads/$branch" | awk '{print $1}')"
  [[ "$local_sha" == "$remote_sha" ]] || die "il branch remoto non coincide con il commit locale."

  info "Sincronizzazione completata: $branch coincide con GitHub e la working tree e' pulita."
  info "Apri o aggiorna la pull request: https://github.com/giovaniperlapace/iscrizioni-pace/compare/main...${branch}?expand=1"
}

show_status() {
  require_safe_location
  require_origin
  fetch_origin

  local branch
  branch="$(current_branch)"
  info "Repository: $REPO_ROOT"
  info "Branch: ${branch:-HEAD scollegato}"
  git status --short --branch

  if [[ -n "$branch" ]] && remote_branch_exists "$branch"; then
    local behind ahead
    read -r behind ahead < <(git rev-list --left-right --count "$REMOTE_NAME/$branch...$branch")
    info "Rispetto a $REMOTE_NAME/$branch: indietro=$behind, avanti=$ahead"
  fi
}

hook_start() {
  if is_cloud_path "$REPO_ROOT"; then
    info "ATTENZIONE PER CODEX: il repository e' dentro una cartella cloud. Non modificare file; chiedere di usare il clone locale fuori da OneDrive/Dropbox/iCloud."
    return
  fi

  if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
    info "ATTENZIONE PER CODEX: origin non e' configurato; verificare il repository prima di modificare file."
    return
  fi

  if ! git fetch --prune "$REMOTE_NAME" >/dev/null 2>&1; then
    info "ATTENZIONE PER CODEX: fetch da origin non riuscito; non iniziare modifiche prima di diagnosticare il problema."
    return
  fi

  if [[ -n "$(git status --porcelain=v1)" ]]; then
    info "CONTESTO PER CODEX: sono presenti modifiche locali. Non eseguire pull o sovrascriverle; ispezionarle prima di lavorare."
    return
  fi

  local branch
  branch="$(current_branch)"

  if [[ "$branch" == "$MAIN_BRANCH" ]]; then
    if git merge --ff-only "$REMOTE_NAME/$MAIN_BRANCH" >/dev/null 2>&1; then
      info "CONTESTO PER CODEX: main e' stato aggiornato automaticamente da origin/main. Per modificare codice creare un branch breve codex/* o usare un worktree."
    else
      info "ATTENZIONE PER CODEX: main non puo' essere aggiornato con fast-forward. Diagnosticare prima di modificare file."
    fi
    return
  fi

  if [[ -z "$branch" ]] && git merge-base --is-ancestor HEAD "$REMOTE_NAME/$MAIN_BRANCH"; then
    if git merge --ff-only "$REMOTE_NAME/$MAIN_BRANCH" >/dev/null 2>&1; then
      info "CONTESTO PER CODEX: il worktree scollegato e' stato aggiornato automaticamente all'ultimo origin/main."
      return
    fi
  fi

  info "CONTESTO PER CODEX: fetch completato. Verificare l'allineamento del branch con origin/main prima di modificare file."
}

hook_end() {
  if is_cloud_path "$REPO_ROOT"; then
    info "Sessione chiusa su una copia dentro una cartella cloud: spostare il lavoro su un clone locale sicuro."
    return
  fi

  local branch dirty_message=""
  branch="$(current_branch)"
  [[ -z "$(git status --porcelain=v1)" ]] || dirty_message="; sono presenti modifiche non committate"

  if [[ -n "$branch" ]] && remote_branch_exists "$branch"; then
    local behind ahead
    read -r behind ahead < <(git rev-list --left-right --count "$REMOTE_NAME/$branch...$branch")
    info "Fine sessione: branch $branch, indietro=$behind, avanti=$ahead${dirty_message}."
  else
    info "Fine sessione: branch ${branch:-HEAD scollegato}${dirty_message}."
  fi
}

usage() {
  cat <<'EOF'
Uso:
  scripts/work-session.sh start [nome-lavoro]
  scripts/work-session.sh resume codex/nome-lavoro
  scripts/work-session.sh finish "Messaggio di commit"
  scripts/work-session.sh status

Imposta WORK_SESSION_FULL_CHECK=1 per includere anche npm run build nella chiusura.
EOF
}

REPO_ROOT="$(git_root)"
cd "$REPO_ROOT"

command="${1:-}"
[[ $# -eq 0 ]] || shift

case "$command" in
  start) start_work "$@" ;;
  resume) resume_work "$@" ;;
  finish) finish_work "$@" ;;
  status) show_status ;;
  hook-start) hook_start ;;
  hook-end) hook_end ;;
  *) usage; exit 1 ;;
esac
