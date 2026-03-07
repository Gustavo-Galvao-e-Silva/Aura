import os
import io
import json
import requests
from google import genai
from PIL import Image

# Use absolute imports from the server root
from agents.state import AuraState

from agents.prompts import get_visionary_accountant_prompt

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

def fx_strategist_node(state: AuraState):
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    
    # 1. Fetch Real-time Exchange Rate
    rate_url = f"https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=BRL&to_currency=USD&apikey={api_key}"
    
    # 2. Fetch RSI Technical Indicator (14-day window)
    rsi_url = f"https://www.alphavantage.co/query?function=RSI&symbol=BRLUSD&interval=daily&time_period=14&series_type=close&apikey={api_key}"
    
    try:
        rate_res = requests.get(rate_url).json()
        current_rate = float(rate_res["Realtime Currency Exchange Rate"]["5. Exchange Rate"])
        
        rsi_res = requests.get(rsi_url).json()
        time_series = rsi_res.get("Technical Analysis: RSI", {})
        latest_date = list(time_series.keys())[0]
        rsi_value = float(time_series[latest_date]["RSI"])
    except Exception as e:
        print(f"FX Strategist Error: {e}. Using fallback values.")
        current_rate = state.get("current_fx_rate", 0.18)
        rsi_value = 50.0  # Neutral

    # Logic based on Manifesto 2.0
    if rsi_value < 30:
        prediction = "STRONG_BUY" # Golden Opportunity
    elif rsi_value < 45:
        prediction = "BUY"
    else:
        prediction = "WAIT"

    print(f"📈 FX Analysis: Rate={current_rate}, RSI={rsi_value}, Signal={prediction}")

    return {
        "current_fx_rate": current_rate,
        "market_prediction": prediction
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
