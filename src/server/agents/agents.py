import os
import io
import json
import requests
from pydantic import BaseModel
from google import genai
from google.genai import types
from PIL import Image
from agents.state import AuraState
from agents.prompts import get_visionary_accountant_prompt
from browser_use_sdk.v3 import AsyncBrowserUse, BrowserUseError

from datetime import datetime, timedelta
# --- CACHE CONFIGURATION ---
# We store the last update time in memory to stay under the 20 RPD limit.
# For a 20 RPD limit (with 2 calls per pass), 120 minutes is a safe interval.
CACHE_EXPIRY_MINUTES = 120 
last_fx_data = None
last_fx_update = None

# Define your expected output structure
class FXData(BaseModel):
    rate: float
    rsi: float
    trend: str
    conviction_score: int

# Initialize Browser Use Client
bu_client = AsyncBrowserUse(api_key=os.getenv("BROWSER_USE_API_KEY"))

# 1. Initialize the standard Client
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))
current_model_id = "gemini-3.1-flash-lite-preview"

async def fx_strategist_node(state: AuraState):
    """
    Role 1: High-Conviction FX Strategist.
    Uses Browser Use to interact with Yahoo Finance directly.
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

    print("🌐 FX Strategist: Researching live market data via Browser Use Agent...")

    # Define the exact task for the browser agent
    task_prompt = (
        "1. Navigate to Yahoo Finance (BRL/USD=X) and extract the current exchange rate.\n"
        "2. Locate the Technical Analysis section or a chart to find the 14-day RSI value.\n"
        "3. Search Google News for 'Brazil economy news' to see if there is immediate volatility.\n"
        "4. Return a JSON object with: 'rate' (float), 'rsi' (float), 'trend' (string: BULLISH/BEARISH), "
        "and 'conviction_score' (1-10)."
    )

    try:
        # The agent will browse the web and return the data formatted as our Pydantic model
        result = await bu_client.run(
            task_prompt, 
            output_schema=FXData,
            model="bu-max" # Use bu-max for complex navigation
        )
        
        # result.output is automatically parsed into your FXData Pydantic model
        fx_info = result.output
        
        data = {
            "rate": fx_info.rate,
            "rsi": fx_info.rsi,
            "trend": fx_info.trend,
            "conviction_score": fx_info.conviction_score
        }

        # Update cache on success
        last_fx_data = data
        last_fx_update = now

        print(f"💰 Cost for this run: {result.total_cost_usd}")

    except Exception as e:
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
