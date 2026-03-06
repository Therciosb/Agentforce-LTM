# **Implementing Long-Term Persistent Memory in Agentforce**

By default, Agent Script variables act as short-term working memory. They are excellent for maintaining context and enforcing business rules during a single conversation, but they are wiped clean as soon as the session ends.

To give your AI Agent true long-term memory—allowing it to remember a user's preferences, past unresolved issues, and previous conversation summaries—you must bridge the gap between Agent Script variables and your Salesforce database.

This guide outlines a complete, generic architecture for implementing persistent memory using a Custom Object, autolaunched Flows, and the "Fetch Data Before Reasoning" Agent Script pattern.

## **Why Long-Term Memory Matters (Use Cases)**

Implementing persistent memory shifts an AI Agent from a simple, transactional bot to a deeply personalized, context-aware assistant. By remembering who the user is and what they were doing last time, the agent reduces friction and builds trust.

Here are three common use cases where long-term memory is highly applicable:

1. **Customer Support & Issue Resolution:** Instead of forcing users to repeat their problems every time they open a chat, the agent remembers if they had an unresolved issue in a previous session. It can proactively greet them with, *"I see you were having trouble with your router yesterday. Were you able to get it fixed, or should I open a support ticket?"*  
2. **Personalized E-Commerce & Retail:** The agent remembers abandoned goals and user preferences. If a customer was looking at winter coats but didn't buy one, the agent can resume the journey next time: *"Welcome back\! Last time, we were looking at waterproof jackets. Would you like to pick up where we left off?"* It can also enforce business rules, such as offering free expedited shipping only to users remembered as VIPs.  
3. **Financial Services & Advisory:**  
   For complex, multi-step processes like applying for a mortgage or planning for retirement, users often interact with an agent across several days or weeks. Long-term memory allows the agent to adopt the user's preferred communication style (e.g., highly detailed vs. concise) and maintain an ongoing summary of their financial goals without starting from scratch each session.

## **Phase 1: The Database Data Model**

To prevent cluttering your core standard objects (like Contact or User) with AI-specific metadata, it is best practice to create a dedicated custom object to store the agent's memory.

### **1\. Create the Agent\_Context\_\_c Custom Object**

Create a new custom object in Salesforce named Agent Context (API Name: Agent\_Context\_\_c).

### **2\. Add Custom Fields**

Add the following fields to the object to support a generic, cross-use-case memory model:

| Field Label | API Name | Data Type | Purpose |
| :---- | :---- | :---- | :---- |
| **Contact** | Contact\_\_c | Lookup(Contact) | Links this memory record to the specific user. |
| **Last Topic Summary** | Last\_Topic\_Summary\_\_c | Long Text Area | A brief, LLM-generated summary of the user's last interaction. |
| **Pending Goal** | Pending\_Goal\_\_c | Text(255) | What the user was trying to achieve but didn't finish (e.g., "Booking a flight"). |
| **Unresolved Issue** | Unresolved\_Issue\_\_c | Checkbox | Flags if the user left the last session angry or with an open support ticket. |
| **Communication Style** | Communication\_Style\_\_c | Text(50) | User preference for agent tone (e.g., "Concise", "Detailed", "Technical"). |
| **User Tier** | User\_Tier\_\_c | Text(50) | Loyalty or service tier (e.g., "Standard", "VIP") to drive business rules. |

## **Phase 2: The Integration Layer (Salesforce Flows)**

Agent Script cannot query the database directly; it relies on Actions. You need two Autolaunched Flows to act as the read/write mechanism for your agent.

### **1\. The "Read" Flow: Get\_Agent\_Context**

Create an Autolaunched Flow that the agent will call at the very beginning of a session.

* **Input Variable:** contact\_id (Text)  
* **Logic:** Perform a "Get Records" on Agent\_Context\_\_c where Contact\_\_c equals the contact\_id.  
* **Output Variables:** Map the retrieved record fields to output variables: summary, goal, issue (Boolean), style, and tier.

### **2\. The "Write" Flow: Save\_Agent\_Context**

Create an Autolaunched Flow that the agent will call when the conversation is ending.

* **Input Variables:** contact\_id (Text), new\_summary (Text), new\_goal (Text), has\_issue (Boolean).  
* **Logic:** Perform an "Update Records" (or "Upsert") on the Agent\_Context\_\_c record associated with that contact\_id, overwriting the old fields with the new inputs.  
* **Output Variable:** success (Boolean) to confirm the save.

## **Phase 3: The Agent Script Implementation**

With the database and integration layers ready, you can write the Agent Script.

This script utilizes the **Fetch Data Before Reasoning** pattern. It fetches the data deterministically before the LLM generates a response, injects that context into the prompt, and finally exposes a "save" tool for the LLM to use when the conversation concludes.

config:  
  agent\_name: "ContextAwareAgent"  
  agent\_label: "Context Aware Agent"  
  description: "An agent that uses a custom database object to maintain persistent memory across sessions."

system:  
  messages:  
    welcome: "Accessing your profile..."  
    error: "Sorry, I encountered a system error."  
  \# Inject variables directly into system instructions to globally guide tone  
  instructions: |  
    You are a highly personalized AI assistant.   
    Always adapt your tone to match the user's preferred communication style: {\!@variables.communication\_style}.  
    If the user's tier is VIP ({\!@variables.user\_tier} \== "VIP"), provide premium, highly detailed white-glove service.

variables:  
  \# \--- System & Status \---  
  contact\_id: mutable string \= "003000000000001" \# Hardcoded for testing. Replace with dynamic context variable in prod.  
    description: "The Salesforce Contact ID of the current user."  
  context\_loaded: mutable boolean \= False  
    description: "Flag to ensure we only fetch memory from the database once per session."  
      
  \# \--- Core Identity \---  
  user\_tier: mutable string \= "Standard"  
    description: "The user's service level. Can be Standard or VIP."  
  communication\_style: mutable string \= "Detailed"  
    description: "How the user prefers to be spoken to (e.g., Concise, Detailed, Technical)."  
      
  \# \--- Conversation History \---  
  last\_summary: mutable string \= ""  
    description: "A summary of the previous conversation."  
  pending\_goal: mutable string \= ""  
    description: "An incomplete task from a previous session."  
  unresolved\_issue: mutable boolean \= False  
    description: "If True, the user had a negative experience or open issue recently."

\# \---------------------------------------------------------  
\# 1\. ENTRY POINT: FETCH MEMORY BEFORE REASONING  
\# \---------------------------------------------------------  
start\_agent topic\_selector:  
  description: "Initializes memory and routes the user."  
  actions:  
    fetch\_user\_context:  
      description: "Fetches the user's permanent memory profile from the database."  
      inputs:  
        contact\_id: string  
          description: "The user's Contact ID"  
      outputs:  
        summary: string  
          description: "Previous conversation summary"  
        goal: string  
          description: "Pending goal"  
        issue: boolean  
          description: "Unresolved issue flag"  
        style: string  
          description: "Preferred communication style"  
        tier: string  
          description: "User's service tier"  
      target: "flow://Get\_Agent\_Context"

  reasoning:  
    instructions:-\>  
      \# Fetch the data deterministically if it hasn't been loaded yet  
      if @variables.context\_loaded \== False:  
        run @actions.fetch\_user\_context  
          with contact\_id=@variables.contact\_id  
          set @variables.last\_summary \= @outputs.summary  
          set @variables.pending\_goal \= @outputs.goal  
          set @variables.unresolved\_issue \= @outputs.issue  
          set @variables.communication\_style \= @outputs.style  
          set @variables.user\_tier \= @outputs.tier  
          set @variables.context\_loaded \= True  
        
      \# Automatically route to the main assistance topic once memory is loaded  
      transition to @topic.general\_assistance

\# \---------------------------------------------------------  
\# 2\. MAIN TOPIC: USE MEMORY & SAVE ON EXIT  
\# \---------------------------------------------------------  
topic general\_assistance:  
  description: "Handles general user inquiries using long-term memory."  
  actions:  
    save\_user\_context:  
      description: "Saves the updated conversation context and pending goals to the database."  
      inputs:  
        contact\_id: string  
          description: "The user's Contact ID"  
        new\_summary: string  
          description: "A 2-3 sentence summary of THIS conversation."  
        new\_goal: string  
          description: "Any goal the user started but didn't finish today."  
        has\_issue: boolean  
          description: "True if the user is leaving angry or has an unresolved issue."  
      outputs:  
        success: boolean  
          description: "Whether the save was successful"  
      target: "flow://Save\_Agent\_Context"

  reasoning:  
    instructions:-\>  
      | You are assisting the user. Review their history before responding:  
        
      \# Evaluate unresolved issues first for empathy  
      if @variables.unresolved\_issue \== True:  
        | ⚠️ The user had an unresolved issue last time. Start by sincerely apologizing and asking if it was resolved.  
      else:  
        if @variables.last\_summary \!= "":  
          | The user's last conversation was: {\!@variables.last\_summary}. Acknowledge them warmly based on this.  
        else:  
          | This is the user's first time interacting. Greet them warmly.  
            
      \# Proactively bring up abandoned goals  
      if @variables.pending\_goal \!= "":  
        | The user previously wanted to: {\!@variables.pending\_goal}. Ask if they still want help with this.

      | When the user indicates they are done or says goodbye, you MUST use the {\!@actions.save\_user\_context} tool to summarize this chat and save it to their profile.

    actions:  
      \# Expose the save action as a tool for the LLM  
      save\_context\_tool: @actions.save\_user\_context  
        description: "Call this tool right before saying goodbye to save the conversation memory to the database."  
        with contact\_id=@variables.contact\_id  
        \# The '...' syntax allows the LLM to dynamically generate the summary based on the live chat  
        with new\_summary=...  
        with new\_goal=...  
        with has\_issue=...

### **Architecture Breakdown**

1. **The Entry Check (start\_agent)**: All user interactions begin at the start\_agent topic. The procedural instructions (instructions:-\>) check the context\_loaded flag. Because it is False on a new session, it deterministically runs the fetch\_user\_context Flow action to query the database and maps the outputs to the session variables.  
2. **Deterministic Routing**: Still inside start\_agent, the script executes transition to @topic.general\_assistance. Transitions are immediate; control moves straight to the main topic with its memory fully loaded, preventing the LLM from making routing guesses.  
3. **Dynamic Prompting (general\_assistance)**: Using template expressions ({\!@variables...}) and conditionals (if/else), the script tailors the system prompt. If the unresolved\_issue boolean is True, the prompt text explicitly instructs the LLM to apologize.  
4. **Slot-Filling the Save Tool (save\_context\_tool)**: The action to save data is exposed as a reasoning tool in reasoning.actions. The ... syntax for new\_summary, new\_goal, and has\_issue is highly powerful. By referencing the tool in the prompt text ({\!@actions.save\_user\_context}), the LLM knows to autonomously invoke the tool, write the summary itself, and pass it to your Flow when the user signals the end of the conversation.