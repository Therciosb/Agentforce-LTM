#!/usr/bin/env node
/**
 * Test the LTM agent via Agent API with ContactId for persistent memory retrieval.
 *
 * Prerequisites:
 * 1. External Client App (ECA) with Client Credentials flow - see docs/TESTING_WITH_CONTACT_CONTEXT.md
 * 2. Access token from ECA (or run: sf org display --target-org YOUR_ORG --json | jq -r '.result.accessToken')
 *
 * Usage:
 *   node scripts/test-agent-api-with-contact.js [CONTACT_ID]
 *   Or set SF_CONTACT_ID and SF_TARGET_ORG
 *
 * Env vars:
 *   SF_ACCESS_TOKEN - Access token (required)
 *   SF_INSTANCE_URL - Instance URL (default: from sf org display)
 *   SF_AGENT_ID    - Agent/Bot ID (default: ltm_agent from BotDefinition)
 *   SF_TARGET_ORG - Org alias (default: my-org)
 *   SF_CONTACT_ID  - Contact ID for test (optional, pass as arg instead)
 */

const DEFAULT_ORG = process.env.SF_TARGET_ORG || 'my-org';
const DEFAULT_CONTACT = process.env.SF_CONTACT_ID || null;

const CONTACT_IDS = {
  alexander: process.env.SF_CONTACT_1,
  beverly: process.env.SF_CONTACT_2,
  charles: process.env.SF_CONTACT_3,
};

async function getOrgConfig() {
  const { execSync } = await import('child_process');
  const out = execSync(
    `sf org display --target-org ${DEFAULT_ORG} --json 2>/dev/null`,
    { encoding: 'utf-8' }
  );
  const j = JSON.parse(out);
  return {
    accessToken: j.result.accessToken,
    instanceUrl: j.result.instanceUrl,
  };
}

async function getAgentId() {
  const { execSync } = await import('child_process');
  const out = execSync(
    `sf data query --query "SELECT Id FROM BotDefinition WHERE DeveloperName = 'ltm_agent'" --target-org ${DEFAULT_ORG} --json 2>/dev/null`,
    { encoding: 'utf-8' }
  );
  const j = JSON.parse(out);
  if (j.result?.records?.[0]?.Id) return j.result.records[0].Id;
  throw new Error('Could not find ltm_agent BotDefinition');
}

function parseDomain(instanceUrl) {
  const u = new URL(instanceUrl);
  return u.hostname;
}

async function main() {
  const contactId = process.argv[2] || DEFAULT_CONTACT || CONTACT_IDS.alexander;
  if (!contactId) {
    console.error('Provide CONTACT_ID as argument or set SF_CONTACT_ID / SF_CONTACT_1');
    process.exit(1);
  }
  const sessionKey = crypto.randomUUID();

  let accessToken = process.env.SF_ACCESS_TOKEN;
  let instanceUrl = process.env.SF_INSTANCE_URL;
  let agentId = process.env.SF_AGENT_ID;

  if (!accessToken || !instanceUrl) {
    try {
      const org = await getOrgConfig();
      accessToken = accessToken || org.accessToken;
      instanceUrl = instanceUrl || org.instanceUrl;
    } catch (e) {
      console.error('Could not get org config. Set SF_ACCESS_TOKEN and SF_INSTANCE_URL, or ensure sf is authenticated.');
      process.exit(1);
    }
  }

  if (!agentId) {
    try {
      agentId = await getAgentId();
    } catch (e) {
      console.error('Could not get agent ID. Set SF_AGENT_ID or ensure ltm_agent exists.');
      process.exit(1);
    }
  }

  const domain = parseDomain(instanceUrl);
  const baseUrl = `https://${domain}`;

  // Agent API base - common patterns
  const sessionUrl = `${baseUrl}/services/agentforce/session`;
  const messageUrl = (sid) => `${baseUrl}/services/agentforce/session/${sid}/message`;
  const endUrl = (sid) => `${baseUrl}/services/agentforce/session/${sid}/end`;

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  const startBody = {
    agentId,
    bypassUser: true,
    sessionKey,
    variables: {
      '$Context.ContactId': contactId,
    },
  };

  console.log('Starting session with ContactId:', contactId);
  console.log('Session key:', sessionKey);
  console.log('Agent ID:', agentId);
  console.log('');

  let sessionId;
  try {
    const startRes = await fetch(sessionUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(startBody),
    });

    const startJson = await startRes.json().catch(() => ({}));
    if (!startRes.ok) {
      console.error('Start session failed:', startRes.status, startRes.statusText);
      console.error(JSON.stringify(startJson, null, 2));
      if (startRes.status === 401) {
        console.error('\nTip: Agent API may require a token from an External Client App (ECA) with Client Credentials flow.');
      }
      process.exit(1);
    }

    sessionId = startJson.sessionId || startJson.id;
    if (!sessionId) {
      console.error('No sessionId in response:', JSON.stringify(startJson, null, 2));
      process.exit(1);
    }
    console.log('Session started:', sessionId);
  } catch (e) {
    console.error('Request failed:', e.message);
    if (e.cause) console.error(e.cause);
    process.exit(1);
  }

  // Send a greeting to trigger the agent's initial response
  const msgBody = {
    sequenceId: 1,
    message: { type: 'UserMessage', text: 'Hi, I\'m back!' },
  };

  console.log('\nSending: "Hi, I\'m back!"');
  console.log('');

  try {
    const msgRes = await fetch(messageUrl(sessionId), {
      method: 'POST',
      headers,
      body: JSON.stringify(msgBody),
    });

    const msgJson = await msgRes.json().catch(() => ({}));
    if (!msgRes.ok) {
      console.error('Send message failed:', msgRes.status, msgRes.statusText);
      console.error(JSON.stringify(msgJson, null, 2));
      process.exit(1);
    }

    // Extract agent response text
    const messages = msgJson.messages || msgJson.response?.messages || [];
    const inform = messages.find((m) => m.type === 'Inform' || m.type === 'inform');
    const text = inform?.text ?? inform?.content ?? JSON.stringify(msgJson);

    console.log('--- Agent Response ---');
    console.log(typeof text === 'string' ? text : JSON.stringify(text, null, 2));
    console.log('---');

    // Evaluate personalization
    const fullText = typeof text === 'string' ? text : JSON.stringify(text);
    const hasContext =
      fullText.toLowerCase().includes('alexander') ||
      fullText.toLowerCase().includes('order') ||
      fullText.toLowerCase().includes('delayed') ||
      fullText.toLowerCase().includes('investigation') ||
      fullText.toLowerCase().includes('vip') ||
      fullText.toLowerCase().includes('previous');

    console.log('\n--- Evaluation ---');
    if (hasContext) {
      console.log('PASS: Response appears personalized (mentions order, Alexander, VIP, or previous context).');
    } else {
      console.log('CHECK: Response may not be personalized. Expected references to delayed order, VIP, or previous conversation.');
    }
  } catch (e) {
    console.error('Message request failed:', e.message);
  }

  // End session
  try {
    await fetch(endUrl(sessionId), { method: 'POST', headers });
  } catch (_) {}
}

main();
