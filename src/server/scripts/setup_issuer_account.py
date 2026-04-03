#!/usr/bin/env python3
"""
Setup script for Revellio's issuer account.

This script establishes trustlines from the issuer account to USDC,
allowing the issuer to hold and send USDC for swaps.

Run this ONCE when setting up a new issuer account.
"""

from stellar_sdk import Keypair
from tools.stellar_tools import establish_trustline, USDC_ASSET, ensure_account_exists
from my_fastapi_app.app.settings import settings

print('🔧 Setting up Revellio issuer account...\n')

# Load issuer keypair
issuer_secret = settings.STELLAR_SECRET_KEY
issuer_kp = Keypair.from_secret(issuer_secret)

print(f'Issuer account: {issuer_kp.public_key}')

# Verify account exists and is funded
if not ensure_account_exists(issuer_kp.public_key):
    print('\n❌ ERROR: Issuer account not found!')
    print('   Please fund this account via Friendbot:')
    print(f'   https://friendbot.stellar.org?addr={issuer_kp.public_key}')
    exit(1)

print('\n📋 Establishing trustlines...')

# Establish trustline to USDC (Circle's testnet USDC)
usdc_tx = establish_trustline(issuer_kp, USDC_ASSET)

if usdc_tx:
    print('\n✅ Setup complete!')
    print(f'   Issuer can now hold and send USDC')
    print(f'   Transaction: https://stellar.expert/explorer/testnet/tx/{usdc_tx}')
else:
    print('\n⚠️  Setup may have failed or trustline already exists')
    print('   Try running the test script again')
