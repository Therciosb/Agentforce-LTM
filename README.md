# LTM Agentforce

AI Agent with **long-term persistent memory** for personalized, context-aware conversations on Salesforce Agentforce.

The agent remembers prior conversation summaries, resumes unfinished goals, detects unresolved issues, and adapts tone by communication style and user tier. Memory is persisted in a custom object (`Agent_Context__c`) and loaded at session start via Apex invocable actions.

## Features

- **Persistent memory** — Stores conversation context per Contact in Salesforce
- **Personalization** — Adapts responses based on communication style, tier, and prior context
- **Checkpoint saves** — `ltm_agent_checkpoint` variant saves memory during conversation, not only at end
- **Apex-based** — Uses `LoadAgentMemory` and `SaveAgentContext` Apex invocable actions for read/write

## Prerequisites

- [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli) (`sf`)
- Salesforce org with [Agentforce](https://help.salesforce.com/s/articleView?id=sf.einstein_agent_setup.htm) enabled (Einstein Copilot license)

## Quick Start

1. **Replace placeholders** before deploying:
   - In all `.agent` files and `*.bot-meta.xml`: replace `YOUR_ORG_ID` with your org ID (Setup → Company Information, or `sf org display --json | jq -r '.result.orgId'`)
   - In agent scripts: replace `YOUR_CONTACT_ID` with a Contact ID from your org

2. **Deploy the custom object** — `Agent_Context__c` and its fields:
   ```bash
   sf project deploy start --source-dir force-app/main/default/objects --target-org my-org
   ```

3. **Deploy Apex and metadata** — Follow [docs/FLOWS_SETUP.md](docs/FLOWS_SETUP.md) for Apex setup, optional Flow wrappers, and permissions.

4. **Deploy metadata and publish the agent**:
   ```bash
   sf project deploy start --target-org my-org
   sf agent publish authoring-bundle --api-name ltm_agent --target-org my-org
   sf org assign permset --name Agent_Context_Access_Agent_User --target-org my-org --on-behalf-of ltm_agent@YOUR_ORG_ID.ext
   sf agent activate --api-name ltm_agent --target-org my-org
   ```

5. **Seed test data** (optional) — See [data/README.md](data/README.md).

## Documentation

| Document | Description |
|----------|--------------|
| [docs/QUICK_GUIDE.md](docs/QUICK_GUIDE.md) | End-to-end setup from project creation to activation |
| [docs/FLOWS_SETUP.md](docs/FLOWS_SETUP.md) | Apex setup and optional Flow wrappers for Agent Context |
| [docs/LTM_AGENT_PERSISTENT_MEMORY_GUIDE.md](docs/LTM_AGENT_PERSISTENT_MEMORY_GUIDE.md) | Architecture and implementation details |
| [specs/ltm_agent_persistent_memory_spec.md](specs/ltm_agent_persistent_memory_spec.md) | Full specification |

## Project Structure

```
force-app/main/default/
├── aiAuthoringBundles/     # Agent definitions (ltm_agent, ltm_agent_checkpoint, ltm_agent_test)
├── bots/                   # Bot metadata
├── flows/                  # Get/Save Agent Context flows
├── objects/Agent_Context__c/  # Custom object for persistent memory
└── permissionsets/        # Agent user permissions
data/                       # Seed data templates
docs/                       # Setup and usage guides
scripts/                    # Test and seed scripts
```

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/seed-agent-context.sh` | Seed `Agent_Context__c` with test data (requires `SF_CONTACT_1`, `SF_CONTACT_2`, `SF_CONTACT_3`) |
| `scripts/test-flow-with-contact.sh` | Test Get_Agent_ContextObject flow |
| `scripts/test-agent-api-with-contact.js` | Test agent via Agent API with Contact context |

Set `SF_TARGET_ORG` (default: `my-org`) and Contact IDs via environment variables. See [.env.example](.env.example).

## License

[MIT](LICENSE)
