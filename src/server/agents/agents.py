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
