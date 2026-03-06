# Agentforce Quick Guide

End-to-end guide from creating a new project to deploying and activating an agent.

---

## Prerequisites

- **Salesforce CLI** installed (`sf` or `sfdx`). Check with: `sf --version`
- **Salesforce org** with Agentforce enabled (Einstein Copilot license)
- **User** with System Administrator or equivalent permissions

---

## 1. Create a New Project

Creates a Salesforce DX project with the standard directory structure.

```bash
sf template generate project --name MyAgentProject
```

| Flag | Purpose |
|------|---------|
| `--name` | Project name (also used for the root directory) |
| `--output-dir` | Where to create the project (default: current directory) |
| `--template` | `standard` (default), `empty`, or `analytics` |

**Explanation:** Generates `sfdx-project.json`, `force-app/`, and config files. Use `standard` for a full structure including `.gitignore`, VS Code settings, and Prettier.

---

## 2. Connect Your Org

Authenticate the CLI with your Salesforce org so you can deploy and run commands.

```bash
sf org login web --alias my-org --set-default
```

| Flag | Purpose |
|------|---------|
| `--alias` | Short name to reference the org (e.g. `my-org`) |
| `--set-default` | Use this org for commands that don't specify `--target-org` |
| `--instance-url` | For sandboxes: `https://mydomain--sandbox.sandbox.my.salesforce.com` |

**Explanation:** Opens a browser for login. After authenticating, the CLI stores the connection. Use the alias in later commands: `--target-org my-org`.

**For Agentforce preview:** Add chatbot scopes if needed:

```bash
sf org login web --alias my-org --set-default --scopes "sfap_api chatbot_api"
```

---

## 3. Create an Agent

Two main paths: **with an agent spec** (AI-assisted) or **from scratch** (boilerplate).

### Option A: With Agent Spec (AI-generated topics)

**Step 3a. Generate an agent spec**

```bash
sf agent generate agent-spec --type customer --role "Answer product questions and help with orders" --company-name "Acme Corp" --company-description "We sell widgets and provide support." --output-file specs/agentSpec.yaml --target-org my-org
```

| Flag | Purpose |
|------|---------|
| `--type` | `customer` (external) or `internal` (employee copilot) |
| `--role` | What the agent does |
| `--company-name` | Your company name |
| `--company-description` | Brief company description |
| `--output-file` | Path for the YAML spec (default: `specs/agentSpec.yaml`) |
| `--max-topics` | Max topics to generate (default: 5) |

**Explanation:** Uses an LLM to create a YAML spec with topics. Edit the file to refine topics before generating the bundle.

**Step 3b. Generate the authoring bundle from the spec**

```bash
sf agent generate authoring-bundle --spec specs/agentSpec.yaml --name "My Agent" --api-name my_agent --target-org my-org
```

| Flag | Purpose |
|------|---------|
| `--spec` | Path to the agent spec YAML |
| `--name` | Human-readable label |
| `--api-name` | API name (used in metadata and CLI) |

**Explanation:** Creates `force-app/main/default/aiAuthoringBundles/my_agent/` with an Agent Script file (`.agent`) and bundle metadata.

### Option B: From Scratch (boilerplate)

```bash
sf agent generate authoring-bundle --no-spec --name "My Agent" --api-name my_agent --target-org my-org
```

**Explanation:** Skips the spec and creates a minimal Agent Script. You define topics and logic manually.

---

## 4. Edit the Agent Script

The agent logic lives in the `.agent` file:

```
force-app/main/default/aiAuthoringBundles/<api-name>/<api-name>.agent
```

Edit topics, actions, variables, and instructions. Use the [Agent Script Manual](Agent%20Script%20Manual%20v3.md) for syntax.

---

## 5. Deploy Metadata (Custom Objects, Permission Sets, etc.)

Deploy any metadata the agent depends on (custom objects, flows, permission sets) before publishing.

```bash
sf project deploy start --source-dir force-app/main/default/objects --target-org my-org
sf project deploy start --source-dir force-app/main/default/permissionSets --target-org my-org
```

| Flag | Purpose |
|------|---------|
| `--source-dir` | Path to metadata to deploy |
| `--target-org` | Org alias or username |

**Explanation:** Pushes metadata to the org. Use `--source-dir` for specific folders, or omit to deploy the whole project.

**Deploy everything:**

```bash
sf project deploy start --target-org my-org
```

---

## 6. Create Flows (if required)

If your agent calls Flows (e.g. `flow://Get_Agent_ContextObject` or `flow://Save_Agent_ContextObject`), create them in the org before publishing.

- Go to **Setup** → **Flows** → **New Flow** → **Autolaunched Flow**
- Follow [FLOWS_SETUP.md](FLOWS_SETUP.md) for the LTM agent flows

Flows are typically created manually; they are not always stored in the project.

---

## 7. Assign Permission Sets to the Agent User

For Einstein Service Agents, assign permission sets to the agent user so it can run flows and access objects.

```bash
sf org assign permset --name Agent_Context_Access_Agent_User --target-org my-org --on-behalf-of ltm_agent@YOUR_ORG_ID.ext
```

| Flag | Purpose |
|------|---------|
| `--name` | Permission set API name |
| `--on-behalf-of` | Username of the agent user (replace YOUR_ORG_ID with your org ID) |

**Explanation:** The agent runs as a specific user. That user needs object and flow permissions. Get the agent username from **Setup** → **Users** (EinsteinServiceAgent User).

---

## 8. Validate the Agent Script

Check for syntax and logic errors before publishing.

```bash
sf agent validate authoring-bundle --api-name my_agent --target-org my-org
```

**Explanation:** Compiles the Agent Script and reports errors. Fix any issues before publishing.

---

## 9. Publish the Agent

Publishes the authoring bundle to the org and creates or updates the agent (Bot, BotVersion, GenAiPlannerBundle).

```bash
sf agent publish authoring-bundle --api-name my_agent --target-org my-org
```

| Flag | Purpose |
|------|---------|
| `--api-name` | API name of the authoring bundle |
| `--skip-retrieve` | Do not pull generated metadata back into the project |

**Explanation:** Validates the script, publishes to the org, creates/updates agent metadata, and retrieves it into the project. This can take 15–30 seconds.

---

## 10. Activate the Agent

Makes the agent available for use (chat, messaging, API).

```bash
sf agent activate --api-name my_agent --target-org my-org
```

**Explanation:** Only one version of an agent can be active at a time. Activation switches the live version to the one you just published.

---

## 11. Preview the Agent

Test the agent interactively from the CLI.

```bash
sf agent preview --api-name my_agent --target-org my-org
```

| Flag | Purpose |
|------|---------|
| `--use-live-actions` | Use real flows/Apex instead of simulated actions |

**Explanation:** Starts an interactive chat. Type messages and press Enter. Press ESC or Ctrl+C to exit.

---

## Quick Reference: Full Workflow

```bash
# 1. Create project
sf template generate project --name MyAgentProject
cd MyAgentProject

# 2. Connect org
sf org login web --alias my-org --set-default --scopes "sfap_api chatbot_api"

# 3. Create agent (from spec)
sf agent generate agent-spec --type customer --role "Your role" --company-name "Your Co" --company-description "..." --output-file specs/agentSpec.yaml --target-org my-org
sf agent generate authoring-bundle --spec specs/agentSpec.yaml --name "My Agent" --api-name my_agent --target-org my-org

# 4. Deploy metadata
sf project deploy start --target-org my-org

# 5. Validate
sf agent validate authoring-bundle --api-name my_agent --target-org my-org

# 6. Publish
sf agent publish authoring-bundle --api-name my_agent --target-org my-org

# 7. Activate
sf agent activate --api-name my_agent --target-org my-org

# 8. Preview
sf agent preview --api-name my_agent --target-org my-org
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "No access to Einstein Copilot" | User needs Einstein Copilot license; enable Agentforce in Setup |
| "This Agent Type should have a user assigned" | Set `default_agent_user` in the agent script to a real org username |
| "Permission set license doesn't match" | Create a permission set with the Einstein Agent license for the agent user |
| Flow fails with null contact_id | Ensure ContactId is populated (pre-chat, MEU update) or handle null in the agent script |
