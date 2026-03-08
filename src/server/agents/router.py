import os
import httpx
from agents.state import AuraState


def smart_router_node(state: AuraState):
    """
    Role 3: The Fact-Finding Router.
    Pulls live provider quotes and converts them into comparable route options.
    Assumes the user is sending USD and wants to know how much BRL arrives.
    """

    ref_amount_usd = 1000.0
    wise_fee_usd = 18.0
    remitly_fee_usd = 0.0
    crebit_fee_usd = 0.0

    crebit_url = "https://api.crebitpay.com/api/create-quote-new"
    wise_url = "https://api.wise.com/v3/quotes"
    remitly_url = "https://api.remitly.io/v3/calculator/estimate"

    wise_api_key = os.getenv("WISE_API_KEY")

    options = []

    try:
        with httpx.Client(timeout=20.0) as client:
            # CREBIT
            try:
                crebit_response = client.post(
                    crebit_url,
                    json={
                        "symbol": "USDC/BRL",
                        "quote_type": "on_ramp",
                    },
                    headers={
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                    },
                )
                crebit_json = crebit_response.json()
                crebit_rate = (
                    float(crebit_json["quotation"])
                    if crebit_json.get("quotation") is not None
                    else None
                )

                if crebit_rate is not None:
                    net_usd = max(ref_amount_usd - crebit_fee_usd, 0)
                    options.append(
                        {
                            "name": "Crebit",
                            "provider": "crebit",
                            "fx_used": crebit_rate,
                            "fee_usd": crebit_fee_usd,
                            "eta_hours": 24,
                            "is_instant": False,
                            "description": "Student-focused route with low fees.",
                            "brl_received": net_usd * crebit_rate,
                            "reference_usd": ref_amount_usd,
                        }
                    )
            except Exception as e:
                print(f"⚠️ Router: Crebit quote failed: {e}")

            # WISE
            try:
                wise_headers = {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                }

                if wise_api_key:
                    wise_headers["Authorization"] = f"Bearer {wise_api_key}"

                wise_response = client.post(
                    wise_url,
                    json={
                        "sourceCurrency": "USD",
                        "targetCurrency": "BRL",
                        "sourceAmount": 1,
                    },
                    headers=wise_headers,
                )

                wise_json = wise_response.json()

                wise_rate = (
                    wise_json.get("rate")
                    or wise_json.get("price", {}).get("rate")
                    or wise_json.get("paymentOptions", [{}])[0].get("rate")
                )

                if wise_rate is not None:
                    wise_rate = float(wise_rate)
                    net_usd = max(ref_amount_usd - wise_fee_usd, 0)
                    options.append(
                        {
                            "name": "Wise",
                            "provider": "wise",
                            "fx_used": wise_rate,
                            "fee_usd": wise_fee_usd,
                            "eta_hours": 48,
                            "is_instant": False,
                            "description": "Traditional fintech transfer with moderate fees.",
                            "brl_received": net_usd * wise_rate,
                            "reference_usd": ref_amount_usd,
                        }
                    )
            except Exception as e:
                print(f"⚠️ Router: Wise quote failed: {e}")

            # REMITLY
            try:
                remitly_response = client.get(
                    remitly_url,
                    params={
                        "conduit": "USA:USD-BRA:BRL",
                        "anchor": "SEND",
                        "amount": 100,
                        "purpose": "OTHER",
                        "customer_segment": "STANDARD",
                        "customer_recognition": "UNRECOGNIZED",
                        "strict_promo": "false",
                    },
                    headers={
                        "Accept": "application/json",
                    },
                )

                remitly_json = remitly_response.json()
                exchange_rate = remitly_json.get("estimate", {}).get("exchange_rate", {})

                remitly_rate = (
                    exchange_rate.get("promotional_exchange_rate")
                    or exchange_rate.get("base_rate")
                )

                if remitly_rate is not None:
                    remitly_rate = float(remitly_rate)
                    net_usd = max(ref_amount_usd - remitly_fee_usd, 0)
                    options.append(
                        {
                            "name": "Remitly",
                            "provider": "remitly",
                            "fx_used": remitly_rate,
                            "fee_usd": remitly_fee_usd,
                            "eta_hours": 72,
                            "is_instant": False,
                            "description": "Consumer remittance route, often strong promotional rates.",
                            "brl_received": net_usd * remitly_rate,
                            "reference_usd": ref_amount_usd,
                        }
                    )
            except Exception as e:
                print(f"⚠️ Router: Remitly quote failed: {e}")

    except Exception as e:
        print(f"⚠️ Router: Global quote fetch failed: {e}")
        return {"route_options": []}

    if not options:
        print("⚠️ Router: No live provider options available.")
        return {"route_options": []}

    # Best route = highest BRL received for the same USD sent
    options = sorted(options, key=lambda x: x["brl_received"], reverse=True)

    print(f"🛰️ Router: Calculated {len(options)} live provider routes")
    print(options)
    return {
        "route_options": options,
    }