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
    url = f"https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=BRL&to_currency=USD&apikey={api_key}"

    try:
        response = requests.get(url).json()
        data = response.get("Realtime Currency Exchange Rate", {})
        rate = float(data.get("5. Exchange Rate", 0.0))
    except Exception as e:
        print(f"FX API Error: {e}")
        rate = state.get("current_fx_rate", 0.0)

    # Simplified logic for hackathon POC
    prediction = "BUY" if rate < 0.18 else "WAIT" 

    return {
        "current_fx_rate": rate,
        "market_prediction": prediction
    }

def visionary_accountant_node(image_bytes: bytes, history_context: str = "No history available."):
    model = client.models.generate_content(
        model="gemini-2.0-flash",
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
