#!/usr/bin/env bash
# Checks that all third-party GitHub Actions in .github/workflows/*.yml
# are pinned to a full 40-character commit SHA, not a tag or branch.
#
# Exits 0 if all are pinned, 1 if any are not.

set -euo pipefail

ERRORS=0

for file in .github/workflows/*.yml .github/workflows/*.yaml; do
  [ -f "$file" ] || continue

  # Extract all `uses:` lines, skip local actions (starting with ./)
  while IFS= read -r line; do
    # Extract the action reference (everything after "uses:")
    ref=$(echo "$line" | sed -n 's/.*uses:\s*//p' | xargs)

    # Skip local actions
    [[ "$ref" == ./* ]] && continue
    # Skip empty
    [[ -z "$ref" ]] && continue
    # Skip docker:// references
    [[ "$ref" == docker://* ]] && continue

    # Extract the part after @
    pin=$(echo "$ref" | sed -n 's/.*@//p')

    # Check if it's a 40-character hex string (full SHA)
    if ! echo "$pin" | grep -qE '^[0-9a-f]{40}$'; then
      echo "ERROR: $file: action not pinned to full SHA: $ref"
      ERRORS=$((ERRORS + 1))
    fi
  done < <(grep -n 'uses:' "$file" || true)
done

if [ "$ERRORS" -gt 0 ]; then
  echo ""
  echo "Found $ERRORS action(s) not pinned to a full commit SHA."
  echo "Pin each action to a 40-character commit hash with a version comment."
  exit 1
fi

echo "All actions are pinned to full commit SHAs."
exit 0

