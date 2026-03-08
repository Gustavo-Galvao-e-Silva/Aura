import os
import io
import json
import requests
from google import genai
from google.genai import types
from PIL import Image
from agents.state import AuraState
from agents.prompts import get_visionary_accountant_prompt

# 1. Initialize the standard Client
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
current_model_id = "gemini-2.5-flash"

async def fx_strategist_node(state: AuraState):
    """
    Role 1: High-Conviction FX Strategist.
    Uses Google Search Grounding instead of a fragile browser automation.
    """
    print("🌐 FX Strategist: Searching the web for live market intelligence...")

    # We ask Gemini to use Google Search to find real-time data
    search_prompt = (
        "1. Navigate to Yahoo Finance (BRL/USD=X) and extract the current exchange rate.\n"
        "2. Locate the Technical Analysis section or a chart to find the 14-day RSI value.\n"
        "3. Search Google News for 'Brazil economy news' to see if there is immediate volatility.\n"
        "4. Return a JSON object with: 'rate' (float), 'rsi' (float), 'trend' (string: BULLISH/BEARISH), "
        "and 'conviction_score' (1-10)."
    )

    try:
        # Use Google Search Grounding tool
        response = client.models.generate_content(
            model=current_model_id,
            contents=search_prompt,
            config=types.GenerateContentConfig(
                tools=[{ "google_search": {} }],
                response_mime_type="application/json"
            )
        )
        
        # Parse the structured JSON output
        data = json.loads(response.text)
        
    except Exception as e:
        print(f"⚠️ Search Grounding Error: {e}. Falling back to basic rate.")
        # Minimal fallback if the search tool fails
        data = {"rate": 0.178, "trend": "NEUTRAL", "rsi": 50.0}

    print(f"📊 Market Insight: {data.get('trend')} | Rate: {data.get('rate')} | RSI: {data.get('rsi')}")

    return {
        "current_fx_rate": data.get("rate", state["current_fx_rate"]),
        "market_prediction": data.get("trend", "NEUTRAL"),
    }

def visionary_accountant_node(image_bytes: bytes, history_context: str = "No history available."):
    model = client.models.generate_content(
        model=current_model_id,
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
