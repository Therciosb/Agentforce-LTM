#!/bin/bash
# Seeds Agent_Context__c with test data for 3 contacts.
# Run from project root: ./scripts/seed-agent-context.sh [ORG_ALIAS]
# Or: SF_TARGET_ORG=my-org ./scripts/seed-agent-context.sh
#
# Requires Contact IDs from your org. Set these env vars or edit the script:
#   SF_CONTACT_1, SF_CONTACT_2, SF_CONTACT_3
# Create 3 test Contacts in your org first, then: export SF_CONTACT_1=003xxx SF_CONTACT_2=003yyy SF_CONTACT_3=003zzz

set -e
ORG="${1:-${SF_TARGET_ORG:-my-org}}"

CONTACT_1="${SF_CONTACT_1:?Set SF_CONTACT_1 to your first Contact ID (e.g. 003xxxxxxxxxxxxxxx)}"
CONTACT_2="${SF_CONTACT_2:?Set SF_CONTACT_2 to your second Contact ID}"
CONTACT_3="${SF_CONTACT_3:?Set SF_CONTACT_3 to your third Contact ID}"

echo "Seeding Agent_Context__c for org: $ORG"

sf data create record --sobject Agent_Context__c --target-org "$ORG" --values \
  "Name='Alexander Reed - Agent Context' Contact__c=$CONTACT_1 Last_Topic_Summary__c='Alexander called about a delayed order. He was frustrated that tracking showed delivered but he never received the package. We opened a support ticket and offered a 15% discount.' Pending_Goal__c='Order replacement and refund' Unresolved_Issue__c=true Communication_Style__c=Detailed User_Tier__c=VIP"

sf data create record --sobject Agent_Context__c --target-org "$ORG" --values \
  "Name='Beverly Chen - Agent Context' Contact__c=$CONTACT_2 Last_Topic_Summary__c='Beverly had a pleasant conversation about upgrading her subscription. She compared the Pro and Enterprise plans. No issues reported.' Pending_Goal__c='Upgrade to Enterprise plan' Unresolved_Issue__c=false Communication_Style__c=Detailed User_Tier__c=Standard"

sf data create record --sobject Agent_Context__c --target-org "$ORG" --values \
  "Name='Charles Davies - Agent Context' Contact__c=$CONTACT_3 Last_Topic_Summary__c='Charles needed help resetting his password and enabling 2FA. He asked about API rate limits for his integration project but ran out of time.' Pending_Goal__c='Check API rate limits for integration' Unresolved_Issue__c=false Communication_Style__c=Concise User_Tier__c=Standard"

echo "Done. 3 Agent_Context__c records created."
