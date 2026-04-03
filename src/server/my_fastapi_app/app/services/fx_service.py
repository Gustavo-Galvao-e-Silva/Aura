"""
FX Service - Real-time exchange rate management
Fetches live FX rates from routes agent and selects best rate for settlement.
"""
from typing import Dict, Optional
from agents.router import smart_router_node
from agents.state import AuraState


async def get_best_fx_rate(username: str) -> Dict[str, any]:
    """
    Fetches real-time FX rates from routes agent and returns the best rate.

    For settlement (BRL → USD conversion), "best rate" means:
    - LOWEST BRL/USD ratio = user pays LESS BRL to get same USD

    Args:
        username: User making the transaction (for future personalization)

    Returns:
        {
            "fx_rate": float,        # BRL per USD (e.g., 5.5 means 1 USD = 5.5 BRL)
            "provider": str,         # Provider name (e.g., "Crebit", "Wise", "Remitly")
            "source": str,           # "live" or "fallback"
            "all_options": list      # All available options for transparency
        }

    Example:
        >>> result = await get_best_fx_rate("testuser")
        >>> print(result)
        {
            "fx_rate": 5.65,
            "provider": "Crebit",
            "source": "live",
            "all_options": [...]
        }
    """

    # Initialize state for routes agent
    state = AuraState(username=username)

    try:
        # Call routes agent to get live quotes
        result = await smart_router_node(state)
        route_options = result.get("route_options", [])

        if not route_options:
            print("⚠️ FX Service: No live routes available, using fallback rate")
            return {
                "fx_rate": 5.5,
                "provider": "Fallback",
                "source": "fallback",
                "all_options": []
            }

        # Filter valid options with fx_used field
        valid_options = [
            opt for opt in route_options
            if opt.get("fx_used") is not None
        ]

        if not valid_options:
            print("⚠️ FX Service: No valid FX rates in options, using fallback")
            return {
                "fx_rate": 5.5,
                "provider": "Fallback",
                "source": "fallback",
                "all_options": route_options
            }

        # For settlement (BRL → USD): Pick LOWEST fx_rate
        # Lower rate = user pays LESS BRL for same USD = better deal
        best_option = min(valid_options, key=lambda x: x["fx_used"])

        print(f"💱 FX Service: Best rate = {best_option['fx_used']:.4f} BRL/USD ({best_option['provider']})")
        print(f"   Available options: {len(valid_options)}")

        return {
            "fx_rate": best_option["fx_used"],
            "provider": best_option["provider"],
            "source": "live",
            "all_options": valid_options
        }

    except Exception as e:
        print(f"⚠️ FX Service: Error fetching rates: {e}")
        return {
            "fx_rate": 5.5,
            "provider": "Fallback",
            "source": "fallback",
            "all_options": []
        }


def calculate_brl_needed(amount_usd: float, fx_rate: float) -> float:
    """
    Calculate how much BRL is needed to purchase the specified USD amount.

    Args:
        amount_usd: Amount of USD needed (e.g., 100.00)
        fx_rate: Exchange rate in BRL/USD (e.g., 5.5 means 1 USD = 5.5 BRL)

    Returns:
        Amount of BRL needed

    Example:
        >>> calculate_brl_needed(100.00, 5.5)
        550.0
    """
    return amount_usd * fx_rate
