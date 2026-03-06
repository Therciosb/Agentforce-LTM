# Agentforce Persistent Memory Guide

This document is the merged, practical source of truth for persistent memory in `ltm_agent`.

It consolidates and updates:

- `specs/Implementing Persistent Memory in Agent Script.md`
- `specs/ltm_agent_persistent_memory_spec.md`

and aligns them with the current implementation in:

- `force-app/main/default/aiAuthoringBundles/ltm_agent/ltm_agent.agent`

---

## 1) Goal

Enable long-term memory for Agentforce so the agent can:

- remember prior conversation summary
- resume unfinished goals
- detect unresolved issues
- adapt tone by communication style and user tier

Memory is persisted in Salesforce (`Agent_Context__c`) and loaded at session start through flows.

---

## 2) Architecture

### Components

- **Agent Script**: deterministic startup + conversational behavior
- **Custom Object**: `Agent_Context__c`
- **Read Flow**: `Get_Agent_ContextObject`
- **Write Flow**: `Save_Agent_ContextObject`

### Runtime sequence

1. `start_agent topic_selector` executes first.
2. It calls `flow://Get_Agent_ContextObject` once per session.
3. Flow output record is mapped once to a mutable object variable (`agent_context`).
4. Agent transitions to `topic general_assistance`.
5. On conversation end, `topic finalization` calls `flow://Save_Agent_ContextObject`.

---

## 3) Data Model (CRM)

Create custom object `Agent_Context__c` with these fields:

- `Contact__c` (Lookup(Contact))
- `Last_Topic_Summary__c` (Long Text Area)
- `Pending_Goal__c` (Text 255)
- `Unresolved_Issue__c` (Checkbox)
- `Communication_Style__c` (Text 50)
- `User_Tier__c` (Text 50)

Recommendation:

- Ensure one context record per contact (validation or upsert strategy).

---

## 4) Flow Contracts

## 4.1 `Get_Agent_ContextObject` (read)

Input:

- `contact_id` (Text)

Outputs:

- `context_record` (Record: `Agent_Context__c`)

Behavior:

- Query `Agent_Context__c` by `Contact__c = contact_id`
- Return the first matching record as `context_record`
- Agent Script reads fields from `@variables.agent_context.data.<FieldApiName>`

## 4.2 `Save_Agent_ContextObject` (write)

Inputs:

- `contact_id` (Text)
- `context_record` (Record: `Agent_Context__c`)

Output:

- `success` (Boolean)

Behavior:

- Find existing `Agent_Context__c` by `Contact__c = contact_id`
- If found, update the existing record from `context_record` payload
- If not found, create a new `Agent_Context__c` record
- Persist the full object payload so new DMO fields can be read/write-enabled in script without changing this flow

---

## 5) Agent Script Design (Current)

## 5.1 Variables

Core session variables used by memory logic:

- `ContactId` (mutable, test default in repo)
- `context_loaded` (boolean guard)
- `agent_context` (mutable object record payload)

Also kept:

- `EndUserId` (linked)
- `RoutableId` (linked)

Replace `YOUR_CONTACT_ID` in the agent script with a Contact ID from your org. Create test Contacts first, then use their IDs.

## 5.2 Startup fetch pattern

In `start_agent topic_selector`, memory is loaded deterministically:

- check `context_loaded == False`
- run `@actions.load_user_memory`
- map `@outputs.context_record` to `@variables.agent_context`
- set `context_loaded = True`
- transition to `@topic.general_assistance`

## 5.3 Main behavior

`topic general_assistance`:

- uses `agent_context.data.*` fields in prompt instructions
- personalizes greeting and follow-up
- exposes tools:
  - `escalate_to_human`
  - `go_to_finalization`

## 5.4 Save behavior

`topic finalization`:

- calls `save_context_tool` (bound to `Save_Agent_ContextObject`)
- `save_context_tool` provides the full `context_record` object payload
- `contact_id` remains deterministic from variables
- says goodbye

---

## 6) Critical Lessons Learned

These are the key implementation rules that avoided runtime failures:

1. **Map flow outputs inside the `run` block**
  - Keep `set @variables...=@outputs...` indented under `run @actions...`.
  - This is the most important stability fix.
2. **Use `recordInfo` shape correctly in prompts**
  - Object outputs from flow are record payloads with fields under `.data`.
  - Use `@variables.agent_context.data.Communication_Style__c` (not `@variables.agent_context.Communication_Style__c`).
3. **Avoid dynamic merge expressions in `system.instructions`**
  - Keep system instructions stable/plain.
  - Put personalization instructions in topic reasoning where state is available.
4. **Keep `start_agent` as the last topic block in file**
  - Required by current team convention and avoids parser/ordering confusion.
5. **Avoid duplicate context variable mappings**
  - Do not map the same context source twice (for example MessagingEndUser Contact mapping collisions).
6. **Flow success does not guarantee reasoning success**
  - If flow returns valid outputs but response is generic error, inspect reasoning path and output mapping order.

---

## 7) Permissions and Access Requirements

Agent runtime user needs:

- object permissions on `Agent_Context__c` (read/create/edit as needed)
- field-level permissions for all used fields
- read access to `Contact` when flow/filter requires it
- `RunFlow` permission

Flow recommendations:

- activated versions in org
- run mode configured appropriately for your security model

---

## 8) Practical Runbook

## 8.1 Validate

```bash
sf agent validate authoring-bundle --api-name ltm_agent
```

## 8.2 Deploy script bundle

```bash
sf project deploy start --source-dir force-app/main/default/aiAuthoringBundles/ltm_agent --target-org my-org
```

## 8.3 Publish

```bash
sf agent publish authoring-bundle --api-name ltm_agent --target-org my-org
```

## 8.4 Preview test

- Start a session and send `Hello`.
- Confirm trace shows:
  - successful `FunctionStep` for `load_user_memory`
  - no generic fallback error
  - personalized response referencing memory fields

---

## 9) Troubleshooting

## Symptom: Generic error right after successful memory flow step

Likely causes:

- output mapping performed outside the `run` block
- prompt construction issue in reasoning
- malformed dynamic instructions

Fix:

- move `set` mappings inside `run`
- simplify and stabilize instructions
- revalidate and republish

## Symptom: Publish fails with duplicate function definition

Cause:

- stale generated planner metadata collision

Fix:

- adjust local action developer name if needed
- redeploy authoring bundle
- republish

## Symptom: Publish fails with duplicate context variable mapping

Cause:

- same source context field mapped to multiple variables

Fix:

- remove duplicate mapping and keep a single canonical variable

---

## 10) Recommended Next Improvements

1. Replace hardcoded `ContactId` default with fully linked production mapping when channel context is guaranteed.
2. Add a small regression checklist for each publish:
  - load path
  - personalization path
  - save path
3. Add seeded test scenarios for all three test contacts and expected first-turn personalization assertions.

---

## 11) Scope Note

This guide is intentionally implementation-focused for the current `ltm_agent`.  
For broader conceptual background, the original spec files remain useful references.