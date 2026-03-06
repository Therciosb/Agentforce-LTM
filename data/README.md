# Seed Data for LTM Agent

## Agent_Context__c Test Data

Template data for 3 contacts to test persistent memory retrieval.

### Setup

1. Create 3 test Contacts in your org (e.g., Alexander Reed, Beverly Chen, Charles Davies).
2. Get their Contact IDs from the Contact records.
3. Replace placeholders in `agent_context_seed.csv` or set environment variables for the seed script.

### Contact ID Placeholders

| Contact        | Placeholder         | Scenario                                      |
|----------------|---------------------|-----------------------------------------------|
| Alexander Reed | YOUR_CONTACT_ID_1   | VIP, unresolved issue, pending goal          |
| Beverly Chen   | YOUR_CONTACT_ID_2   | Standard, happy previous, upgrade pending    |
| Charles Davies | YOUR_CONTACT_ID_3   | Standard, concise style, API limits pending  |

### Seeding via Script

```bash
export SF_CONTACT_1=003xxxxxxxxxxxxxxx SF_CONTACT_2=003yyyyyyyyyyyyyyy SF_CONTACT_3=003zzzzzzzzzzzzzzz
./scripts/seed-agent-context.sh my-org-alias
```

### Seeding via CSV Import

1. Replace `YOUR_CONTACT_ID_1`, `YOUR_CONTACT_ID_2`, `YOUR_CONTACT_ID_3` in `agent_context_seed.csv` with your Contact IDs.
2. Use Data Loader or Salesforce Import to load the CSV into `Agent_Context__c`.

### Testing Data Retrieval

1. Configure your messaging channel so the session's `MessagingEndUser.ContactId` maps to one of your Contact IDs.
2. Start a chat as that contact.
3. The agent should greet the user with context from the previous conversation (e.g., for Alexander: acknowledge the delayed order, ask about the investigation).
