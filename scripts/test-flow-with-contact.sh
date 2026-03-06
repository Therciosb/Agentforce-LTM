#!/bin/bash
# Verifies Get_Agent_Context flow returns correct data for a given Contact ID.
# Usage: ./scripts/test-flow-with-contact.sh [CONTACT_ID]
# Default: pass Contact ID and org as args, or set SF_CONTACT_ID and SF_TARGET_ORG

set -e
CONTACT_ID="${1:-${SF_CONTACT_ID}}"
ORG="${2:-${SF_TARGET_ORG:-my-org}}"

if [ -z "$CONTACT_ID" ]; then
  echo "Usage: $0 [CONTACT_ID] [ORG_ALIAS]"
  echo "  Or set SF_CONTACT_ID and SF_TARGET_ORG environment variables"
  echo "  Example: SF_CONTACT_ID=003xxxxxxxxxxxxxxx $0  # uses my-org by default"
  exit 1
fi

TOKEN=$(sf org display --target-org "$ORG" --json 2>/dev/null | jq -r '.result.accessToken')
INSTANCE=$(sf org display --target-org "$ORG" --json 2>/dev/null | jq -r '.result.instanceUrl')
DOMAIN=$(echo "$INSTANCE" | sed 's|https://||')

echo "Testing Get_Agent_Context flow with ContactId: $CONTACT_ID"
echo ""

RESP=$(curl -s -X POST "${INSTANCE}/services/data/v66.0/actions/custom/flow/Get_Agent_Context" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"inputs\":[{\"contact_id\":\"$CONTACT_ID\"}]}")

echo "$RESP" | jq -r '.[0] | if .isSuccess then
  "SUCCESS: Flow returned data\n",
  "  summary: \(.outputValues.summary // "null")\n",
  "  goal: \(.outputValues.goal // "null")\n",
  "  issue: \(.outputValues.issue // "null")\n",
  "  style: \(.outputValues.style // "null")\n",
  "  tier: \(.outputValues.tier // "null")"
else
  "FAILED: \(.errors)"
end'
