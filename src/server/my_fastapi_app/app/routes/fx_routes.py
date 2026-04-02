import httpx
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import CotationNotify
from my_fastapi_app.app.settings import settings
from my_fastapi_app.app.db.session import get_db

router = APIRouter(prefix="/fx", tags=["FX Routes"])


class QuoteAlertDTO(BaseModel):
    username: str
    email: str
    target_rate: float


@router.get("/rates")
async def get_fx_provider_rates():
    """
    Compare real-time exchange rates from multiple FX providers.

    Queries Crebit, Wise, and Remitly APIs to get current USD/BRL rates
    and calculates the optimal route for currency conversion.

    Returns rate comparisons showing BRL received per $1000 USD sent.
    """
    parsed = {
        "crebit": None,
        "ofx": None,
        "remitly": None,
    }

    async with httpx.AsyncClient(timeout=settings.HTTP_CLIENT_TIMEOUT) as client:
        # CREBIT
        try:
            crebit_response = await client.post(
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

            parsed["crebit"] = {
                "provider": "crebit",
                "rate": float(crebit_json["quotation"]) if crebit_json.get("quotation") else None,
            }
        except Exception as e:
            parsed["crebit"] = {
                "provider": "crebit",
                "rate": None,
                "error": str(e),
            }

        # OFX — live commercial USD/BRL ask rate via AwesomeAPI (no auth required)
        try:
            ofx_response = await client.get(
                "https://economia.awesomeapi.com.br/json/last/USD-BRL",
                headers={"Accept": "application/json"},
            )
            ofx_json = ofx_response.json()
            ofx_rate = ofx_json.get("USDBRL", {}).get("ask")

            parsed["ofx"] = {
                "provider": "ofx",
                "rate": float(ofx_rate) if ofx_rate is not None else None,
            }
        except Exception as e:
            parsed["ofx"] = {
                "provider": "ofx",
                "rate": None,
                "error": str(e),
            }

        # REMITLY
        try:
            remitly_response = await client.get(
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

            parsed["remitly"] = {
                "provider": "remitly",
                "rate": float(remitly_rate) if remitly_rate is not None else None,
            }
        except Exception as e:
            parsed["remitly"] = {
                "provider": "remitly",
                "rate": None,
                "error": str(e),
            }

    return parsed


@router.post("/alerts")
async def set_quote_alert(data: QuoteAlertDTO, db: AsyncSession = Depends(get_db)):
    """
    Set up an email alert for target exchange rate.

    - **username**: User identifier
    - **email**: Email address for notifications
    - **target_rate**: Target USD/BRL exchange rate

    When the rate reaches or falls below the target, an email alert is sent.
    """
    target_quote = CotationNotify(
        username=data.username,
        email=data.email,
        rate=data.target_rate
    )

    db.add(target_quote)
    await db.commit()
    await db.refresh(target_quote)

    return {
        "status": "success",
        "alert": target_quote
    }
