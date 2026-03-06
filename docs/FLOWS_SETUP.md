# Flow Setup Instructions for Persistent Memory

Create these two Autolaunched Flows in Salesforce **before** deploying the agent.  
The agent invokes them via:

- `flow://Get_Agent_ContextObject`
- `flow://Save_Agent_ContextObject`

## Prerequisites

- `Agent_Context__c` custom object deployed (with all 6 fields)
- Go to **Setup** → **Flows** → **New Flow** → **Autolaunched Flow**

---

## Troubleshooting: "I don't see Agent_Context__c fields in the Flow filter"

If the Get Records element does not show `Agent_Context__c` or its fields (e.g., `Contact__c`) when building the filter, the object likely lacks **profile permissions**. Custom objects deployed via metadata are not automatically added to profiles.

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

If the object has profile access but **no fields appear** in the Get Records filter dropdown, Field-Level Security may be blocking the fields.

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

- **Refresh the Flow Builder** (close the flow tab and reopen, or hard refresh the page with Ctrl+Shift+R / Cmd+Shift+R)
- The object and its fields should now appear when you select `Agent_Context__c` in the Get Records element
- If the field dropdown is searchable, try typing **Contact** to find `Contact__c`

---

## 1. Get_Agent_ContextObject Flow

### 1.1 Create Flow

- **Flow Type:** Autolaunched Flow
- **Label:** Get Agent Context Object
- **API Name:** `Get_Agent_ContextObject`

### 1.2 Create Input Variable


| Property            | Value                     |
| ------------------- | ------------------------- |
| API Name            | `contact_id`              |
| Data Type           | Text                      |
| Available for input | ✓ Checked                 |
| Available for output| ✗ Unchecked               |
| Description         | The Contact ID to look up |


### 1.3 Create Output Variables

Create this output variable (Available for output = ✓):


| API Name        | Data Type | Object Type         | Description                                   |
| --------------- | --------- | ------------------- | --------------------------------------------- |
| `context_record`| SObject   | `Agent_Context__c`  | `Agent_Context__c` record returned to script  |


### 1.4 Build Flow Logic

1. **Get Records** element (name: `Get_Agent_Context_Record`)
  - Object: `Agent_Context__c`
  - Condition: `Contact__c` Equals `{!contact_id}`
  - Sort: None
  - How many records to store: **Only the first record**
2. **Assignment** element (name: `Set_Context_Record_Output`)
  - Assign:
    - `context_record` = `{!Get_Agent_Context_Record}`
3. Connect: Start → Get Records → Assignment → End

### 1.5 Save and Activate

- **Save** the flow
- **Activate** the flow

---

## 2. Save_Agent_ContextObject Flow

### 2.1 Create Flow

- **Flow Type:** Autolaunched Flow
- **Label:** Save Agent Context Object
- **API Name:** `Save_Agent_ContextObject`
- **Run Mode:** System Mode Without Sharing

### 2.2 Create Input Variables


| API Name         | Data Type | Object Type         | Available for input | Description |
| ---------------- | --------- | ------------------- | ------------------- | ----------- |
| `contact_id`     | Text      | -                   | ✓                   | Contact used to find or create `Agent_Context__c` |
| `context_record` | SObject   | `Agent_Context__c`  | ✓                   | Full object payload from Agent Script |
| `new_summary`    | Text      | -                   | ✓                   | New `Last_Topic_Summary__c` value |
| `new_goal`       | Text      | -                   | ✓                   | New `Pending_Goal__c` value |
| `has_issue`      | Boolean   | -                   | ✓                   | New `Unresolved_Issue__c` value |
| `new_style`      | Text      | -                   | ✓                   | New `Communication_Style__c` value |


### 2.3 Create Output Variable


| API Name  | Data Type | Available for output |
| --------- | --------- | -------------------- |
| `success` | Boolean   | ✓                    |


### 2.4 Build Flow Logic

1. **Assignment** (name: `Apply_Extracted_Memory`)
  - Apply extracted scalar inputs into object payload:
    - `context_record.Last_Topic_Summary__c` = `{!new_summary}`
    - `context_record.Pending_Goal__c` = `{!new_goal}`
    - `context_record.Unresolved_Issue__c` = `{!has_issue}`
    - `context_record.Communication_Style__c` = `{!new_style}`
2. **Get Records** (name: `Get_Existing_Context`)
  - Object: `Agent_Context__c`
  - Condition: `Contact__c` Equals `{!contact_id}`
  - Store: Only the first record
3. **Decision** (name: `Context_Exists`)
  - Outcome: **Record Found** when `Get_Existing_Context` is not null
  - Default outcome: **Record Not Found**
4. **If Record Found path**
  - **Assignment** (name: `Set_Context_Id`)
    - `context_record.Id` = `{!Get_Existing_Context.Id}`
  - **Update Records** (name: `Update_Context_Record`)
    - Record source: `{!context_record}`
5. **If Record Not Found path**
  - **Assignment** (name: `Set_Context_Contact`)
    - `context_record.Contact__c` = `{!contact_id}`
  - **Create Records** (name: `Create_Context_Record`)
    - Record source: `{!context_record}`
6. **Assignment** (name: `Assign_Success`)
  - `success` = `true` (after both create/update paths)
7. Connect: Start → Apply_Extracted_Memory → Get_Existing_Context → Context_Exists → (Set Id + Update OR Set Contact + Create) → Assign_Success → End

### 2.5 Save and Activate

- **Save** and **Activate** the flow

---

## Verification

After creating both flows:

1. Ensure both flows are **Active**
2. Confirm agent action targets use:
   - `flow://Get_Agent_ContextObject`
   - `flow://Save_Agent_ContextObject`
3. Deploy the agent (`ltm_agent.agent` or `ltm_agent_checkpoint.agent`)
4. Test in a Messaging session with a Contact that has `ContactId` populated

