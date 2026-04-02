"""
Centralized configuration settings for Revellio API using pydantic-settings.

All environment variables and configuration constants are defined here.
This provides type safety, validation, and a single source of truth for all config.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables and defaults.

    Environment variables are automatically loaded from .env file.
    Uses pydantic for validation and type safety.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"  # Ignore extra env vars not defined here
    )

    # ============================================================================
    # API Keys
    # ============================================================================

    GOOGLE_API_KEY: str
    BROWSER_USE_API_KEY: str
    FRED_API_KEY: str
    TAVILY_API_KEY: str
    STELLAR_SECRET_KEY: str
    STRIPE_SECRET_KEY: Optional[str] = None       # Stripe payments secret key (sk_test_...)
    STRIPE_WEBHOOK_SECRET: Optional[str] = None   # Stripe webhook signing secret (whsec_...)
    WISE_API_KEY: Optional[str] = None            # Optional: Wise payments
    CIRCLE_API_KEY: Optional[str] = None          # Circle Sandbox API key
    CIRCLE_USDC_HOT_WALLET: Optional[str] = None  # Circle USDC custody wallet address (Ethereum)

    # ============================================================================
    # Database Configuration
    # ============================================================================

    DATABASE_URL: Optional[str] = None  # Full connection string (overrides individual components)
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "example"
    DB_HOST: str = "127.0.0.1"
    DB_PORT: str = "5432"
    DB_NAME: str = "postgres"

    @property
    def database_url(self) -> str:
        """Get database URL (use DATABASE_URL if set, otherwise construct from components)."""
        if self.DATABASE_URL:
            return self.DATABASE_URL
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # ============================================================================
    # SMTP / Email Configuration
    # ============================================================================

    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    FROM_EMAIL: Optional[str] = None  # Defaults to SMTP_USER if not set

    @property
    def from_email(self) -> Optional[str]:
        """Get from email (use FROM_EMAIL if set, otherwise use SMTP_USER)."""
        return self.FROM_EMAIL or self.SMTP_USER

    # ============================================================================
    # Cache Settings
    # ============================================================================

    CACHE_EXPIRY_MINUTES: int = 120  # How long to cache FX market data (2 hours)

    # ============================================================================
    # FX Provider API URLs
    # ============================================================================

    CREBIT_API_URL: str = "https://api.crebitpay.com/api/create-quote-new"
    WISE_API_URL: str = "https://api.wise.com/v3/quotes"
    REMITLY_API_URL: str = "https://api.remitly.io/v3/calculator/estimate"

    # ============================================================================
    # HTTP Client Settings
    # ============================================================================

    HTTP_CLIENT_TIMEOUT: float = 20.0  # Timeout in seconds for FX provider API calls

    # ============================================================================
    # Stellar Blockchain Settings
    # ============================================================================

    STELLAR_MOCK_BRZ_ISSUER: str  # Revellio's testnet public key for issuing Mock-BRZ (starts with 'G')
    STELLAR_TRANSACTION_TIMEOUT: int = 30  # Timeout in seconds for Stellar transactions
    STELLAR_BASE_FEE: int = 100  # Base fee for Stellar transactions
    STELLAR_EXPLORER_BASE_URL: str = "https://stellar.expert/explorer/testnet/tx"

    # ============================================================================
    # FX Provider Fee Configuration (in USD)
    # ============================================================================

    REF_AMOUNT_USD: float = 1000.0  # Reference amount for rate comparisons
    WISE_FEE_USD: float = 18.0  # Wise transfer fee
    REMITLY_FEE_USD: float = 0.0  # Remitly transfer fee (promotional)
    CREBIT_FEE_USD: float = 0.0  # Crebit transfer fee (student-focused)

    # ============================================================================
    # Default Account Balances
    # ============================================================================

    DEFAULT_BRL_BALANCE: float = 50000.0  # Default BRL balance for new users
    DEFAULT_USD_BALANCE: float = 0.0  # Default USD balance for new users

    # ============================================================================
    # Background Task Settings
    # ============================================================================

    MARKET_MONITOR_INTERVAL_SECONDS: int = 60  # How often to run the market monitor loop
    API_BASE_URL: str = "http://localhost:8000"  # Base URL for internal API calls (used by auto-executor)

    # ============================================================================
    # CORS Settings
    # ============================================================================

    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


# ============================================================================
# Singleton instance
# ============================================================================

settings = Settings()
"""
Global settings instance. Import this throughout the application:

    from my_fastapi_app.app.settings import settings

    # Then use like:
    api_key = settings.GOOGLE_API_KEY
    db_url = settings.database_url
"""
