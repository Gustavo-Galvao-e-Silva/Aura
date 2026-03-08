import os
import io
import json
import requests
from google import genai
from PIL import Image

from browser_use.llm import ChatGoogle
from agents.state import AuraState

from agents.prompts import get_visionary_accountant_prompt

from browser_use import Agent, Browser

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# 2. Initialize the Browser LLM (The brain for the browser)
from langchain_google_genai import ChatGoogleGenerativeAI
ChatGoogleGenerativeAI.provider = property(lambda self: "google")
browser_llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

# 3. Setup the Browser Instance
browser = Browser()

async def fx_strategist_node(state: AuraState):
    """
    Role 1: High-Conviction FX Strategist.
    Uses browser-use to perform deep technical and sentiment analysis.
    """
    
    # Define a high-fidelity task for the browser agent
    analysis_task = (
        "1. Navigate to Yahoo Finance (BRL/USD=X) and extract the current exchange rate.\n"
        "2. Locate the Technical Analysis section or a chart to find the 14-day RSI value.\n"
        "3. Search Google News for 'Brazil economy news' to see if there is immediate volatility.\n"
        "4. Return a JSON object with: 'rate' (float), 'rsi' (float), 'trend' (string: BULLISH/BEARISH), "
        "and 'conviction_score' (1-10)."
    )

    # Initialize the browser-use Agent
    # Note: We pass the model and the task. Browser-use handles the loop.
    agent = Agent(
        task=analysis_task,
        llm=browser_llm,
        browser=browser
    )

    history = await agent.run()
    
    # We ask Gemini to parse the final result into our State schema
    raw_result = history.final_element().text

# --- MISSING STEP: RE-INTRODUCING THE REFINER ---
    # We use the genai client to turn raw browser text into clean JSON
    refiner_res = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[f"Extract only the JSON from this text, no markdown or prose: {raw_result}"]
    )
    clean_json = refiner_res.text
    # -----------------------------------------------

    if "```json" in clean_json:
        clean_json = clean_json.split("```json")[1].split("```")[0]
    elif "```" in clean_json:
        clean_json = clean_json.split("```")[1].split("```")[0]
        
    try:
        data = json.loads(clean_json.strip())
    except Exception as e:
        print(f"❌ JSON Parse Error: {e}. Raw was: {clean_json}")
        data = {"rate": 0.0, "trend": "NEUTRAL"}
    
    print(f"📊 Deep Intelligence gathered: {data}")

    return {
        "current_fx_rate": data.get("rate", state["current_fx_rate"]),
        "market_prediction": data.get("trend", "NEUTRAL"),
    }


def visionary_accountant_node(image_bytes: bytes, history_context: str = "No history available."):
    model = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            get_visionary_accountant_prompt(history_context),
            Image.open(io.BytesIO(image_bytes))
        ]
    )
    
    try:
        text = model.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        return json.loads(text.strip())
    except Exception as e:
        print(f"Visionary Accountant Error: {e}")
        return None
