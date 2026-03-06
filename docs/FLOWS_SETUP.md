# Flow Setup Instructions for Persistent Memory

The agent invokes these flows via:

- `flow://Get_Agent_ContextObject`
- `flow://Save_Agent_ContextObject`

Both flows are **Apex-backed**: they invoke `LoadAgentMemory` and `SaveAgentContext` Apex classes. Deploy the flows, Apex classes, and object together from this project.

## Prerequisites

- `Agent_Context__c` custom object deployed (with all 6 fields)
- `LoadAgentMemory.cls` and `SaveAgentContext.cls` Apex classes deployed

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

## 1. Get_Agent_ContextObject Flow

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

## 2. Save_Agent_ContextObject Flow

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

After creating both flows:

1. Ensure both flows are **Active**
2. Confirm agent action targets use:
   - `flow://Get_Agent_ContextObject`
   - `flow://Save_Agent_ContextObject`
3. Deploy the agent (`ltm_agent.agent` or `ltm_agent_checkpoint.agent`)
4. Test in a Messaging session with a Contact that has `ContactId` populated

