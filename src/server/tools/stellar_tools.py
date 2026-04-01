"""
Stellar testnet tools for stablecoin operations.

Mock-BRZ Asset:
- Issuer: Revellio's testnet account (configured via STELLAR_MOCK_BRZ_ISSUER)
- Asset Code: BRZ (Brazilian Real stablecoin, testnet version)
- 1 Mock-BRZ = 1 Real BRL (conceptually)

Operations:
1. ensure_account_exists(): Verify Stellar account exists, fund via Friendbot if needed
2. establish_trustline(): Enable user to hold custom assets (BRZ, USDC)
3. mint_mock_brz(): Credit user's Stellar account with Mock-BRZ
4. swap_brz_to_usdc(): Use testnet DEX to convert BRZ → USDC

Phase 2 Step 2.3 - Part of Stablecoin Sandbox Implementation
"""

from stellar_sdk import Server, Keypair, TransactionBuilder, Network, Asset
from stellar_sdk.exceptions import BadRequestError, NotFoundError
from my_fastapi_app.app.settings import settings
from typing import Optional
import requests


# Stellar testnet configuration
TESTNET_SERVER = Server("https://horizon-testnet.stellar.org")
TESTNET_NETWORK = Network.TESTNET_NETWORK_PASSPHRASE

# Mock-BRZ asset (issuer account must be created first - see documentation)
MOCK_BRZ_ISSUER = settings.STELLAR_MOCK_BRZ_ISSUER
MOCK_BRZ_ASSET = Asset("BRZ", MOCK_BRZ_ISSUER)

# USDC on Stellar testnet (Circle's official test asset)
USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
USDC_ASSET = Asset("USDC", USDC_ISSUER)


def ensure_account_exists(public_key: str) -> bool:
    """
    Check if a Stellar account exists on testnet.
    If not, fund it using Friendbot (testnet faucet).

    Args:
        public_key: Stellar public key (starts with 'G')

    Returns:
        True if account exists or was successfully created, False otherwise

    Example:
        >>> ensure_account_exists("GAXXX...")
        ✓ Account exists: GAXXX...
        True
    """
    try:
        TESTNET_SERVER.accounts().account_id(public_key).call()
        print(f"   ✓ Account exists: {public_key[:10]}...")
        return True
    except NotFoundError:
        print(f"   Creating account via Friendbot: {public_key[:10]}...")
        try:
            response = requests.get(f"https://friendbot.stellar.org?addr={public_key}")
            if response.status_code == 200:
                print(f"   ✓ Account funded: {public_key[:10]}...")
                return True
            else:
                print(f"   ✗ Friendbot failed: {response.text}")
                return False
        except Exception as e:
            print(f"   ✗ Friendbot error: {e}")
            return False


def establish_trustline(user_keypair: Keypair, asset: Asset) -> Optional[str]:
    """
    Establish a trustline to an asset (required before receiving it).

    In Stellar, you must explicitly trust an asset before you can hold it.
    This is a security feature preventing spam tokens.

    Args:
        user_keypair: User's Stellar keypair (needs secret key to sign)
        asset: Asset to trust (e.g., MOCK_BRZ_ASSET, USDC_ASSET)

    Returns:
        Transaction hash if successful, "already_exists" if trustline exists, None on failure

    Example:
        >>> user_kp = Keypair.from_secret("S...")
        >>> establish_trustline(user_kp, MOCK_BRZ_ASSET)
        ✓ Trustline established for BRZ: abc123...
        'abc123...'
    """
    try:
        source_account = TESTNET_SERVER.load_account(user_keypair.public_key)

        transaction = (
            TransactionBuilder(
                source_account=source_account,
                network_passphrase=TESTNET_NETWORK,
                base_fee=settings.STELLAR_BASE_FEE
            )
            .append_change_trust_op(asset=asset, limit="1000000")
            .set_timeout(settings.STELLAR_TRANSACTION_TIMEOUT)
            .build()
        )

        transaction.sign(user_keypair)
        response = TESTNET_SERVER.submit_transaction(transaction)

        tx_id = response["hash"]
        print(f"   ✓ Trustline established for {asset.code}: {tx_id[:10]}...")
        return tx_id

    except BadRequestError as e:
        if "op_already_exists" in str(e):
            print(f"   ℹ️  Trustline already exists for {asset.code}")
            return "already_exists"
        else:
            print(f"   ✗ Trustline failed: {e}")
            return None
    except Exception as e:
        print(f"   ✗ Trustline error: {e}")
        return None


def mint_mock_brz(user_public_key: str, amount_brl: float) -> Optional[str]:
    """
    Mint Mock-BRZ tokens and send to user's Stellar account.

    This simulates converting fiat BRL → stablecoin BRZ on the blockchain.
    In production, this would be triggered after verifying Stripe deposit.

    Args:
        user_public_key: Recipient's Stellar public key
        amount_brl: Amount of Mock-BRZ to mint (1 Mock-BRZ = 1 BRL)

    Returns:
        Stellar transaction hash if successful, None on failure

    Prerequisites:
        - User account must exist (use ensure_account_exists)
        - User must have trustline to BRZ (use establish_trustline)

    Example:
        >>> mint_mock_brz("GUSER...", 5500.0)
        🪙 Minting R$5500.00 Mock-BRZ for GUSER...
        ✓ Minted R$5500.00 Mock-BRZ: def456...
        Stellar Explorer: https://stellar.expert/explorer/testnet/tx/def456...
        'def456...'
    """
    try:
        print(f"🪙 Minting R${amount_brl:.2f} Mock-BRZ for {user_public_key[:10]}...")

        if not ensure_account_exists(user_public_key):
            print("   ✗ Cannot mint: user account does not exist")
            return None

        issuer_keypair = Keypair.from_secret(settings.STELLAR_SECRET_KEY)
        issuer_account = TESTNET_SERVER.load_account(issuer_keypair.public_key)

        transaction = (
            TransactionBuilder(
                source_account=issuer_account,
                network_passphrase=TESTNET_NETWORK,
                base_fee=settings.STELLAR_BASE_FEE
            )
            .append_payment_op(
                destination=user_public_key,
                asset=MOCK_BRZ_ASSET,
                amount=str(amount_brl)
            )
            .set_timeout(settings.STELLAR_TRANSACTION_TIMEOUT)
            .build()
        )

        transaction.sign(issuer_keypair)
        response = TESTNET_SERVER.submit_transaction(transaction)

        tx_id = response["hash"]
        print(f"   ✓ Minted R${amount_brl:.2f} Mock-BRZ: {tx_id[:10]}...")
        print(f"   Stellar Explorer: https://stellar.expert/explorer/testnet/tx/{tx_id}")

        return tx_id

    except BadRequestError as e:
        if "op_no_trust" in str(e):
            print(f"   ⚠️  User has not established trustline for Mock-BRZ")
            return None
        else:
            print(f"   ✗ Mint failed: {e}")
            return None
    except Exception as e:
        print(f"   ✗ Mint error: {e}")
        return None


def swap_brz_to_usdc(
    user_public_key: str,
    amount_brz: float,
    expected_rate: float = 5.5
) -> Optional[dict]:
    """
    Swap Mock-BRZ → USDC using Stellar testnet.

    For sandbox simplicity, implemented as direct USDC payment from issuer.
    In production, use PathPaymentStrictSend for real DEX routing with slippage protection.

    Args:
        user_public_key: Recipient's Stellar public key
        amount_brz: Amount of Mock-BRZ to swap
        expected_rate: Expected BRL/USD exchange rate (default: 5.5)

    Returns:
        Dictionary with swap details if successful, None on failure:
        {
            "tx_id": "stellar_tx_hash",
            "amount_brz_sent": 5500.0,
            "amount_usdc_received": 1000.0,
            "actual_rate": 5.5,
            "fee_brz": 0.0
        }

    Example:
        >>> swap_brz_to_usdc("GUSER...", 5500.0, 5.5)
        🔄 Swapping R$5500.00 Mock-BRZ → USDC (rate: 5.5000)...
        Expected: $1000.00 USDC (min: $980.00)
        ✓ Swap complete: R$5500.00 → $1000.00 USDC
        TX: ghi789...
        {'tx_id': 'ghi789...', 'amount_brz_sent': 5500.0, ...}
    """
    try:
        print(f"🔄 Swapping R${amount_brz:.2f} Mock-BRZ → USDC (rate: {expected_rate:.4f})...")

        expected_usdc = amount_brz / expected_rate
        min_usdc = expected_usdc * 0.98  # 2% slippage protection

        print(f"   Expected: ${expected_usdc:.2f} USDC (min: ${min_usdc:.2f})")

        issuer_keypair = Keypair.from_secret(settings.STELLAR_SECRET_KEY)
        issuer_account = TESTNET_SERVER.load_account(issuer_keypair.public_key)

        transaction = (
            TransactionBuilder(
                source_account=issuer_account,
                network_passphrase=TESTNET_NETWORK,
                base_fee=settings.STELLAR_BASE_FEE
            )
            .append_payment_op(
                destination=user_public_key,
                asset=USDC_ASSET,
                amount=str(round(expected_usdc, 2))
            )
            .set_timeout(settings.STELLAR_TRANSACTION_TIMEOUT)
            .build()
        )

        transaction.sign(issuer_keypair)
        response = TESTNET_SERVER.submit_transaction(transaction)

        tx_id = response["hash"]
        actual_usdc = expected_usdc
        fee_brz = 0.0

        print(f"   ✓ Swap complete: R${amount_brz:.2f} → ${actual_usdc:.2f} USDC")
        print(f"   TX: {tx_id[:10]}...")

        return {
            "tx_id": tx_id,
            "amount_brz_sent": amount_brz,
            "amount_usdc_received": actual_usdc,
            "actual_rate": amount_brz / actual_usdc,
            "fee_brz": fee_brz
        }

    except Exception as e:
        print(f"   ✗ Swap failed: {e}")
        return None
