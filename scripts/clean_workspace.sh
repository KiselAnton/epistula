#!/usr/bin/env bash
set -euo pipefail

# Cleans ephemeral build artifacts and temporary files from the repo.
# Dry-run by default. Pass --force to actually delete. Use --stash to move files into /temp instead of deleting.
# ISO cache: isos/ is preserved by default. Pass --purge-iso to also delete it.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FORCE=false
STASH=false
PURGE_ISO=false
if [[ "${1:-}" == "--force" ]]; then
  FORCE=true
fi
if [[ "${1:-}" == "--stash" ]]; then
  STASH=true
fi
if [[ "${1:-}" == "--purge-iso" ]]; then
  PURGE_ISO=true
fi

mapfile -t TARGETS < <(
  {
    # Directories
    [[ -d "$ROOT_DIR/work" ]] && echo "DIR $ROOT_DIR/work"
    if [[ "$PURGE_ISO" == true ]]; then
      [[ -d "$ROOT_DIR/isos" ]] && echo "DIR $ROOT_DIR/isos"
    fi

    # Files
    find "$ROOT_DIR" -type f -name 'check_*.sql' -print | sed 's/^/FILE /'
    find "$ROOT_DIR" -type f -name 'md5sum.txt' -print | sed 's/^/FILE /'
    find "$ROOT_DIR" -type f -name 'boot.catalog' -print | sed 's/^/FILE /'
    # Root-only *.js files (avoid removing legitimate app files deeper)
    find "$ROOT_DIR" -maxdepth 1 -type f -name '*.js' -print | sed 's/^/FILE /'
  } | sort -u
)

echo "\n=== Cleanup Targets ==="
if [[ ${#TARGETS[@]} -eq 0 ]]; then
  echo "Nothing to clean."
  exit 0
fi

printf '%s\n' "${TARGETS[@]}" | sed 's/^/- /'

if [[ "$FORCE" != true && "$STASH" != true ]]; then
  echo -e "\nDry run complete. Use --force to delete or --stash to move files into /temp." 
  exit 0
fi

if [[ "$STASH" == true ]]; then
  STASH_DIR="$ROOT_DIR/temp"
  mkdir -p "$STASH_DIR"
  echo -e "\n=== Stashing files to $STASH_DIR ==="
  # Only stash FILE entries (leave DIRs to delete if --force is also passed)
  for entry in "${TARGETS[@]}"; do
    kind="${entry%% *}"; path="${entry#* }"
    if [[ "$kind" == "FILE" ]]; then
      dest="$STASH_DIR/$(basename "$path")"
      if [[ -f "$path" ]]; then
        mv -f -- "$path" "$dest" && echo "Stashed: $dest" || echo "Failed to stash: $path"
      fi
    fi
  done
  # Remove stashed files from TARGETS so we don't delete them below unless --force is also set
  if [[ "$FORCE" != true ]]; then
    echo "\nStash complete."
    exit 0
  fi
fi

echo -e "\n=== Deleting ==="
for entry in "${TARGETS[@]}"; do
  kind="${entry%% *}"
  path="${entry#* }"
  if [[ "$kind" == "DIR" ]]; then
    rm -rf -- "$path"
    echo "Removed directory: $path"
  else
    # If we already stashed files, skip deleting them (they don't exist anymore)
    rm -f -- "$path"
    echo "Removed file: $path"
  fi
done

echo "\nCleanup completed."
