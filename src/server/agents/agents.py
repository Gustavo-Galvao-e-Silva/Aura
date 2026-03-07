import os
import io
import json
import requests
import google.generativeai as genai
from PIL import Image

# Use absolute imports from the server root
from agents.state import AuraState
from agents.prompts import visionary_accountant_prompt

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

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

def visionary_accountant_node(image_bytes: bytes):
    model = genai.GenerativeModel('gemini-1.5-flash')
    img = Image.open(io.BytesIO(image_bytes))
    response = model.generate_content([visionary_accountant_prompt, img])

    try:
        # Robust JSON cleaning
        text = response.text
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0]
        liability = json.loads(text.strip())
        return liability
    except Exception as e:
        print(f"Vision Parsing Error: {e}")
        return None
