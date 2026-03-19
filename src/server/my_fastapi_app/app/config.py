"""
Configuration settings for Revellio API.

This module centralizes all hardcoded values and configuration constants
to make them easy to find and modify.
"""

# Cache Settings
CACHE_EXPIRY_MINUTES = 120  # How long to cache FX market data

# FX Provider API URLs
CREBIT_API_URL = "https://api.crebitpay.com/api/create-quote-new"
WISE_API_URL = "https://api.wise.com/v3/quotes"
REMITLY_API_URL = "https://api.remitly.io/v3/calculator/estimate"

# HTTP Client Settings
HTTP_CLIENT_TIMEOUT = 20.0  # Timeout in seconds for FX provider API calls

# Stellar Blockchain Settings
STELLAR_TRANSACTION_TIMEOUT = 30  # Timeout in seconds for Stellar transactions
STELLAR_BASE_FEE = 100  # Base fee for Stellar transactions
STELLAR_EXPLORER_BASE_URL = "https://stellar.expert/explorer/testnet/tx"

# FX Provider Fee Configuration (in USD)
REF_AMOUNT_USD = 1000.0  # Reference amount for rate comparisons
WISE_FEE_USD = 18.0  # Wise transfer fee
REMITLY_FEE_USD = 0.0  # Remitly transfer fee (promotional)
CREBIT_FEE_USD = 0.0  # Crebit transfer fee (student-focused)

# Default Account Balances
DEFAULT_BRL_BALANCE = 50000.0  # Default BRL balance for new users
DEFAULT_USD_BALANCE = 0.0  # Default USD balance for new users

# Background Task Settings
MARKET_MONITOR_INTERVAL_SECONDS = 60  # How often to run the market monitor loop

# CORS Settings
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
