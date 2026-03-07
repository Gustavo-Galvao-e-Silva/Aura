import requests
import os

def fx_strategist_node(state: AuraState):
    api_key = os.getenv("ALPHA_VANTAGE_API_KEY")
    url = f"https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=BRL&to_currency=USD&apikey={api_key}"
    
    response = requests.get(url).json()
    rate = float(response["Realtime Currency Exchange Rate"]["5. Exchange Rate"])
    
    # logic to decide if it's a 'BUY' based on your threshold
    prediction = "BUY" if rate < 0.18 else "WAIT" # Example threshold
    
    return {
        "current_fx_rate": rate,
        "market_prediction": prediction
    }


import google.generativeai as genai
from PIL import Image
import io
import json
from .prompts import visionary_accountant_prompt

# Configure Gemini (Ensure GOOGLE_API_KEY is in your .env)
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

def visionary_accountant_node(image_bytes: bytes):
    """
    Takes raw image bytes and returns a structured liability dictionary.
    """
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    # Convert bytes to a PIL Image
    img = Image.open(io.BytesIO(image_bytes))
    
    # Call the Vision model
    response = model.generate_content([visionary_accountant_prompt, img])
    
    try:
        # Clean the response to ensure it's valid JSON
        json_str = response.text.replace('```json', '').replace('```', '').strip()
        liability = json.loads(json_str)
        return liability
    except Exception as e:
        print(f"Error parsing Vision response: {e}")
        return None
