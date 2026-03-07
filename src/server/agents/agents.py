import os
import io
import json
import requests
from google import genai
from PIL import Image

# Use absolute imports from the server root
from agents.state import AuraState

from agents.prompts import get_visionary_accountant_prompt

from browser_use import Agent, Browser, BrowserConfig

client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

browser = Browser(config=BrowserConfig(headless=True))

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
        llm=client.models.generate_content(model="gemini-2.0-flash"),
        browser=browser
    )

    history = await agent.run()
    
    # We ask Gemini to parse the final result into our State schema
    raw_result = history.final_element().text
    
    # Internal 'Refinement' Step: Ensure we get valid data
    # (In a hackathon, we can use a small prompt to clean the browser output)
    clean_json = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[f"Extract only the JSON from this text: {raw_result}"]
    ).text
    
    # Clean up markdown if necessary
    if "```json" in clean_json:
        clean_json = clean_json.split("```json")[1].split("```")[0]
        
    data = json.loads(clean_json)

    # Calculate ROI (Savings Delta) for the state
    # Savings = (Current Rate - 30 Day Average) * Amount
    # (We can have the browser find the 30-day average too!)
    
    print(f"📊 Deep Intelligence gathered: {data}")

    return {
        "current_fx_rate": data.get("rate", state["current_fx_rate"]),
        "market_prediction": data.get("trend", "NEUTRAL"),
        # We can expand AuraState to include 'conviction_score' later
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
