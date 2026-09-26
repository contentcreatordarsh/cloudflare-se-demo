#!/usr/bin/env bash
# Upload r2/flags/*.svg to the private R2 bucket as <CC>.svg (uppercase ISO code, e.g. SG.svg), 8 in parallel.
# Needs CLOUDFLARE_API_TOKEN (R2 edit) and CLOUDFLARE_ACCOUNT_ID in the environment.
set -euo pipefail
BUCKET="${BUCKET:-nova-country-flags}"
cd "$(dirname "$0")/../r2/flags"

put() {
  local key code
  key="$(echo "${1%.svg}" | tr '[:lower:]' '[:upper:]').svg"
  code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" -H "content-type: image/svg+xml" \
    --data-binary @"$1" \
    "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/r2/buckets/$BUCKET/objects/$key")
  [ "$code" = 200 ] || echo "FAILED $key ($code)"
}

n=0
for f in *.svg; do
  put "$f" &
  n=$((n + 1))
  (( n % 8 == 0 )) && wait
done
wait
echo "uploaded $n flags to r2://$BUCKET/"
