"""
Circle Sandbox API integration for fiat off-ramp.

Circle provides USDC → USD wire transfer simulation via their Sandbox environment.
No real money is transferred - all operations are test mode.

Operations:
1. initiate_usdc_withdrawal(): Start USDC → USD wire transfer via Circle API
2. check_transfer_status(): Poll transfer status (pending/complete/failed)

Phase 2 Step 2.4 - Part of Stablecoin Sandbox Implementation

Note: Circle Sandbox requires:
- API Key from https://developers.circle.com
- KYB verification for production
- USDC custody wallet address
"""

import httpx
from typing import Optional, Dict
from my_fastapi_app.app.settings import settings
import uuid


CIRCLE_SANDBOX_URL = "https://api-sandbox.circle.com/v1"


async def initiate_usdc_withdrawal(
    amount_usd: float,
    recipient_bank_account: Dict[str, str],
    user_metadata: Dict[str, str]
) -> Optional[Dict]:
    """
    Initiate USDC → USD wire transfer via Circle Sandbox.

    In production, requires:
    - KYC/KYB verification
    - Bank account linking
    - Circle Business Account
    - Compliance checks

    Args:
        amount_usd: Amount in USD to transfer
        recipient_bank_account: Bank details dict with keys:
            - account_number: Bank account number
            - routing_number: ABA routing number
            - bank_name: Name of the bank
            - account_holder_name: Beneficiary name
        user_metadata: User context dict with keys:
            - username: Revellio username
            - email: User email
            - liability_id: Associated liability ID

    Returns:
        Dictionary with transfer details if successful, None on failure:
        {
            "transfer_id": "circle_transfer_id",
            "status": "pending",
            "amount_usd": 1000.0,
            "estimated_arrival": "2026-04-05",
            "fee_usd": 0.0
        }

    Example:
        >>> await initiate_usdc_withdrawal(
        ...     amount_usd=1000.0,
        ...     recipient_bank_account={
        ...         "account_number": "1234567890",
        ...         "routing_number": "021000021",
        ...         "bank_name": "University Bank",
        ...         "account_holder_name": "University of South Florida"
        ...     },
        ...     user_metadata={
        ...         "username": "cbahlis",
        ...         "email": "student@usf.edu",
        ...         "liability_id": "42"
        ...     }
        ... )
        💳 Initiating Circle withdrawal: $1000.00 → University Bank...
        ✓ Transfer initiated: abc123...
        Status: pending
        Amount: $1000.00
        {'transfer_id': 'abc123...', 'status': 'pending', ...}
    """
    try:
        print(f"💳 Initiating Circle withdrawal: ${amount_usd:.2f} → {recipient_bank_account.get('bank_name', 'Unknown')}...")

        idempotency_key = str(uuid.uuid4())

        headers = {
            "Authorization": f"Bearer {settings.CIRCLE_API_KEY}",
            "Content-Type": "application/json",
            "X-Idempotency-Key": idempotency_key
        }

        payload = {
            "source": {
                "type": "blockchain",
                "chain": "ETH",  # Circle uses Ethereum for USDC
                "address": settings.CIRCLE_USDC_HOT_WALLET
            },
            "destination": {
                "type": "wire",
                "accountNumber": recipient_bank_account["account_number"],
                "routingNumber": recipient_bank_account["routing_number"],
                "bankName": recipient_bank_account["bank_name"],
                "beneficiaryName": recipient_bank_account["account_holder_name"]
            },
            "amount": {
                "amount": f"{amount_usd:.2f}",
                "currency": "USD"
            },
            "metadata": {
                "username": user_metadata.get("username"),
                "email": user_metadata.get("email"),
                "liability_id": str(user_metadata.get("liability_id", "")),
                "platform": "Revellio"
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{CIRCLE_SANDBOX_URL}/transfers",
                json=payload,
                headers=headers
            )

        if response.status_code == 201:
            data = response.json()
            transfer = data.get("data", {})

            transfer_id = transfer.get("id", "unknown")
            status = transfer.get("status", "pending")

            print(f"   ✓ Transfer initiated: {transfer_id[:10]}...")
            print(f"   Status: {status}")
            print(f"   Amount: ${amount_usd:.2f}")

            return {
                "transfer_id": transfer_id,
                "status": status,
                "amount_usd": amount_usd,
                "estimated_arrival": transfer.get("estimatedArrival"),
                "fee_usd": 0.0  # Sandbox has no fees
            }
        else:
            print(f"   ✗ Circle API error: {response.status_code}")
            print(f"   Response: {response.text}")
            return None

    except Exception as e:
        print(f"   ✗ Circle withdrawal failed: {e}")
        return None


async def check_transfer_status(transfer_id: str) -> Optional[str]:
    """
    Check the status of a Circle transfer.

    In sandbox, transfers complete instantly or quickly.
    In production, wire transfers take 1-2 business days.

    Args:
        transfer_id: Circle transfer ID (from initiate_usdc_withdrawal)

    Returns:
        Status string: "pending" | "complete" | "failed" | None (on error)

    Example:
        >>> await check_transfer_status("abc123...")
        ✓ Transfer abc123... status: complete
        'complete'
    """
    try:
        headers = {
            "Authorization": f"Bearer {settings.CIRCLE_API_KEY}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{CIRCLE_SANDBOX_URL}/transfers/{transfer_id}",
                headers=headers
            )

        if response.status_code == 200:
            data = response.json()
            transfer = data.get("data", {})
            status = transfer.get("status", "unknown")

            print(f"   ✓ Transfer {transfer_id[:10]}... status: {status}")
            return status
        else:
            print(f"   ✗ Status check failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None

    except Exception as e:
        print(f"   ✗ Status check error: {e}")
        return None


async def get_transfer_details(transfer_id: str) -> Optional[Dict]:
    """
    Get full details of a Circle transfer.

    Returns complete transfer information including all metadata,
    timestamps, and status history.

    Args:
        transfer_id: Circle transfer ID

    Returns:
        Full transfer details dict, or None on error

    Example:
        >>> details = await get_transfer_details("abc123...")
        >>> print(details['status'], details['amount']['amount'])
        complete 1000.00
    """
    try:
        headers = {
            "Authorization": f"Bearer {settings.CIRCLE_API_KEY}",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{CIRCLE_SANDBOX_URL}/transfers/{transfer_id}",
                headers=headers
            )

        if response.status_code == 200:
            data = response.json()
            return data.get("data", {})
        else:
            print(f"   ✗ Failed to get transfer details: {response.status_code}")
            return None

    except Exception as e:
        print(f"   ✗ Error getting transfer details: {e}")
        return None
