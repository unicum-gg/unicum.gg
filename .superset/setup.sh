#!/usr/bin/env bash
set -euo pipefail

# pnpm monorepo install. Uses the shared global store, so this is mostly
# hardlinking after the first run. postinstall auto-generates the openapi
# spec + local/page route registries (filesystem-derived, no server/DB).
pnpm install --frozen-lockfile

# Copy the gitignored env files from the main checkout: they hold the real
# (shared) secrets and are never committed, so a fresh worktree has none.
# `pnpm env:init` only writes an empty template, so a copy is what we want.
copy_env() {
  local rel="$1" src="$SUPERSET_ROOT_PATH/$1"
  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$rel")"
    cp "$src" "$rel"
    echo "  copied $rel"
  else
    echo "  skip $rel (absent from root checkout)"
  fi
}

echo "Syncing env files from $SUPERSET_ROOT_PATH"
copy_env apps/web/.env.local
copy_env apps/bot/.env.local
