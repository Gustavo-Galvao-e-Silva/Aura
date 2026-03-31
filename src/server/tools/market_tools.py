"""
Market data fetching tools with per-source TTL caching.

This module provides API access to:
- BCB (Brazil Central Bank): Selic rate, Focus Market Readout
- FRED (Federal Reserve): Fed Funds rate, US inflation, yield curve
- World Bank: GDP growth projections
- Yahoo Finance: Commodity prices (oil, soy, iron ore proxy)
- Tavily: News and sentiment research

Each source has its own cache TTL based on update frequency.
"""

import os
import requests
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple
import yfinance as yf
from my_fastapi_app.app.settings import settings

# Try to import optional dependencies
try:
    from fredapi import Fred
    FRED_AVAILABLE = True
except ImportError:
    FRED_AVAILABLE = False
    print("⚠️  fredapi not installed. FRED data will not be available.")

try:
    import wbgapi as wb
    WB_AVAILABLE = True
except ImportError:
    WB_AVAILABLE = False
    print("⚠️  wbgapi not installed. World Bank data will not be available.")

try:
    from bcb import sgs
    BCB_AVAILABLE = True
except ImportError:
    BCB_AVAILABLE = False
    print("⚠️  python-bcb not installed. Using direct API calls for BCB data.")

try:
    from tavily import TavilyClient
    TAVILY_AVAILABLE = True
except ImportError:
    TAVILY_AVAILABLE = False
    print("⚠️  tavily-python not installed. Sentiment research will be limited.")


# ============================================================================
# CACHING INFRASTRUCTURE
# ============================================================================

# Cache structure: {source_name: {"data": Any, "fetched_at": datetime, "ttl_minutes": int}}
_CACHE: Dict[str, Dict[str, Any]] = {}

# TTL Configuration (in minutes) based on real-world update frequencies
CACHE_TTL = {
    "bcb_selic": 24 * 60,        # Selic updates every 45 days (BCB meeting)
    "bcb_focus": 6 * 60,          # Focus Report: every Monday
    "fred_fedfunds": 24 * 60,     # Fed Funds: every 6 weeks (FOMC meeting)
    "fred_inflation": 12 * 60,    # CPI/PCE: monthly releases
    "fred_yield_curve": 60,       # Yield curve: daily market data
    "wb_gdp": 24 * 60,            # GDP forecasts: quarterly/annual
    "commodities": 30,            # Commodity prices: daily, cache 30min for freshness
    "tavily_news": 90,            # News sentiment: cache 90min to reduce API costs
}


def get_cached_or_fetch(
    source_name: str,
    fetch_function: callable,
    force_refresh: bool = False
) -> Optional[Any]:
    """
    Generic caching wrapper.

    Args:
        source_name: Key for the cache (must exist in CACHE_TTL)
        fetch_function: Function to call if cache is stale/missing
        force_refresh: If True, ignore cache and fetch fresh data

    Returns:
        Cached or freshly fetched data, or None on error
    """
    now = datetime.now()

    # Check cache
    if not force_refresh and source_name in _CACHE:
        cached = _CACHE[source_name]
        age_minutes = (now - cached["fetched_at"]).total_seconds() / 60
        ttl = CACHE_TTL.get(source_name, 60)

        if age_minutes < ttl:
            print(f"♻️  {source_name}: Using cached data ({int(age_minutes)}min old)")
            return cached["data"]

    # Fetch fresh data
    print(f"🌐 {source_name}: Fetching fresh data...")
    try:
        data = fetch_function()
        _CACHE[source_name] = {
            "data": data,
            "fetched_at": now,
            "ttl_minutes": CACHE_TTL.get(source_name, 60)
        }
        return data
    except Exception as e:
        print(f"⚠️  {source_name}: Fetch failed: {e}")
        # Return stale cache if available, rather than failing completely
        if source_name in _CACHE:
            print(f"⚠️  {source_name}: Using stale cached data as fallback")
            return _CACHE[source_name]["data"]
        return None


# ============================================================================
# BRAZIL CENTRAL BANK (BCB) DATA
# ============================================================================

def fetch_bcb_selic() -> Optional[float]:
    """
    Fetch the current Selic target rate from BCB.

    Uses the SGS (Time Series Management System) API.
    Series ID 432 = Selic target rate (% per year)

    Returns:
        Current Selic rate as float (e.g., 14.75), or None on error
    """
    if BCB_AVAILABLE:
        try:
            # Get last 1 value from series 432
            series = sgs.get({"selic": 432}, last=1)
            if not series.empty:
                return float(series["selic"].iloc[0])
        except Exception as e:
            print(f"⚠️  BCB SGS library failed: {e}. Trying direct API...")

    # Fallback: direct API call
    try:
        url = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data and len(data) > 0:
            return float(data[0]["valor"])
    except Exception as e:
        print(f"⚠️  BCB direct API failed: {e}")

    return None


def fetch_bcb_focus_median() -> Optional[Dict[str, float]]:
    """
    Fetch Focus Market Readout median expectations.

    The BCB Expectations API provides weekly survey of market forecasts.

    Returns:
        Dict with keys: "ipca_12m" (inflation), "selic_eoy" (Selic end-of-year),
        "brl_usd_eoy" (exchange rate), or None on error
    """
    try:
        # BCB Expectations API endpoint (OData format)
        base_url = "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata"

        # Get IPCA (inflation) 12-month ahead median
        ipca_url = f"{base_url}/ExpectativaMercadoMensais?$top=1&$filter=Indicador%20eq%20'IPCA'%20and%20baseCalculo%20eq%200&$orderby=Data%20desc&$format=json&$select=Mediana,Data"

        # Get Selic end-of-year median
        selic_url = f"{base_url}/ExpectativaMercadoAnuais?$top=1&$filter=Indicador%20eq%20'Selic'%20and%20baseCalculo%20eq%200&$orderby=Data%20desc&$format=json&$select=Mediana,Data"

        # Get BRL/USD end-of-year median
        fx_url = f"{base_url}/ExpectativaMercadoAnuais?$top=1&$filter=Indicador%20eq%20'Taxa%20de%20c%C3%A2mbio'%20and%20baseCalculo%20eq%200&$orderby=Data%20desc&$format=json&$select=Mediana,Data"

        results = {}

        # Fetch IPCA
        resp = requests.get(ipca_url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("value") and len(data["value"]) > 0:
            results["ipca_12m"] = float(data["value"][0]["Mediana"])

        # Fetch Selic
        resp = requests.get(selic_url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("value") and len(data["value"]) > 0:
            results["selic_eoy"] = float(data["value"][0]["Mediana"])

        # Fetch FX
        resp = requests.get(fx_url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        if data.get("value") and len(data["value"]) > 0:
            results["brl_usd_eoy"] = float(data["value"][0]["Mediana"])

        return results if results else None

    except Exception as e:
        print(f"⚠️  BCB Focus API failed: {e}")
        return None


def get_bcb_selic() -> Optional[float]:
    """Public API: Get Selic rate with caching."""
    return get_cached_or_fetch("bcb_selic", fetch_bcb_selic)


def get_bcb_focus() -> Optional[Dict[str, float]]:
    """Public API: Get Focus Market Readout with caching."""
    return get_cached_or_fetch("bcb_focus", fetch_bcb_focus_median)


# ============================================================================
# FEDERAL RESERVE (FRED) DATA
# ============================================================================

def fetch_fred_fedfunds() -> Optional[float]:
    """
    Fetch the current Federal Funds Effective Rate.

    Returns:
        Fed Funds rate as float (e.g., 3.58), or None on error
    """
    if not FRED_AVAILABLE:
        return None

    api_key = settings.FRED_API_KEY
    if not api_key:
        print("⚠️  FRED_API_KEY not set in environment")
        return None

    try:
        fred = Fred(api_key=api_key)
        series = fred.get_series("FEDFUNDS", observation_start=datetime.now() - timedelta(days=60))
        if not series.empty:
            return float(series.iloc[-1])
    except Exception as e:
        print(f"⚠️  FRED API (Fed Funds) failed: {e}")

    return None


def fetch_fred_inflation() -> Optional[Dict[str, float]]:
    """
    Fetch US inflation indicators (CPI and PCE).

    Returns:
        Dict with keys "cpi_yoy" and "pce_yoy" (year-over-year %), or None
    """
    if not FRED_AVAILABLE:
        return None

    api_key = settings.FRED_API_KEY
    if not api_key:
        return None

    try:
        fred = Fred(api_key=api_key)
        results = {}

        # CPI (Consumer Price Index, year-over-year change)
        cpi = fred.get_series("CPIAUCSL", observation_start=datetime.now() - timedelta(days=400))
        if not cpi.empty and len(cpi) >= 12:
            # Calculate YoY: (current / 12 months ago - 1) * 100
            current = float(cpi.iloc[-1])
            year_ago = float(cpi.iloc[-13]) if len(cpi) >= 13 else float(cpi.iloc[-12])
            results["cpi_yoy"] = ((current / year_ago) - 1) * 100

        # PCE (Personal Consumption Expenditures Price Index)
        pce = fred.get_series("PCEPI", observation_start=datetime.now() - timedelta(days=400))
        if not pce.empty and len(pce) >= 12:
            current = float(pce.iloc[-1])
            year_ago = float(pce.iloc[-13]) if len(pce) >= 13 else float(pce.iloc[-12])
            results["pce_yoy"] = ((current / year_ago) - 1) * 100

        return results if results else None

    except Exception as e:
        print(f"⚠️  FRED API (Inflation) failed: {e}")
        return None


def fetch_fred_yield_curve() -> Optional[float]:
    """
    Fetch the 10Y-2Y Treasury yield spread.

    A negative spread (inversion) is a recession indicator and "risk-off" signal.

    Returns:
        Yield spread in percentage points, or None
    """
    if not FRED_AVAILABLE:
        return None

    api_key = settings.FRED_API_KEY
    if not api_key:
        return None

    try:
        fred = Fred(api_key=api_key)
        # T10Y2Y is the pre-calculated 10-Year minus 2-Year spread
        series = fred.get_series("T10Y2Y", observation_start=datetime.now() - timedelta(days=30))
        if not series.empty:
            return float(series.iloc[-1])
    except Exception as e:
        print(f"⚠️  FRED API (Yield Curve) failed: {e}")

    return None


def get_fred_fedfunds() -> Optional[float]:
    """Public API: Get Fed Funds rate with caching."""
    return get_cached_or_fetch("fred_fedfunds", fetch_fred_fedfunds)


def get_fred_inflation() -> Optional[Dict[str, float]]:
    """Public API: Get US inflation data with caching."""
    return get_cached_or_fetch("fred_inflation", fetch_fred_inflation)


def get_fred_yield_curve() -> Optional[float]:
    """Public API: Get yield curve spread with caching."""
    return get_cached_or_fetch("fred_yield_curve", fetch_fred_yield_curve)


# ============================================================================
# WORLD BANK GDP DATA
# ============================================================================

def fetch_wb_gdp_growth() -> Optional[Dict[str, float]]:
    """
    Fetch GDP growth projections for Brazil and USA from World Bank.

    Returns:
        Dict with keys "brazil_gdp_growth" and "usa_gdp_growth" (%), or None
    """
    if not WB_AVAILABLE:
        return None

    try:
        results = {}

        # Fetch Brazil GDP growth (most recent year available)
        # Indicator NY.GDP.MKTP.KD.ZG = GDP growth (annual %)
        brazil_data = wb.data.DataFrame("NY.GDP.MKTP.KD.ZG", "BRA", numericTimeKeys=True, labels=False)
        if not brazil_data.empty:
            # Get the most recent non-null value
            latest = brazil_data.iloc[0].dropna()
            if not latest.empty:
                results["brazil_gdp_growth"] = float(latest.iloc[-1])

        # Fetch USA GDP growth
        usa_data = wb.data.DataFrame("NY.GDP.MKTP.KD.ZG", "USA", numericTimeKeys=True, labels=False)
        if not usa_data.empty:
            latest = usa_data.iloc[0].dropna()
            if not latest.empty:
                results["usa_gdp_growth"] = float(latest.iloc[-1])

        return results if results else None

    except Exception as e:
        print(f"⚠️  World Bank API failed: {e}")
        return None


def get_wb_gdp_growth() -> Optional[Dict[str, float]]:
    """Public API: Get GDP growth data with caching."""
    return get_cached_or_fetch("wb_gdp", fetch_wb_gdp_growth)


# ============================================================================
# COMMODITY PRICES (Yahoo Finance)
# ============================================================================

def fetch_commodity_prices() -> Optional[Dict[str, Dict[str, float]]]:
    """
    Fetch commodity prices for Brazil's major exports.

    Tickers:
    - BZ=F: Brent Crude Oil (global benchmark)
    - ZS=F: Soybean Futures (CBOT) — correct ticker (not ZC=F which is corn)
    - VALE3.SA: Vale S.A. stock (iron ore proxy, Brazil's largest exporter)

    Returns:
        Dict with keys "brent_oil", "soy", "iron_ore_proxy"
        Each value is a dict with "current_price" and "change_30d_pct"
    """
    try:
        results = {}
        tickers = {
            "brent_oil": "BZ=F",
            "soy": "ZS=F",
            "iron_ore_proxy": "VALE3.SA"
        }

        for name, ticker in tickers.items():
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period="1mo")  # Get 30 days of data

                if not hist.empty:
                    current = float(hist["Close"].iloc[-1])
                    first = float(hist["Close"].iloc[0])
                    change_pct = ((current / first) - 1) * 100

                    results[name] = {
                        "current_price": current,
                        "change_30d_pct": change_pct
                    }
            except Exception as e:
                print(f"⚠️  Commodity {ticker} fetch failed: {e}")

        return results if results else None

    except Exception as e:
        print(f"⚠️  Commodity prices fetch failed: {e}")
        return None


def get_commodity_prices() -> Optional[Dict[str, Dict[str, float]]]:
    """Public API: Get commodity prices with caching."""
    return get_cached_or_fetch("commodities", fetch_commodity_prices)


# ============================================================================
# NEWS & SENTIMENT (Tavily)
# ============================================================================

def fetch_tavily_news(query: str, max_results: int = 5) -> Optional[Dict[str, Any]]:
    """
    Search for news using Tavily API.

    Args:
        query: Search query (e.g., "Brazil fiscal policy 2026")
        max_results: Number of results to return

    Returns:
        Dict with "results" list and "summary" string, or None
    """
    if not TAVILY_AVAILABLE:
        print("⚠️  Tavily client not available")
        return None

    api_key = settings.TAVILY_API_KEY
    if not api_key:
        print("⚠️  TAVILY_API_KEY not set in environment")
        return None

    try:
        tavily = TavilyClient(api_key=api_key)
        response = tavily.search(query=query, max_results=max_results)

        return {
            "results": response.get("results", []),
            "query": query,
            "fetched_at": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"⚠️  Tavily API failed: {e}")
        return None


def get_tavily_brl_sentiment() -> Optional[Dict[str, Any]]:
    """
    Public API: Get BRL/USD market sentiment news with caching.

    Searches for recent news affecting Brazilian Real strength.
    """
    def fetch():
        return fetch_tavily_news("BRL USD Brazil economy market sentiment 2026", max_results=5)

    return get_cached_or_fetch("tavily_news", fetch)


# ============================================================================
# HELPER: Clear cache (for testing/debugging)
# ============================================================================

def clear_cache(source_name: Optional[str] = None):
    """
    Clear the cache.

    Args:
        source_name: If provided, clear only this source. Otherwise, clear all.
    """
    global _CACHE
    if source_name:
        _CACHE.pop(source_name, None)
        print(f"🗑️  Cleared cache for {source_name}")
    else:
        _CACHE.clear()
        print("🗑️  Cleared all cached market data")
