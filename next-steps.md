This is the **"Aura Phase 2: Orchestration & Persistence"** execution plan. We are moving from a series of disconnected scripts to a professional, data-driven agentic system that actually "thinks" before it alerts.

### **The Goal: What we will achieve**

By the end of this plan, **Aura** will:

1. **Persist Data:** Store every invoice and "Predicted Responsibility" in a **Postgres** DB with zero hallucinations (via Pydantic validation).
2. **Synthesize Intel:** A central **Orchestrator** will balance Market Trends, Route Costs, and Deadlines to send "High-IQ" alerts.
3. **Prove Decisions:** A cryptographic audit trail will be ready for a public ledger, satisfying the "Ethical Security" requirement.

---

### **Step 1: The Data Foundation (Postgres & Pydantic)**

We need to stop using the `current_state` dictionary as our only memory.

1. **Define the Schema:** Create a `src/server/db/schema.py` using **SQLAlchemy** or **SQLModel**.
* **Table 1: `liabilities**` (`id`, `name`, `amount`, `due_date`, `currency`, `is_predicted`).
* **Table 2: `audit_log**` (`id`, `timestamp`, `decision_hash`, `reasoning`).


2. **The Validation Layer:** Use **Pydantic** in `src/server/agents/schemas.py` to define the "Financial Responsibility" object.
* *Task:* Add a validator that throws an error if `currency` is not "USD" or "BRL," preventing LLM "currency hallucinations."



---

### **Step 2: The "High-IQ" Vision Node (Role 2)**

Update the Visionary Accountant to handle the new "Actual vs. Predicted" requirement.

1. **Modify the Prompt:** Tell Gemini to output *two* lists. One for the bill in the image, and one for "Likely Future Payments" based on the bill type (e.g., if it sees an Electric Bill, predict the next one for 30 days later).
2. **DB Write:** Change the FastAPI `/upload-invoice` route so it doesn't just return JSON; it **saves** the extracted objects into your Postgres `liabilities` table.

---

### **Step 3: The Intelligence Upgrade (Role 1)**

We need to turn the FX Strategist from a "price checker" into a "trend analyst."

1. **TradingView/Alpha Vantage Integration:** Update `fx_strategist_node` to pull the **Technical Indicators** (RSI/MACD) requested in your prompt.
2. **The ROI Sub-Agent:** Add a function that takes the `current_fx_rate` and compares it to a 30-day moving average.
* *Output:* A `savings_delta` value that tells the Orchestrator exactly how much "profit" is on the table if we buy now.



---

### **Step 4: The Smart Router Pivot (Role 3)**

Strip the "decision-making" out of the Router to keep it modular.

1. **Simplify Logic:** The `smart_router_node` should now only return a dictionary of facts for the 3 main routes (Crebit, Wire, Crypto):
* `{ "Crebit": {"tlc": 5100, "eta_hours": 1}, "Wire": {"tlc": 5300, "eta_hours": 72} ... }`



---

### **Step 5: The Master Orchestrator (Role 1 - The "Stitching")**

This is the most important step. We add a new node to the LangGraph that acts as the "General."

1. **The Orchestrator Node:** This node fetches all **liabilities** from Postgres, the **FX Signal** from Agent 1, and the **Route Data** from Agent 2.
2. **The Decision Engine:** * *Logic:* "If (FX == 'BUY' AND SavingsDelta > 2%) OR (ClosestDeadline < RouteETA + 24hrs), then trigger **EMERGENCY_BUY**."
3. **Twilio Integration:** This node sends the final, contextualized SMS: *"Aura found a 3% savings. Your Tuition is due in 4 days. Crebit can settle this in 1hr for R$5,200. Reply YES to execute."*

---

### **Step 6: The Trust Engine 2.0 (Role 3)**

Move beyond a local hash.

1. **Ledger Prep:** Update `trust.py` to prepare a payload for the **Stellar Testnet**.
2. **Audit Packet:** Ensure the hash includes the **Orchestrator's Reasoning** (the string of text sent to Twilio), not just numbers. This makes the "Proof of Reason" truly human-readable for judges.

---

### **Summary of the Course of Action**

| Phase | Focus | Deliverable |
| --- | --- | --- |
| **Hours 6-10** | **Data Persistence** | Postgres connection & validated DB writes. |
| **Hours 10-14** | **Agent Intelligence** | Real RSI/MACD data & Predictive Liability lists. |
| **Hours 14-18** | **The Orchestrator** | The LangGraph "Brain" that synthesizes all inputs. |
| **Hours 18-24** | **Integration & Pitch** | Twilio alerts live, Blockchain hashes, and Demo Prep. |

**Would you like me to start by writing the `SQLAlchemy` models for your Postgres DB so Role 2 can start saving invoices?**
