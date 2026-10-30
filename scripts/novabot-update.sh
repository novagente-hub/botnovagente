#!/usr/bin/env bash
# NovaBot: atualiza a instalação em /opt/novabot a partir do GitHub.
#   cd /opt/novabot && ./scripts/novabot-update.sh            # atualiza
#   ./scripts/novabot-update.sh --with-computer                # também reconstrói o computador dos bots
#   ./scripts/novabot-update.sh --rollback                     # volta para a versão anterior
# Só mexe no projeto compose "novabot". Nunca para/reinicia outros containers, nunca faz prune.
set -euo pipefail
cd "$(dirname "$0")/.."
COMPOSE=(docker compose -p novabot -f docker-compose.novabot.yml)
BRANCH="${NOVABOT_BRANCH:-novabot}"
MIN_MB="${NOVABOT_UPDATE_MIN_MB:-2048}"
IMAGES=(novabot-server novabot-agent-bot novabot-embed novabot-supervisor)
log() { echo "[novabot-update $(date '+%F %T')] $*"; }
avail_mb() { awk '/^MemAvailable/{print int($2/1024)}' /proc/meminfo; }

healthy() {
  for _ in $(seq 1 40); do
    if curl -fsS -m 5 http://127.0.0.1:13010/health >/dev/null 2>&1; then return 0; fi
    sleep 5
  done
  return 1
}

rollback() {
  log "ROLLBACK: voltando para $(cat .novabot-previous-commit 2>/dev/null || echo '?')"
  if [[ -f .novabot-previous-commit ]]; then git reset -q --hard "$(cat .novabot-previous-commit)"; fi
  for image in "${IMAGES[@]}" novabot-agent-computer; do
    if docker image inspect "$image:rollback" >/dev/null 2>&1; then docker tag "$image:rollback" "$image:latest"; fi
  done
  "${COMPOSE[@]}" up -d
  healthy && log "rollback ok, /health 200" || { log "rollback: /health ainda falhando, veja: ${COMPOSE[*]} logs server"; exit 2; }
}

if [[ "${1:-}" == "--rollback" ]]; then rollback; exit 0; fi
WITH_COMPUTER=false; [[ "${1:-}" == "--with-computer" ]] && WITH_COMPUTER=true

mb=$(avail_mb); log "RAM disponível: ${mb} MB; swap: $(free -m | awk '/Swap/{print $3"/"$2" MB"}')"
if (( mb < MIN_MB )); then log "ABORTADO: menos de ${MIN_MB} MB disponíveis."; exit 1; fi

git rev-parse HEAD > .novabot-previous-commit
git fetch -q origin "$BRANCH"
if [[ "$(git rev-parse HEAD)" == "$(git rev-parse "origin/$BRANCH")" && "$WITH_COMPUTER" == false ]]; then
  log "Já está na última versão ($(git rev-parse --short HEAD))."; exit 0
fi
for image in "${IMAGES[@]}" novabot-agent-computer; do
  if docker image inspect "$image:latest" >/dev/null 2>&1; then docker tag "$image:latest" "$image:rollback"; fi
done
git merge -q --ff-only "origin/$BRANCH"
log "Código: $(cat .novabot-previous-commit | cut -c1-7) -> $(git rev-parse --short HEAD)"

build() { # um build por vez, prioridade baixa
  local tag=$1 file=$2 ctx=$3; shift 3
  log "build $tag"
  (( $(avail_mb) >= MIN_MB )) || { log "ABORTADO: RAM caiu abaixo de ${MIN_MB} MB"; rollback; exit 1; }
  nice -n 10 docker build -q -f "$file" -t "$tag:latest" "$@" "$ctx" >/dev/null || { log "build de $tag falhou"; rollback; exit 1; }
}
build novabot-server server/Dockerfile . --build-arg TENANT_PACKAGE_DIR=../examples/novagente
build novabot-agent-bot agent-bot/Dockerfile .
build novabot-embed embed/Dockerfile embed
build novabot-supervisor supervisor/Dockerfile .
if [[ "$WITH_COMPUTER" == true ]]; then build novabot-agent-computer agent-computer/Dockerfile .; fi

"${COMPOSE[@]}" up -d
if healthy; then
  log "OK: /health 200 em $(git rev-parse --short HEAD). RAM disponível: $(avail_mb) MB"
else
  log "server não ficou saudável"; rollback; exit 1
fi
