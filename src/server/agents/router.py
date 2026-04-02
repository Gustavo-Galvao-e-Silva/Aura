import httpx
from my_fastapi_app.app.settings import settings
from my_fastapi_app.app.services.mail_service import send_quote_alert_email
from agents.state import AuraState
from datetime import datetime
from sqlalchemy import select
from my_fastapi_app.app.db.session import AsyncSessionLocal
from db.models import CotationNotify


async def smart_router_node(state: AuraState):
    """
    Role 3: The Fact-Finding Router.
    Pulls live provider quotes and converts them into comparable route options.
    Students send BRL and receive USD — best route = lowest BRL cost for REF_AMOUNT_USD.
    """
    options = []

    try:
        with httpx.Client(timeout=settings.HTTP_CLIENT_TIMEOUT) as client:
            # CREBIT
            try:
                crebit_response = client.post(
                    settings.CREBIT_API_URL,
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
                    # brl_cost: how many BRL the student pays to cover REF_AMOUNT_USD (including fees)
                    brl_cost = (settings.REF_AMOUNT_USD + settings.CREBIT_FEE_USD) * crebit_rate
                    options.append(
                        {
                            "name": "Crebit",
                            "provider": "crebit",
                            "fx_used": crebit_rate,
                            "fee_usd": settings.CREBIT_FEE_USD,
                            "eta_hours": 24,
                            "is_instant": False,
                            "description": "Student-focused route with low fees.",
                            "brl_cost": brl_cost,
                            "reference_usd": settings.REF_AMOUNT_USD,
                        }
                    )
            except Exception as e:
                print(f"⚠️ Router: Crebit quote failed: {e}")

            # OFX — live commercial USD/BRL rate via AwesomeAPI (no auth required)
            try:
                ofx_response = client.get(
                    "https://economia.awesomeapi.com.br/json/last/USD-BRL",
                    headers={"Accept": "application/json"},
                )
                ofx_json = ofx_response.json()
                # ask = rate to buy USD with BRL (what the student pays)
                ofx_rate = ofx_json.get("USDBRL", {}).get("ask")

                if ofx_rate is not None:
                    ofx_rate = float(ofx_rate)
                    brl_cost = (settings.REF_AMOUNT_USD + settings.OFX_FEE_USD) * ofx_rate
                    options.append(
                        {
                            "name": "OFX",
                            "provider": "ofx",
                            "fx_used": ofx_rate,
                            "fee_usd": settings.OFX_FEE_USD,
                            "eta_hours": 48,
                            "is_instant": False,
                            "description": "Global money transfer with no transfer fees.",
                            "brl_cost": brl_cost,
                            "reference_usd": settings.REF_AMOUNT_USD,
                        }
                    )
            except Exception as e:
                print(f"⚠️ Router: OFX quote failed: {e}")

            # REMITLY
            try:
                remitly_response = client.get(
                    settings.REMITLY_API_URL,
                    params={
                        "conduit": "USA:USD-BRA:BRL",
                        "anchor": "SEND",
                        "amount": settings.REF_AMOUNT_USD,
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
                    brl_cost = (settings.REF_AMOUNT_USD + settings.REMITLY_FEE_USD) * remitly_rate
                    options.append(
                        {
                            "name": "Remitly",
                            "provider": "remitly",
                            "fx_used": remitly_rate,
                            "fee_usd": settings.REMITLY_FEE_USD,
                            "eta_hours": 72,
                            "is_instant": False,
                            "description": "Consumer remittance route, often strong promotional rates.",
                            "brl_cost": brl_cost,
                            "reference_usd": settings.REF_AMOUNT_USD,
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

    # Best route = lowest BRL cost to cover REF_AMOUNT_USD (student sends BRL, receives USD)
    options = sorted(options, key=lambda x: x["brl_cost"])

    await notify_users_if_quote_below_target(options)
    print(f"🛰️ Router: Calculated {len(options)} live provider routes")
    #print(options)
    return {
        "route_options": options,
    }


async def notify_users_if_quote_below_target(routes):
    """
    Looks at the lowest quotation among providers and sends email alerts
    to users whose target_rate is >= current lowest quote.
    """

    if not routes:
        print("📭 Notify: No route options available.")
        return {"notifications_sent": 0}

    valid_routes = [
        route for route in routes
        if route.get("fx_used") is not None
    ]

    if not valid_routes:
        print("📭 Notify: No valid fx quotations available.")
        return {"notifications_sent": 0}

    # get max rate
    max_route = max(valid_routes, key=lambda r: r["fx_used"])
    max_rate = float(max_route["fx_used"])
    provider_name = max_route["name"]

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(CotationNotify).filter(
                CotationNotify.rate <= max_rate,
                CotationNotify.has_notified == False
            )
        )
        alerts = result.scalars().all()

        if not alerts:
            print(f"📭 Notify: No users to notify. Best rate = {max_rate:.4f}")
            return {"notifications_sent": 0}

        notifications_sent = 0

        for alert in alerts:
            try:
                send_quote_alert_email(
                    to_email=alert.email,
                    current_rate=max_rate,
                    target_rate=alert.rate,
                    provider=provider_name,
                )

                alert.has_notified = True
                notifications_sent += 1

                print(
                    f"✅ Notify: Sent alert to {alert.email} "
                    f"(target={alert.rate:.4f}, current={max_rate:.4f})"
                )

            except Exception as e:
                print(f"⚠️ Notify: Failed to send email to {alert.email}: {e}")

        await db.commit()

        return {
            "notifications_sent": notifications_sent,
            "best_rate": max_rate,
            "best_provider": provider_name,
        }
    