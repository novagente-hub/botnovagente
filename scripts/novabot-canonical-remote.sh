#!/usr/bin/env bash
set -euo pipefail

canonical="https://github.com/novagente-hub/botnovagente.git"
mode="${1:---check}"

if [[ "$mode" != "--check" && "$mode" != "--apply" ]]; then
  echo "Uso: bash scripts/novabot-canonical-remote.sh [--check|--apply]" >&2
  exit 2
fi

git rev-parse --is-inside-work-tree >/dev/null
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "ERRO: este checkout não possui o remoto origin." >&2
  exit 1
fi

if [[ "$mode" == "--apply" ]]; then
  git remote set-url origin "$canonical"
fi

actual="$(git remote get-url origin)"
case "$actual" in
  "https://github.com/novagente-hub/botnovagente"|\
  "https://github.com/novagente-hub/botnovagente.git"|\
  "git@github.com:novagente-hub/botnovagente"|\
  "git@github.com:novagente-hub/botnovagente.git"|\
  "ssh://git@github.com/novagente-hub/botnovagente.git")
    echo "OK: origin usa o repositório oficial da NOVAGENTE."
    ;;
  *)
    echo "ERRO: origin aponta para outro repositório: $actual" >&2
    echo "Para ajustar: bash scripts/novabot-canonical-remote.sh --apply" >&2
    exit 1
    ;;
esac
