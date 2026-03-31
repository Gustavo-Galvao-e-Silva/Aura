import httpx
from my_fastapi_app.app.settings import settings
from my_fastapi_app.app.services.mail_service import send_quote_alert_email
from agents.state import AuraState
from datetime import datetime
from sqlalchemy.orm import Session
from my_fastapi_app.app.db.session import SessionLocal
from db.models import CotationNotify


def smart_router_node(state: AuraState):
    """
    Role 3: The Fact-Finding Router.
    Pulls live provider quotes and converts them into comparable route options.
    Assumes the user is sending USD and wants to know how much BRL arrives.
    """
    wise_api_key = settings.WISE_API_KEY

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
                    net_usd = max(settings.REF_AMOUNT_USD - settings.CREBIT_FEE_USD, 0)
                    options.append(
                        {
                            "name": "Crebit",
                            "provider": "crebit",
                            "fx_used": crebit_rate,
                            "fee_usd": settings.CREBIT_FEE_USD,
                            "eta_hours": 24,
                            "is_instant": False,
                            "description": "Student-focused route with low fees.",
                            "brl_received": net_usd * crebit_rate,
                            "reference_usd": settings.REF_AMOUNT_USD,
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
                    settings.WISE_API_URL,
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
                    net_usd = max(settings.REF_AMOUNT_USD - settings.WISE_FEE_USD, 0)
                    options.append(
                        {
                            "name": "Wise",
                            "provider": "wise",
                            "fx_used": wise_rate,
                            "fee_usd": settings.WISE_FEE_USD,
                            "eta_hours": 48,
                            "is_instant": False,
                            "description": "Traditional fintech transfer with moderate fees.",
                            "brl_received": net_usd * wise_rate,
                            "reference_usd": settings.REF_AMOUNT_USD,
                        }
                    )
            except Exception as e:
                print(f"⚠️ Router: Wise quote failed: {e}")

            # REMITLY
            try:
                remitly_response = client.get(
                    settings.REMITLY_API_URL,
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
                    net_usd = max(settings.REF_AMOUNT_USD - settings.REMITLY_FEE_USD, 0)
                    options.append(
                        {
                            "name": "Remitly",
                            "provider": "remitly",
                            "fx_used": remitly_rate,
                            "fee_usd": settings.REMITLY_FEE_USD,
                            "eta_hours": 72,
                            "is_instant": False,
                            "description": "Consumer remittance route, often strong promotional rates.",
                            "brl_received": net_usd * remitly_rate,
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

    # Best route = highest BRL received for the same USD sent
    options = sorted(options, key=lambda x: x["brl_received"], reverse=True)

    notify_users_if_quote_below_target(options)
    print(f"🛰️ Router: Calculated {len(options)} live provider routes")
    #print(options)
    return {
        "route_options": options,
    }


def notify_users_if_quote_below_target(routes):
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
    db: Session = SessionLocal()
    try:
        alerts = (
            db.query(CotationNotify)
            .filter(
                CotationNotify.rate <= max_rate,
                CotationNotify.has_notified == False
            )
            .all()
        )

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

        db.commit()

        return {
            "notifications_sent": notifications_sent,
            "best_rate": max_rate,
            "best_provider": provider_name,
        }

    finally:
        db.close()
    