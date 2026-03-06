# Contributing to LTM-Agentforce

Thank you for your interest in contributing to LTM-Agentforce. This document provides guidelines for setting up the project and contributing changes.

## Prerequisites

- [Salesforce CLI](https://developer.salesforce.com/tools/sfdxcli) (`sf` or `sfdx`)
- Salesforce org with [Agentforce](https://help.salesforce.com/s/articleView?id=sf.einstein_agent_setup.htm) enabled (Einstein Copilot license)
- Node.js 18+ (for linting and tests)

## Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/<owner>/LTM-Agentforce.git
   cd LTM-Agentforce
   ```

2. **Replace placeholders** before deploying:
   - **Agent user**: Replace `YOUR_ORG_ID` in all `.agent` files and `*.bot-meta.xml` with your org ID.
     - Find it: Setup → Company Information → Organization ID
     - Or: `sf org display --target-org YOUR_ORG --json | jq -r '.result.orgId'`
   - **Contact IDs**: Replace `YOUR_CONTACT_ID` in agent scripts with a Contact ID from your org.
   - **Seed data**: Set `SF_CONTACT_1`, `SF_CONTACT_2`, `SF_CONTACT_3` when running the seed script, or edit `data/agent_context_seed.csv`.

3. **Authenticate with your org**
   ```bash
   sf org login web --alias my-org --set-default --scopes "sfap_api chatbot_api"
   ```

4. **Deploy and publish** — See [README.md](README.md) and [docs/QUICK_GUIDE.md](docs/QUICK_GUIDE.md).

## Development Workflow

- Run `npm run lint` and `npm run prettier:verify` before committing.
- Follow the existing code style (Prettier + ESLint).
- Update documentation when changing behavior.

## Pull Requests

1. Fork the repository and create a branch from `main`.
2. Make your changes and ensure tests pass.
3. Submit a PR with a clear description of the change.
4. Ensure no sensitive data (org IDs, credentials, real Contact IDs) is committed.

## Reporting Issues

When opening an issue, please include:

- Salesforce CLI version (`sf --version`)
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs or error messages (redact any org-specific IDs)
