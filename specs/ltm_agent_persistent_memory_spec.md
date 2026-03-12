# LTM Agent — Persistent Memory Specification (Agent Script)

This document defines the Agent Script changes required to implement Long-Term Persistent Memory in the `ltm_agent`, following the architecture described in [Implementing Persistent Memory in Agent Script](./Implementing%20Persistent%20Memory%20in%20Agent%20Script.md).

---

## Overview

The implementation integrates the **Fetch Data Before Reasoning** pattern into the existing `ltm_agent` structure. It:

1. Fetches user context from the database at session start (before LLM routing)
2. Injects memory variables into system instructions and topic prompts
3. Exposes a save tool for the LLM to persist conversation state when the user indicates they are done

**Prerequisites (outside Agent Script):** See [Section 5. Prerequisites](#5-prerequisites) for full definitions and CRM creation instructions.

---

## 5. Prerequisites — Definitions and CRM Creation Instructions

The following items must exist in Salesforce before implementing the Agent Script changes. Create them in the order listed.

---

### 5.1 Agent_Context__c Custom Object (DMO)

The `Agent_Context__c` custom object stores the agent's long-term memory per Contact. Create it in Salesforce Setup.

#### 5.1.1 Create the Custom Object

1. In Salesforce, go to **Setup** → **Object Manager**.
2. Click **Create** → **Custom Object**.
3. Configure:
   - **Label:** `Agent Context`
   - **Plural Label:** `Agent Contexts`
   - **Object Name:** `Agent_Context` (API Name will be `Agent_Context__c`)
   - **Record Name:** Use the default "Name" or set a custom label (e.g., "Agent Context Name")
   - **Data Type for Name field:** Text (or Auto Number if you prefer)
   - **Optional:** Enable "Allow Search", "Allow in Chatter Groups", "Allow Reports", "Allow Activities" as needed for your org
4. Click **Save**.

#### 5.1.2 Add Custom Fields

Create the following fields on `Agent_Context__c`:

| # | Field Label | API Name | Data Type | Length | Required | Description |
|---|-------------|----------|-----------|--------|----------|-------------|
| 1 | Contact | Contact__c | Lookup(Contact) | — | Yes* | Links this memory record to the user. Set as unique if one record per Contact. |
| 2 | Last Topic Summary | Last_Topic_Summary__c | Long Text Area | 32,768 | No | LLM-generated summary of the user's last interaction. |
| 3 | Pending Goal | Pending_Goal__c | Text | 255 | No | What the user was trying to achieve but didn't finish. |
| 4 | Unresolved Issue | Unresolved_Issue__c | Checkbox | — | No | Checked if the user left angry or with an open support ticket. |
| 5 | Communication Style | Communication_Style__c | Text | 50 | No | User preference for tone (e.g., "Concise", "Detailed", "Technical"). |
| 6 | User Tier | User_Tier__c | Text | 50 | No | Loyalty or service tier (e.g., "Standard", "VIP"). |

\* **Contact:** Make the lookup required if you want to enforce one context per Contact. Consider adding a **Unique** constraint on `Contact__c` so each Contact has at most one Agent Context record (via a custom unique index or validation rule).

**Steps to add each field:**

1. Go to **Object Manager** → **Agent Context** → **Fields & Relationships**.
2. Click **New**.
3. For each field:
   - **Contact__c:** Choose "Lookup Relationship" → Contact. Set "Required" if desired.
   - **Last_Topic_Summary__c:** Choose "Long Text Area", Length 32,768.
   - **Pending_Goal__c:** Choose "Text", Length 255.
   - **Unresolved_Issue__c:** Choose "Checkbox".
   - **Communication_Style__c:** Choose "Text", Length 50.
   - **User_Tier__c:** Choose "Text", Length 50.
4. Save each field.

#### 5.1.3 Optional: Enforce One Record per Contact

To ensure one `Agent_Context__c` record per Contact:

- Add a **Validation Rule** on `Agent_Context__c` that prevents duplicates on `Contact__c`, or
- Use an **Upsert** in the Save Flow (see 5.3) keyed by `Contact__c`.

---

### 5.2 Get_Agent_ContextObject Flow (Read)

Autolaunched Flow that fetches the user's stored context at session start. **Implementation uses Apex-backed flow** invoking `LoadAgentMemory`.

#### 5.2.1 Create the Flow

1. Go to **Setup** → **Flows** → **New Flow** → **Autolaunched Flow**.
2. Name: `Get_Agent_ContextObject` (API Name: `Get_Agent_ContextObject`).

#### 5.2.2 Input Variable

| API Name | Data Type | Available for input | Description |
|----------|-----------|---------------------|-------------|
| contact_id | Text | Yes | The Contact ID (18-char) to look up. |

#### 5.2.3 Logic

1. **Get Records** element:
   - Object: `Agent_Context__c`
   - Filter: `Contact__c` Equals `{!contact_id}`
   - Store in: `varAgentContext` (or similar variable)
   - Sort: None (or by CreatedDate DESC if multiple records)
   - Limit: 1

2. **Apex-backed implementation:** The flow invokes `LoadAgentMemory` Apex, which returns `agent_memory`, `memorySummary`, `memoryGoal`, `hasIssue`, `memoryStyle`. The flow assigns these to output variables.

#### 5.2.4 Output Variables

| API Name | Data Type | Available for output | Description |
|----------|-----------|------------------------|-------------|
| agent_memory | Text | Yes | Formatted merge of all memory fields. |
| memory_summary | Text | Yes | Previous conversation summary. |
| memory_goal | Text | Yes | Pending goal. |
| memory_has_issue | Boolean | Yes | Unresolved issue flag. |
| memory_style | Text | Yes | Preferred communication style. |

4. **Save** and **Activate** the Flow.

---

### 5.3 Save_Agent_ContextObject Flow (Write)

Autolaunched Flow that persists the conversation context when the user ends the session. **Implementation uses Apex-backed flow** invoking `SaveAgentContext`.

#### 5.3.1 Create the Flow

1. Go to **Setup** → **Flows** → **New Flow** → **Autolaunched Flow**.
2. Name: `Save_Agent_ContextObject` (API Name: `Save_Agent_ContextObject`).

#### 5.3.2 Input Variables

| API Name | Data Type | Available for input | Description |
|----------|-----------|---------------------|-------------|
| contact_id | Text | Yes | The Contact ID. |
| new_summary | Text | Yes | 2–3 sentence summary of the current conversation. |
| new_goal | Text | Yes | Any goal the user started but didn't finish. |
| has_issue | Boolean | Yes | True if the user is leaving angry or with an unresolved issue. |

#### 5.3.3 Logic

1. **Get Records** to find existing `Agent_Context__c` where `Contact__c` = `{!contact_id}`.
2. **Decision:** Record found?
   - **Yes:** **Update Records** — update the record with `new_summary`, `new_goal`, `has_issue` (and optionally `style`, `tier` if passed).
   - **No:** **Create Records** — create a new `Agent_Context__c` with:
     - `Contact__c` = `{!contact_id}`
     - `Last_Topic_Summary__c` = `{!new_summary}`
     - `Pending_Goal__c` = `{!new_goal}`
     - `Unresolved_Issue__c` = `{!has_issue}`
3. Set output `success` = `true` (or `false` if an error path exists).

**Alternative:** Use **Upsert** on `Agent_Context__c` with `Contact__c` as the external ID (if configured) to simplify create/update logic.

#### 5.3.4 Output Variable

| API Name | Data Type | Available for output | Description |
|----------|-----------|------------------------|-------------|
| success | Boolean | Yes | Whether the save succeeded. |

4. **Save** and **Activate** the Flow.

---

### 5.4 Prerequisites Checklist

| Item | Status |
|------|--------|
| Agent_Context__c custom object created | ☐ |
| Contact__c (Lookup) field | ☐ |
| Last_Topic_Summary__c (Long Text) field | ☐ |
| Pending_Goal__c (Text 255) field | ☐ |
| Unresolved_Issue__c (Checkbox) field | ☐ |
| Communication_Style__c (Text 50) field | ☐ |
| User_Tier__c (Text 50) field | ☐ |
| Get_Agent_ContextObject Flow created and activated | ☐ |
| Save_Agent_ContextObject Flow created and activated | ☐ |

---

## 1. Config Changes

No changes to `config` block. Keep existing `developer_name`, `agent_label`, `description`, etc.

---

## 2. System Block Changes

**Current:**
```yaml
system:
    instructions: "You are an AI Agent."
    messages:
        welcome: "Hi, I'm an AI assistant. How can I help you?"
        error: "Sorry, it looks like something has gone wrong."
```

**Proposed:**
```yaml
system:
    instructions: |
        You are a highly personalized AI assistant for products and services.
        Always adapt your tone to match the user's preferred communication style: {@variables.communication_style}.
        If the user's tier is VIP ({@variables.user_tier} == "VIP"), provide premium, highly detailed white-glove service.
    messages:
        welcome: "Accessing your profile..."
        error: "Sorry, it looks like something has gone wrong."
```

---

## 3. Variables Block Changes

**Add** the following variables (keep all existing variables: `EndUserId`, `RoutableId`, `ContactId`, `EndUserLanguage`, `VerifiedCustomerId`):

```yaml
    # --- Persistent Memory (Long-Term Context) ---
    context_loaded: mutable boolean = False
        description: "Flag to ensure we only fetch memory from the database once per session."
    user_tier: mutable string = "Standard"
        description: "The user's service level. Can be Standard or VIP."
    communication_style: mutable string = "Detailed"
        description: "How the user prefers to be spoken to (e.g., Concise, Detailed, Technical)."
    last_summary: mutable string = ""
        description: "A summary of the previous conversation."
    pending_goal: mutable string = ""
        description: "An incomplete task from a previous session."
    unresolved_issue: mutable boolean = False
        description: "If True, the user had a negative experience or open issue recently."
```

**Note:** `ContactId` is already provided via `@MessagingEndUser.ContactId` and will be used as `contact_id` when calling the Flows.

---

## 4. Actions Block (New) — Flow Invocations

Add a top-level `actions` block (or equivalent) for the Flow invocations. In Agent Script, actions are typically defined within topics. For the **fetch** action, it must be callable from `start_agent`. The spec assumes actions can be defined at the agent level or in `start_agent`.

**fetch_user_context** (invoked from `start_agent`):
- **Input:** `contact_id` (string) — pass `@variables.ContactId`
- **Outputs:** `agent_memory`, `memory_summary`, `memory_goal`, `memory_has_issue`, `memory_style`
- **Target:** `flow://Get_Agent_ContextObject`

**save_user_context** (invoked from reasoning topics):
- **Inputs:** `contact_id`, `new_summary`, `new_goal`, `has_issue`, `new_style`
- **Output:** `success`
- **Target:** `flow://Save_Agent_ContextObject`

---

## 6. start_agent (topic_selector) Changes

**Pattern:** Fetch memory deterministically before the LLM reasons, then perform topic routing.

**Proposed structure:**

```yaml
start_agent topic_selector:
    label: "Topic Selector"
    description: "Fetches user context from the database, then routes the user to the appropriate topic."

    actions:
        fetch_user_context:
            description: "Fetches the user's permanent memory profile from the database."
            inputs:
                contact_id: string
                    description: "The user's Contact ID"
            outputs:
                agent_memory: string
                    description: "Formatted merge of memory fields"
                memory_summary: string
                    description: "Previous conversation summary"
                memory_goal: string
                    description: "Pending goal"
                memory_has_issue: boolean
                    description: "Unresolved issue flag"
                memory_style: string
                    description: "Preferred communication style"
            target: "flow://Get_Agent_ContextObject"

    reasoning:
        instructions: ->
            # 1. FETCH MEMORY BEFORE REASONING (deterministic)
            if @variables.context_loaded == False:
                run @actions.fetch_user_context
                    with contact_id=@variables.ContactId
                set @variables.agent_memory = @outputs.agent_memory
                set @variables.last_summary = @outputs.memory_summary
                set @variables.pending_goal = @outputs.memory_goal
                set @variables.unresolved_issue = @outputs.memory_has_issue
                set @variables.communication_style = @outputs.memory_style
                set @variables.context_loaded = True

            # 2. ROUTE TO TOPIC (LLM-based)
            | Select the tool that best matches the user's message and conversation history. If it's unclear, make your best guess.
        actions:
            go_to_escalation: @utils.transition to @topic.escalation
            go_to_off_topic: @utils.transition to @topic.off_topic
            go_to_ambiguous_question: @utils.transition to @topic.ambiguous_question
            go_to_product_information_retrieval: @utils.transition to @topic.product_information_retrieval
            go_to_service_plan_guidance: @utils.transition to @topic.service_plan_guidance
            go_to_order_status_updates: @utils.transition to @topic.order_status_updates
            go_to_issue_resolution_assistance: @utils.transition to @topic.issue_resolution_assistance
            go_to_feature_demonstrations: @utils.transition to @topic.feature_demonstrations
```

**Note:** If Agent Script does not support mixing procedural `if/run/set` with `|` prompt text in the same `instructions: ->` block, the implementation may need to use a two-step approach (e.g., a dedicated "fetch" topic that transitions to topic_selector after loading context). The final implementation will follow the actual Agent Script syntax supported by Salesforce.

---

## 7. Topic Changes — Memory-Aware Instructions and Save Tool

Each topic that handles user conversation (excluding pure routing topics like `off_topic` and `ambiguous_question`) should:

1. Include memory-aware instructions (unresolved issue, last summary, pending goal)
2. Expose the `save_user_context` action as a tool for the LLM to call when the user says goodbye

### 7.1 Shared Memory Preamble (for all conversational topics)

Add this block at the start of each topic's `reasoning.instructions`:

```
# Memory-aware preamble
if @variables.unresolved_issue == True:
    | ⚠️ The user had an unresolved issue last time. Start by sincerely apologizing and asking if it was resolved.
else:
    if @variables.last_summary != "":
        | The user's last conversation was: {@variables.last_summary}. Acknowledge them warmly based on this.
    else:
        | This is the user's first time interacting. Greet them warmly.

if @variables.pending_goal != "":
    | The user previously wanted to: {@variables.pending_goal}. Ask if they still want help with this.

| When the user indicates they are done or says goodbye, you MUST use the save_user_context tool to summarize this chat and save it to their profile.
```

### 7.2 Topics Requiring Full Memory + Save Tool

| Topic | Add Memory Preamble | Add save_user_context Action |
|-------|---------------------|------------------------------|
| escalation | Yes | Yes |
| product_information_retrieval | Yes | Yes |
| service_plan_guidance | Yes | Yes |
| order_status_updates | Yes | Yes |
| issue_resolution_assistance | Yes | Yes |
| feature_demonstrations | Yes | Yes |
| off_topic | No (redirect only) | No |
| ambiguous_question | No (redirect only) | No |

### 7.3 Example: product_information_retrieval (Full Implementation)

```yaml
topic product_information_retrieval:
    label: "Product Information Retrieval"
    description: "Assist users in finding detailed product information."

    actions:
        save_user_context:
            description: "Saves the updated conversation context and pending goals to the database."
            inputs:
                contact_id: string
                    description: "The user's Contact ID"
                new_summary: string
                    description: "A 2-3 sentence summary of THIS conversation."
                new_goal: string
                    description: "Any goal the user started but didn't finish today."
                has_issue: boolean
                    description: "True if the user is leaving angry or has an unresolved issue."
            outputs:
                success: boolean
                    description: "Whether the save was successful"
            target: "flow://Save_Agent_ContextObject"

    reasoning:
        instructions: ->
            | Memory-aware behavior:
            if @variables.unresolved_issue == True:
                | ⚠️ The user had an unresolved issue last time. Start by sincerely apologizing and asking if it was resolved.
            else:
                if @variables.last_summary != "":
                    | The user's last conversation was: {@variables.last_summary}. Acknowledge them warmly based on this.
                else:
                    | This is the user's first time interacting. Greet them warmly.

            if @variables.pending_goal != "":
                | The user previously wanted to: {@variables.pending_goal}. Ask if they still want help with this.

            | Assist the user in finding detailed product information.
            | When the user indicates they are done or says goodbye, you MUST use the save_user_context tool to summarize this chat and save it to their profile.
        actions:
            save_context_tool: @actions.save_user_context
                description: "Call this tool right before saying goodbye to save the conversation memory to the database."
                with contact_id=@variables.ContactId
                with new_summary=...
                with new_goal=...
                with has_issue=...
```

The same pattern applies to: `escalation`, `service_plan_guidance`, `order_status_updates`, `issue_resolution_assistance`, and `feature_demonstrations`.

---

## 8. Assumptions and Notes

1. **Flow API names:** `Get_Agent_ContextObject` and `Save_Agent_ContextObject` (Apex-backed via LoadAgentMemory and SaveAgentContext).
2. **ContactId availability:** `ContactId` may be null for unauthenticated users. The implementation should handle this (e.g., skip fetch/save when `ContactId` is empty, or use a fallback).
3. **Agent Script syntax:** The spec uses `instructions: ->` with procedural logic (`if`, `run`, `set`) as shown in the reference. If Salesforce Agent Script differs (e.g., no procedural block in `start_agent`), the implementation will adapt to the supported syntax.
4. **Template expressions:** `{@variables.xyz}` and `{!@variables.xyz}` — use the correct syntax per Agent Script documentation.

---

## 9. Summary of Files to Modify

| File | Changes |
|------|---------|
| `force-app/main/default/aiAuthoringBundles/ltm_agent/ltm_agent.agent` | All Agent Script changes described above |

---

## 10. Implementation Checklist (Post-Approval)

**Phase 1 — Prerequisites (create in Salesforce CRM first):**
- [ ] Create `Agent_Context__c` custom object (Section 5.1)
- [ ] Add all 6 custom fields to `Agent_Context__c` (Section 5.1.2)
- [ ] Create and activate `Get_Agent_ContextObject` Flow (Section 5.2)
- [ ] Create and activate `Save_Agent_ContextObject` Flow (Section 5.3)

**Phase 2 — Agent Script:**
- [ ] Update `system.instructions` with memory-aware tone
- [ ] Add 6 new variables: `context_loaded`, `user_tier`, `communication_style`, `last_summary`, `pending_goal`, `unresolved_issue`
- [ ] Add `fetch_user_context` action and deterministic fetch logic to `start_agent`
- [ ] Add `save_user_context` action and `save_context_tool` to: escalation, product_information_retrieval, service_plan_guidance, order_status_updates, issue_resolution_assistance, feature_demonstrations
- [ ] Add memory preamble to reasoning instructions in those same topics
- [ ] Verify Flow targets and variable names match the Flows once created

---

*This specification is ready for review and explicit approval. After approval, the changes will be implemented in `ltm_agent.agent`.*
