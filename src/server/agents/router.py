from agents.state import AuraState

def smart_router_node(state: AuraState):
    """
    Role 3: The Fact-Finding Router.
    Calculates costs and ETAs for various payment rails based on live market data.
    """
    rate = state.get("current_fx_rate", 0.0)
    
    # If the FX Strategist hasn't found a rate yet, we provide empty options
    if rate == 0:
        print("⚠️ Router: No FX rate available yet. Skipping route calculation.")
        return {"route_options": []}

    # We assume a reference amount of $1,000 USD to help the user compare.
    # The Orchestrator can scale this later for specific bills.
    ref_amount_usd = 1000.0
    
    # --- RAIL 1: CREBIT (Sponsor - The Student Choice) ---
    # Optimized: Mid-market rate + tiny flat fee.
    crebit_option = {
        "name": "Crebit",
        "tlc_brl": (ref_amount_usd / rate) + 8.00, 
        "fx_used": rate,
        "eta_hours": 1,
        "fee_brl": 8.00,
        "is_instant": True,
        "description": "Direct student-to-university rail. Lowest fees."
    }

    # --- RAIL 2: TRADITIONAL BANK WIRE (The Legacy Choice) ---
    # Hidden costs: 2% spread markup + $40+ SWIFT fee.
    bank_spread = rate * 0.98 # Banks take a 2% cut on the rate
    bank_option = {
        "name": "Traditional Bank",
        "tlc_brl": (ref_amount_usd / bank_spread) + 215.00, # R$215 (~$40) SWIFT fee
        "fx_used": bank_spread,
        "eta_hours": 72,
        "fee_brl": 215.00,
        "is_instant": False,
        "description": "Standard SWIFT transfer. High hidden spreads."
    }

    # --- RAIL 3: SUI/STELLAR BRIDGE (The Crypto Choice) ---
    # Fast, but requires on/off ramp knowledge.
    crypto_option = {
        "name": "Sui Stablecoin Bridge",
        "tlc_brl": (ref_amount_usd / rate) + 15.00, # Small gas/bridge fee
        "fx_used": rate,
        "eta_hours": 0.2, # ~12 minutes
        "fee_brl": 15.00,
        "is_instant": True,
        "description": "Instant USDC/BRL swap. High technical complexity."
    }

    options = [crebit_option, bank_option, crypto_option]
    
    print(f"🛰️ Router: Calculated {len(options)} routes at rate {rate}")
    
    return {
        "route_options": options
    }
