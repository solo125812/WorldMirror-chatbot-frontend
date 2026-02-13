#!/usr/bin/env bash
set -euo pipefail

if [[ -n "${NVM_DIR:-}" && -s "${NVM_DIR}/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "${NVM_DIR}/nvm.sh"
elif [[ -s "${HOME}/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1090
  . "${HOME}/.nvm/nvm.sh"
fi

if command -v nvm >/dev/null 2>&1; then
  nvm use 22 >/dev/null
else
  NODE22_BIN="/opt/homebrew/opt/node@22/bin"
  if [[ -x "${NODE22_BIN}/node" ]]; then
    export PATH="${NODE22_BIN}:${PATH}"
  fi
fi

exec "$@"
