# Apex and Flow Setup for Persistent Memory

The LTM agents invoke **Apex actions directly**:

- `apex://LoadAgentMemory` — loads Agent_Context__c and returns formatted memory
- `apex://SaveAgentContext` — creates or updates Agent_Context__c

**Required:** Deploy the Apex classes (`LoadAgentMemory.cls`, `SaveAgentContext.cls`), `Agent_Context__c` object, and permission sets.

**Optional:** The project also includes Flow wrappers (`Get_Agent_ContextObject`, `Save_Agent_ContextObject`) that invoke the same Apex. These flows are useful for testing via REST API or if you prefer Flow-based orchestration. The agents use Apex directly for reliable publish validation.

## Prerequisites

- `Agent_Context__c` custom object deployed (with all 6 fields)
- `LoadAgentMemory.cls` and `SaveAgentContext.cls` Apex classes deployed

---

## 0. Apex Actions (Primary — Used by Agents)

The agents target Apex directly. Deploy Apex and object:

```bash
sf project deploy start --source-dir force-app/main/default/classes --target-org my-org
sf project deploy start --source-dir force-app/main/default/objects --target-org my-org
```

### LoadAgentMemory Contract

| API Name       | Data Type | I/O   | Description                                   |
| -------------- | --------- | ----- | --------------------------------------------- |
| `contactId`   | Text      | Input | The Contact ID to look up                     |
| `agentMemory` | Text      | Output| Formatted merge of memory fields              |
| `memorySummary` | Text   | Output| Last topic summary (checkpoint agents)        |
| `memoryGoal`  | Text      | Output| Pending goal (checkpoint agents)              |
| `hasIssue`    | Boolean   | Output| Unresolved issue flag (checkpoint agents)     |
| `memoryStyle` | Text      | Output| Communication style (checkpoint agents)        |

### SaveAgentContext Contract

| API Name    | Data Type | I/O   | Description |
| ----------- | --------- | ----- | ----------- |
| `contactId` | Text      | Input | Contact used to find or create `Agent_Context__c` |
| `newSummary`| Text      | Input | New `Last_Topic_Summary__c` value |
| `newGoal`   | Text      | Input | New `Pending_Goal__c` value |
| `hasIssue`  | Boolean   | Input | New `Unresolved_Issue__c` value |
| `newStyle`  | Text      | Input | New `Communication_Style__c` value |
| `success`   | Boolean   | Output| Whether save succeeded |

---

## Troubleshooting

**Note:** The LTM flows use Apex actions (`LoadAgentMemory`, `SaveAgentContext`), not Get Records elements. The agent user needs Apex class access via the `Agent_Context_Access_Agent_User` permission set.

### "I don't see Agent_Context__c fields" (when customizing flows or Apex)

If the object or its fields are not accessible, the object likely lacks **profile permissions**. Custom objects deployed via metadata are not automatically added to profiles.

### Fix: Grant object access to your profile

1. Go to **Setup** → **Users** → **Profiles**
2. Click your profile (e.g., **System Administrator**)
3. In the search box, type **Agent Context** or scroll to **Object Settings**
4. Find **Agent Context** in the list
5. Click **Edit** next to Agent Context
6. Enable: **Read**, **Create**, **Edit**, **Delete** (at minimum, **Read** and **Create** for both flows)
7. Click **Save**

### Alternative: Use a Permission Set

1. Go to **Setup** → **Permission Sets** → **New**
2. Label: `Agent Context Access`, API Name: `Agent_Context_Access`
3. Under **Object Settings**, add **Agent Context** with Read, Create, Edit, Delete
4. Assign the permission set to your user

### Fix 2: Field-Level Security (if object permissions are already set)

If the object has profile access but **no fields appear** when querying or building flows, Field-Level Security may be blocking the fields.

1. Go to **Setup** → **Object Manager** → **Agent Context**
2. Click **Fields & Relationships**
3. For **each** field (Contact, Last Topic Summary, Pending Goal, Unresolved Issue, Communication Style, User Tier):
   - Click the field name
   - Click **Set Field-Level Security**
   - Check **Visible** for **System Administrator** (and any other profiles that need flow access)
   - Click **Save**

### Fix 3: Deploy the Agent Context Access Permission Set (recommended)

This project includes a Permission Set that grants explicit field access. Deploy it and assign it to your user:

```bash
sf project deploy start --source-dir force-app/main/default/permissionSets
```

Then: **Setup** → **Permission Set Assignments** → **Manage Assignments** → Add **Agent Context Access** to your user.

### After updating permissions

- **Refresh** any Flow Builder tabs or Apex editors (hard refresh with Ctrl+Shift+R / Cmd+Shift+R)
- The object and its fields should now be accessible to the Apex classes and flows

---

## 1. Get_Agent_ContextObject Flow (Optional)

The Flow wraps `LoadAgentMemory` Apex. Use for REST API testing (e.g. `scripts/test-flow-with-contact.sh`).

### 1.1 Deploy from Project

The flow is in `force-app/main/default/flows/Get_Agent_ContextObject.flow-meta.xml`. Deploy with:

```bash
sf project deploy start --source-dir force-app/main/default
```

### 1.2 Flow Contract

| API Name        | Data Type | I/O   | Description                                   |
| --------------- | --------- | ----- | --------------------------------------------- |
| `contact_id`    | Text      | Input | The Contact ID to look up                     |
| `variable_name` | Text      | Input | Target variable name (optional, default: agent_memory) |
| `agent_memory`  | Text      | Output| Formatted merge of memory fields for script  |
| `memory_summary`| Text      | Output| Last topic summary (for checkpoint agents)    |
| `memory_goal`   | Text      | Output| Pending goal (for checkpoint agents)         |
| `memory_has_issue` | Boolean | Output| Unresolved issue flag (for checkpoint agents) |
| `memory_style`  | Text      | Output| Communication style (for checkpoint agents)  |

### 1.3 Flow Logic

- **Action** element invokes `LoadAgentMemory` Apex with `contactId` input
- Apex queries `Agent_Context__c`, formats fields into string, returns outputs
- Flow assigns Apex outputs to flow output variables

---

## 2. Save_Agent_ContextObject Flow (Optional)

The Flow wraps `SaveAgentContext` Apex.

### 2.1 Deploy from Project

The flow is in `force-app/main/default/flows/Save_Agent_ContextObject.flow-meta.xml`. Deploy with:

```bash
sf project deploy start --source-dir force-app/main/default
```

### 2.2 Flow Contract

| API Name      | Data Type | I/O   | Description |
| ------------- | --------- | ----- | ----------- |
| `contact_id`  | Text      | Input | Contact used to find or create `Agent_Context__c` |
| `new_summary` | Text      | Input | New `Last_Topic_Summary__c` value |
| `new_goal`    | Text      | Input | New `Pending_Goal__c` value |
| `has_issue`   | Boolean   | Input | New `Unresolved_Issue__c` value |
| `new_style`   | Text      | Input | New `Communication_Style__c` value |
| `success`     | Boolean   | Output| Whether save succeeded |

### 2.3 Flow Logic

- **Action** element invokes `SaveAgentContext` Apex with scalar inputs
- Apex queries by `contact_id`, creates or updates record, returns `success`

---

## Verification

After deploying Apex and object:

1. Ensure `LoadAgentMemory` and `SaveAgentContext` Apex classes are deployed
2. Confirm agent action targets use:
   - `apex://LoadAgentMemory`
   - `apex://SaveAgentContext`
3. Deploy the agent (`ltm_agent.agent` or `ltm_agent_checkpoint.agent`)
4. Assign `Agent_Context_Access_Agent_User` permission set to the agent user
5. Test in a Messaging session with a Contact that has `ContactId` populated

**Optional:** If using the Flow wrappers for testing, ensure both flows are **Active**.

