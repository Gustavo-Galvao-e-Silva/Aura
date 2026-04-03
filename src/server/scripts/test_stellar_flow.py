#!/usr/bin/env python3
"""
Test script for Stellar testnet integration.

Tests the complete stablecoin flow:
1. Create test account
2. Fund via Friendbot
3. Establish trustlines
4. Mint Mock-BRZ
5. Swap BRZ → USDC
"""

from stellar_sdk import Keypair
from tools.stellar_tools import (
    ensure_account_exists,
    establish_trustline,
    mint_mock_brz,
    swap_brz_to_usdc,
    MOCK_BRZ_ASSET,
    USDC_ASSET
)

print('🧪 Testing Stellar integration...\n')

# Create test account
user_kp = Keypair.random()
print(f'1. Test user: {user_kp.public_key}')

# Fund account
if ensure_account_exists(user_kp.public_key):
    print('2. ✓ Account funded via Friendbot')

    # Trustlines
    establish_trustline(user_kp, MOCK_BRZ_ASSET)
    establish_trustline(user_kp, USDC_ASSET)
    print('3. ✓ Trustlines established')

    # Mint BRZ
    mint_tx = mint_mock_brz(user_kp.public_key, 5500.0)
    if mint_tx:
        print(f'4. ✓ Minted BRZ: https://stellar.expert/explorer/testnet/tx/{mint_tx}')

        # Swap to USDC (using mock mode by default for MVP/testnet)
        swap_result = swap_brz_to_usdc(user_kp.public_key, 5500.0, 5.5, use_mock=True)
        if swap_result:
            print(f'5. ✓ Swapped to USDC: https://stellar.expert/explorer/testnet/tx/{swap_result["tx_id"]}')

            print(f'\n🎉 ALL STELLAR TESTS PASSED!')
            print(f'   User received: ${swap_result["amount_usdc_received"]:.2f} USDC')
            print(f'   Rate used: {swap_result["actual_rate"]:.4f} BRL/USD')
        else:
            print('❌ Swap failed')
    else:
        print('❌ Minting failed')
else:
    print('❌ Account creation failed')
