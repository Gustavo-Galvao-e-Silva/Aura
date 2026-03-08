import os
import io
import json
import requests
from google import genai
from google.genai import types
from PIL import Image
from agents.state import AuraState
from agents.prompts import get_visionary_accountant_prompt

from datetime import datetime, timedelta
# --- CACHE CONFIGURATION ---
# We store the last update time in memory to stay under the 20 RPD limit.
# For a 20 RPD limit (with 2 calls per pass), 120 minutes is a safe interval.
CACHE_EXPIRY_MINUTES = 120 
last_fx_data = None
last_fx_update = None

# 1. Initialize the standard Client
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
current_model_id = "gemini-3.1-flash-lite-preview"

async def fx_strategist_node(state: AuraState):
    """
    Role 1: High-Conviction FX Strategist.
    Uses a Two-Pass approach: 
    1. Grounded Search for raw info.
    2. JSON extraction for the state.
    Includes caching to prevent 429 Resource Exhausted errors.
    """
    global last_fx_data, last_fx_update

    now = datetime.now()

    # 1. Check if we have valid cached data
    if last_fx_data and last_fx_update:
        age = (now - last_fx_update).total_seconds() / 60
        if age < CACHE_EXPIRY_MINUTES:
            print(f"♻️ FX Strategist: Using cached market data ({int(age)}m old)")
            return {
                "current_fx_rate": last_fx_data.get("rate", state["current_fx_rate"]),
                "market_prediction": last_fx_data.get("trend", "NEUTRAL"),
            }

    print("🌐 FX Strategist: Researching live market data via Google Search...")

    # PASS 1: Grounded Search (Must be plain text)
    search_query = (
        "1. Navigate to Yahoo Finance (BRL/USD=X) and extract the current exchange rate.\n"
        "2. Locate the Technical Analysis section or a chart to find the 14-day RSI value.\n"
        "3. Search Google News for 'Brazil economy news' to see if there is immediate volatility.\n"
        "4. Return a JSON object with: 'rate' (float), 'rsi' (float), 'trend' (string: BULLISH/BEARISH), "
        "and 'conviction_score' (1-10)."
    )

    try:
        # We DO NOT use response_mime_type here
        search_response = client.models.generate_content(
            model=current_model_id,
            contents=search_query,
            config=types.GenerateContentConfig(
                tools=[{ "google_search": {} }]
            )
        )
        raw_intelligence = search_response.text
        
        # PASS 2: JSON Distillation
        distill_prompt = (
            f"Based on the following market research, extract the data into a JSON object.\n\n"
            f"Research: {raw_intelligence}\n\n"
            "Return ONLY a JSON object with keys: 'rate' (float), 'rsi' (float), 'trend' (string: BULLISH/BEARISH/NEUTRAL)."
        )

        distill_response = client.models.generate_content(
            model=current_model_id,
            contents=distill_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )
        data = json.loads(distill_response.text)

        # Update cache on success
        last_fx_data = data
        last_fx_update = now

    except Exception as e:
        if "429" in str(e):
            print("⚠️ Quota Exhausted! Falling back to safe hardcoded rate for stability.")
        else:
            print(f"⚠️ Market Research Error: {e}. Using safe fallback.")
        data = {"rate": 0.178, "trend": "NEUTRAL", "rsi": 50.0}

    print(f"📊 Market Insight: {data.get('trend')} | Rate: {data.get('rate')} | RSI: {data.get('rsi')}")

    return {
        "current_fx_rate": data.get("rate", state["current_fx_rate"]),
        "market_prediction": data.get("trend", "NEUTRAL"),
    }

def visionary_accountant_node(image_bytes: bytes, history_context: str = "No history available."):
    """Uses Gemini 2.5 Flash to process financial documents."""
    try:
        response = client.models.generate_content(
            model=current_model_id,
            contents=[
                get_visionary_accountant_prompt(history_context),
                Image.open(io.BytesIO(image_bytes))
            ]
        )
        
        if not response or not response.text:
            print("Visionary Accountant Error: Empty response from model.")
            return None

        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        return json.loads(text.strip())
    except Exception as e:
        print(f"Visionary Accountant Error: {e}")
        return None
