#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-https://furnituredistributors.wolf.discount}"

echo "Smoke checking $BASE_URL"
for path in "/" "/fd/" "/fd/api/health" "/living-room" "/bedroom" "/kitchen-dining" "/recliners"; do
  code=$(curl -skS -o /tmp/fd-smoke.out -w '%{http_code}' "$BASE_URL$path" || true)
  bytes=$(wc -c </tmp/fd-smoke.out 2>/dev/null || echo 0)
  printf '%-28s %s %s bytes
' "$path" "$code" "$bytes"
done
