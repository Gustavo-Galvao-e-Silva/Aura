import os
import requests
import json

def check_limits():
    api_key = os.getenv("GOOGLE_API_KEY")
    # Testing the three main tiers you have access to
    models = [
        "gemini-3.1-flash-lite-preview", # Highest quota
    ]
    
    for model in models:
        print(f"--- Testing {model} ---")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
        payload = {"contents": [{"parts": [{"text": "Is the quota reset?"}]}]}
        
        try:
            res = requests.post(url, json=payload)
            if res.status_code == 200:
                print(f"✅ Status: OK")
            elif res.status_code == 429:
                err = res.json().get("error", {}).get("message", "")
                print(f"❌ Status: RATE LIMITED")
                print(f"Reason: {err}")
            else:
                print(f"❓ Status: {res.status_code}")
        except Exception as e:
            print(f"🔥 Script Error: {e}")
        print()

if __name__ == "__main__":
    check_limits()
