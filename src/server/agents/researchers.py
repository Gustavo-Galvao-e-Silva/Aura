"""
Specialized researcher nodes for the Revellio agent system.

These nodes run in parallel (fan-out architecture) to gather market intelligence:
- Macro Researcher: BCB, FRED, World Bank (pure API, no LLM)
- Commodity Researcher: Yahoo Finance commodity prices (pure API, no LLM)
- Sentiment Researcher: Tavily + Browser Use for news/politics (minimal LLM)

Each returns findings to their respective state fields (macro_findings, etc.)
The synthesis_node will then combine all findings into a structured MarketAnalysis.
"""

import os
import json
from datetime import datetime
from typing import Dict, Any
from agents.state import AuraState
from my_fastapi_app.app.settings import settings
from tools.market_tools import (
    get_bcb_selic,
    get_bcb_focus,
    get_fred_fedfunds,
    get_fred_inflation,
    get_fred_yield_curve,
    get_wb_gdp_growth,
    get_commodity_prices,
    get_tavily_brl_sentiment,
)
from browser_use_sdk.v3 import AsyncBrowserUse
from google import genai
from google.genai import types
from pydantic import BaseModel

# Cache configuration for Browser Use (file-based to persist across restarts)
SENTIMENT_CACHE_FILE = "sentiment_browser_cache.json"
SENTIMENT_CACHE_TTL_MINUTES = 90  # Match Tavily news cache TTL


# ============================================================================
# MACRO RESEARCHER (Sources 1-5: Selic, Focus, Fed, Inflation, GDP)
# ============================================================================

def macro_researcher_node(state: AuraState) -> Dict[str, Any]:
    """
    Role: Macro-Economic Researcher (API-first, no LLM).

    Gathers fundamental economic data:
    1. BCB Selic rate (current target)
    2. BCB Focus Report (market expectations for inflation, Selic, FX)
    3. FRED Fed Funds rate (US monetary policy)
    4. FRED Inflation (CPI, PCE year-over-year)
    5. FRED Yield Curve (10Y-2Y spread, risk-off indicator)
    6. World Bank GDP growth (Brazil vs USA)

    Returns:
        Dict with key "macro_findings" containing all gathered metrics
    """
    print("📊 Macro Researcher: Gathering economic fundamentals...")

    findings = {
        "fetched_at": datetime.now().isoformat(),
        "sources": []
    }

    # 1. BCB Selic Rate
    try:
        selic = get_bcb_selic()
        if selic is not None:
            findings["selic_rate"] = selic
            findings["sources"].append("BCB SGS (Selic)")
            print(f"   ✓ Selic: {selic}%")
        else:
            print("   ✗ Selic: unavailable")
    except Exception as e:
        print(f"   ✗ Selic fetch error: {e}")

    # 2. BCB Focus Report
    try:
        focus = get_bcb_focus()
        if focus:
            findings["focus_ipca_12m"] = focus.get("ipca_12m")
            findings["focus_selic_eoy"] = focus.get("selic_eoy")
            findings["focus_brl_usd_eoy"] = focus.get("brl_usd_eoy")
            findings["sources"].append("BCB Focus Report")
            print(f"   ✓ Focus: IPCA={focus.get('ipca_12m')}%, Selic EOY={focus.get('selic_eoy')}%")
        else:
            print("   ✗ Focus Report: unavailable")
    except Exception as e:
        print(f"   ✗ Focus fetch error: {e}")

    # 3. FRED Fed Funds Rate
    try:
        fed_rate = get_fred_fedfunds()
        if fed_rate is not None:
            findings["fed_funds_rate"] = fed_rate
            findings["sources"].append("FRED (Fed Funds)")
            print(f"   ✓ Fed Funds: {fed_rate}%")

            # Calculate interest rate differential (Selic - Fed)
            if "selic_rate" in findings:
                findings["rate_differential"] = findings["selic_rate"] - fed_rate
                print(f"   ✓ Rate Spread (Selic-Fed): {findings['rate_differential']:.2f}pp")
        else:
            print("   ✗ Fed Funds: unavailable")
    except Exception as e:
        print(f"   ✗ Fed Funds fetch error: {e}")

    # 4. FRED US Inflation
    try:
        inflation = get_fred_inflation()
        if inflation:
            findings["us_cpi_yoy"] = inflation.get("cpi_yoy")
            findings["us_pce_yoy"] = inflation.get("pce_yoy")
            findings["sources"].append("FRED (Inflation)")
            print(f"   ✓ US Inflation: CPI={inflation.get('cpi_yoy'):.2f}%, PCE={inflation.get('pce_yoy'):.2f}%")
        else:
            print("   ✗ US Inflation: unavailable")
    except Exception as e:
        print(f"   ✗ Inflation fetch error: {e}")

    # 5. FRED Yield Curve
    try:
        yield_spread = get_fred_yield_curve()
        if yield_spread is not None:
            findings["yield_curve_10y2y"] = yield_spread
            findings["sources"].append("FRED (Yield Curve)")
            inversion = "⚠️ INVERTED (recession signal)" if yield_spread < 0 else ""
            print(f"   ✓ Yield Curve (10Y-2Y): {yield_spread:.2f}pp {inversion}")
        else:
            print("   ✗ Yield Curve: unavailable")
    except Exception as e:
        print(f"   ✗ Yield Curve fetch error: {e}")

    # 6. World Bank GDP Growth
    try:
        gdp = get_wb_gdp_growth()
        if gdp:
            findings["brazil_gdp_growth"] = gdp.get("brazil_gdp_growth")
            findings["usa_gdp_growth"] = gdp.get("usa_gdp_growth")
            findings["sources"].append("World Bank (GDP)")
            print(f"   ✓ GDP Growth: Brazil={gdp.get('brazil_gdp_growth'):.2f}%, USA={gdp.get('usa_gdp_growth'):.2f}%")
        else:
            print("   ✗ GDP Growth: unavailable")
    except Exception as e:
        print(f"   ✗ GDP fetch error: {e}")

    print(f"📊 Macro Researcher: Collected {len(findings['sources'])} sources")

    return {"macro_findings": findings}


# ============================================================================
# COMMODITY RESEARCHER (Source 6: Oil, Soy, Iron Ore)
# ============================================================================

def commodity_researcher_node(state: AuraState) -> Dict[str, Any]:
    """
    Role: Commodity Market Researcher (API-first, no LLM).

    Tracks Brazil's major commodity exports:
    - Brent Crude Oil (BZ=F)
    - Soybean Futures (ZS=F)
    - Vale S.A. stock (VALE3.SA) as iron ore proxy

    Returns:
        Dict with key "commodity_findings" containing price data and 30-day trends
    """
    print("🌾 Commodity Researcher: Tracking commodity prices...")

    findings = {
        "fetched_at": datetime.now().isoformat(),
        "sources": ["Yahoo Finance"]
    }

    try:
        commodities = get_commodity_prices()
        if commodities:
            findings["commodities"] = commodities

            # Extract summary metrics
            for name, data in commodities.items():
                price = data.get("current_price", 0)
                change = data.get("change_30d_pct", 0)
                direction = "📈" if change > 0 else "📉" if change < 0 else "➡️"
                print(f"   {direction} {name.replace('_', ' ').title()}: ${price:.2f} ({change:+.2f}% 30d)")

            # Calculate aggregate sentiment
            changes = [data.get("change_30d_pct", 0) for data in commodities.values()]
            avg_change = sum(changes) / len(changes) if changes else 0
            findings["commodity_sentiment"] = "bullish" if avg_change > 2 else "bearish" if avg_change < -2 else "neutral"
            print(f"   Overall Commodity Sentiment: {findings['commodity_sentiment']} (avg {avg_change:+.2f}%)")
        else:
            print("   ✗ Commodity prices: unavailable")
            findings["commodity_sentiment"] = "unknown"

    except Exception as e:
        print(f"   ✗ Commodity fetch error: {e}")
        findings["commodity_sentiment"] = "unknown"

    print("🌾 Commodity Researcher: Complete")

    return {"commodity_findings": findings}


# ============================================================================
# SENTIMENT RESEARCHER (Sources 7-9: Fiscal, Geopolitics, Politics)
# ============================================================================

class SentimentAnalysis(BaseModel):
    """Structured output for sentiment researcher."""
    fiscal_health_score: int  # 1-10, higher = healthier fiscal situation
    geopolitical_risk_score: int  # 1-10, higher = more risk/volatility
    political_stability_score: int  # 1-10, higher = more stable
    summary: str  # 2-3 sentence summary of key risks/opportunities
    risk_flags: list[str]  # List of specific risks (e.g., ["election_volatility", "commodity_headwind"])


async def sentiment_researcher_node(state: AuraState) -> Dict[str, Any]:
    """
    Role: Sentiment & Political Risk Researcher (Search-first, minimal LLM).

    Uses Tavily for news aggregation and Browser Use for deeper research.
    Focuses on:
    7. Fiscal Health (Brazil's debt-to-GDP, deficit trends)
    8. Geopolitics (conflicts affecting commodity prices, risk-off sentiment)
    9. Political Stability (2026 Brazil elections, spending ceiling debates)

    Returns:
        Dict with key "sentiment_findings" including risk scores and flags
    """
    print("📰 Sentiment Researcher: Analyzing news and political risks...")

    findings = {
        "fetched_at": datetime.now().isoformat(),
        "sources": []
    }

    # Initialize Browser Use client
    bu_client = AsyncBrowserUse(api_key=settings.BROWSER_USE_API_KEY)
    gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    # Gather news from multiple angles
    news_data = []

    # 1. Get general BRL sentiment from Tavily (cached)
    try:
        tavily_results = get_tavily_brl_sentiment()
        if tavily_results and tavily_results.get("results"):
            news_data.append({
                "source": "Tavily: BRL Market Sentiment",
                "headlines": [r.get("title", "") for r in tavily_results["results"][:3]]
            })
            findings["sources"].append("Tavily API")
            print(f"   ✓ Tavily: Found {len(tavily_results['results'])} relevant articles")
    except Exception as e:
        print(f"   ✗ Tavily search error: {e}")

    # 2. Use Browser Use to research specific topics (with file-based caching)
    research_topics = [
        "Brazil fiscal policy debt-to-GDP ratio 2026",
        "Brazil 2026 election polls spending ceiling",
        "Global geopolitical risks affecting emerging markets 2026"
    ]

    browser_research_data = []
    now = datetime.now()

    # Check if cache exists and is fresh
    cache_hit = False
    if os.path.exists(SENTIMENT_CACHE_FILE):
        try:
            with open(SENTIMENT_CACHE_FILE, "r") as f:
                cached_content = json.load(f)

            last_update = datetime.fromisoformat(cached_content["timestamp"])
            age_minutes = (now - last_update).total_seconds() / 60

            if age_minutes < SENTIMENT_CACHE_TTL_MINUTES:
                browser_research_data = cached_content["data"]
                cache_hit = True
                print(f"   ♻️ Browser Use: Using FILE cached research ({int(age_minutes)}m old)")
        except Exception as e:
            print(f"   ⚠️ Cache read error: {e}. Falling back to live fetch.")

    # If cache miss or stale, fetch live data
    if not cache_hit:
        print("   🌐 Browser Use: Fetching live research (expensive API calls)...")
        for topic in research_topics:
            try:
                result = await bu_client.run(
                    f"Search for recent news about: {topic}. Summarize the top 3 findings in 1-2 sentences each.",
                    model="bu-mini"  # Use mini model for cost efficiency
                )
                if result.output:
                    browser_research_data.append({
                        "source": f"Browser Research: {topic}",
                        "summary": result.output
                    })
                    print(f"   ✓ Browser: Researched '{topic[:50]}...'")
            except Exception as e:
                print(f"   ✗ Browser research error for '{topic[:30]}...': {e}")

        # Save to cache file (persist across restarts)
        try:
            with open(SENTIMENT_CACHE_FILE, "w") as f:
                json.dump({
                    "timestamp": now.isoformat(),
                    "data": browser_research_data
                }, f)
        except Exception as e:
            print(f"   ⚠️ Failed to write cache file: {e}")

    # Add browser research to news_data
    news_data.extend(browser_research_data)
    if browser_research_data:
        findings["sources"].extend(["Browser Use"] * len(browser_research_data))

    # 3. Synthesize findings using Gemini
    if news_data:
        try:
            prompt = f"""You are a political risk analyst for currency markets.

Based on the following news research about Brazil and global markets, provide a structured risk assessment:

{chr(10).join([f"- {item.get('source', 'Unknown')}: {item.get('summary', '') or ', '.join(item.get('headlines', []))}" for item in news_data])}

Analyze and score:
1. Fiscal Health (1-10): Brazil's government finances, debt trends, deficit control
2. Geopolitical Risk (1-10): Global conflicts, commodity shocks, risk-off sentiment
3. Political Stability (1-10): Election uncertainty, policy continuity, institutional strength

Then identify specific risk_flags (choose from: election_volatility, fiscal_concerns, commodity_headwind, geopolitical_risk, policy_uncertainty, debt_spiral).

Provide a 2-3 sentence summary focusing on implications for BRL/USD exchange rate.
"""

            response = gemini_client.models.generate_content(
                model="gemini-3.1-flash-lite-preview",
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=SentimentAnalysis
                )
            )

            if response and response.text:
                analysis = json.loads(response.text)
                findings.update({
                    "fiscal_health_score": analysis.get("fiscal_health_score", 5),
                    "geopolitical_risk_score": analysis.get("geopolitical_risk_score", 5),
                    "political_stability_score": analysis.get("political_stability_score", 5),
                    "summary": analysis.get("summary", "No summary available"),
                    "risk_flags": analysis.get("risk_flags", [])
                })
                print(f"   ✓ Gemini Analysis: {len(analysis.get('risk_flags', []))} risk flags identified")
                print(f"      Fiscal={analysis.get('fiscal_health_score')}/10, "
                      f"Geopolitical={analysis.get('geopolitical_risk_score')}/10, "
                      f"Political={analysis.get('political_stability_score')}/10")
            else:
                print("   ✗ Gemini: Empty response")

        except Exception as e:
            print(f"   ✗ Gemini synthesis error: {e}")
            # Fallback defaults
            findings.update({
                "fiscal_health_score": 5,
                "geopolitical_risk_score": 5,
                "political_stability_score": 5,
                "summary": "Sentiment analysis unavailable due to API error.",
                "risk_flags": ["data_unavailable"]
            })
    else:
        print("   ⚠️  No news data collected, using neutral defaults")
        findings.update({
            "fiscal_health_score": 5,
            "geopolitical_risk_score": 5,
            "political_stability_score": 5,
            "summary": "Insufficient data for sentiment analysis.",
            "risk_flags": ["insufficient_data"]
        })

    print("📰 Sentiment Researcher: Complete")

    return {"sentiment_findings": findings}


# ============================================================================
# MARKET SYNTHESIS NODE (The "Brain")
# ============================================================================

def market_synthesis_node(state: AuraState) -> Dict[str, Any]:
    """
    Role: Chief FX Strategist (LLM-powered reasoning).

    Synthesizes all research findings into a structured MarketAnalysis.
    This is the "brain" that creates the investment thesis.

    Input (from state):
        - macro_findings: Economic fundamentals (Selic, Fed, GDP, etc.)
        - commodity_findings: Commodity price trends
        - sentiment_findings: Political/fiscal/geopolitical risk scores

    Output:
        - market_analysis: MarketAnalysis TypedDict with:
            * prediction: "BULLISH" | "BEARISH" | "NEUTRAL"
            * confidence: 0.0 to 1.0
            * thesis: 2-3 sentence explanation
            * metrics: Dict of all key numbers
            * risk_flags: List of specific risks

    Returns:
        Dict with "market_analysis" and backwards-compatible "market_prediction"
    """
    print("🧠 Market Synthesis: Analyzing all research findings...")

    # Gather all findings from state
    macro = state.get("macro_findings", {})
    commodity = state.get("commodity_findings", {})
    sentiment = state.get("sentiment_findings", {})

    # Check if we have enough data
    if not macro and not commodity and not sentiment:
        print("   ⚠️  No research findings available, using neutral defaults")
        return {
            "market_analysis": {
                "prediction": "NEUTRAL",
                "confidence": 0.0,
                "thesis": "Insufficient data for market analysis.",
                "metrics": {},
                "risk_flags": ["insufficient_data"]
            },
            "market_prediction": "NEUTRAL"
        }

    # Prepare the synthesis prompt
    gemini_client = genai.Client(api_key=settings.GOOGLE_API_KEY)

    # Build a structured summary of all findings
    summary_text = "# Market Research Findings\n\n"

    # Macro findings
    if macro:
        summary_text += "## Macro-Economic Fundamentals\n"
        summary_text += f"- Selic Rate: {macro.get('selic_rate', 'N/A')}%\n"
        summary_text += f"- Fed Funds Rate: {macro.get('fed_funds_rate', 'N/A')}%\n"
        summary_text += f"- Interest Rate Differential (Selic - Fed): {macro.get('rate_differential', 'N/A')}pp\n"
        summary_text += f"- Focus IPCA 12m: {macro.get('focus_ipca_12m', 'N/A')}%\n"
        summary_text += f"- US CPI YoY: {macro.get('us_cpi_yoy', 'N/A')}%\n"
        summary_text += f"- Yield Curve (10Y-2Y): {macro.get('yield_curve_10y2y', 'N/A')}pp\n"
        summary_text += f"- Brazil GDP Growth: {macro.get('brazil_gdp_growth', 'N/A')}%\n"
        summary_text += f"- USA GDP Growth: {macro.get('usa_gdp_growth', 'N/A')}%\n\n"

    # Commodity findings
    if commodity:
        summary_text += "## Commodity Market (Brazil's Major Exports)\n"
        summary_text += f"- Overall Sentiment: {commodity.get('commodity_sentiment', 'unknown').upper()}\n"
        commodities_data = commodity.get('commodities', {})
        for name, data in commodities_data.items():
            price = data.get('current_price', 'N/A')
            change = data.get('change_30d_pct', 'N/A')
            summary_text += f"- {name.replace('_', ' ').title()}: ${price} ({change:+.2f}% 30d)\n"
        summary_text += "\n"

    # Sentiment findings
    if sentiment:
        summary_text += "## Political & Risk Analysis\n"
        summary_text += f"- Fiscal Health Score: {sentiment.get('fiscal_health_score', 'N/A')}/10\n"
        summary_text += f"- Geopolitical Risk Score: {sentiment.get('geopolitical_risk_score', 'N/A')}/10\n"
        summary_text += f"- Political Stability Score: {sentiment.get('political_stability_score', 'N/A')}/10\n"
        summary_text += f"- Risk Flags: {', '.join(sentiment.get('risk_flags', []))}\n"
        summary_text += f"- Summary: {sentiment.get('summary', 'N/A')}\n\n"

    # Create the synthesis prompt
    prompt = f"""You are the Chief FX Strategist for Revellio, analyzing the BRL/USD exchange rate.

{summary_text}

Your task: Create a comprehensive market analysis with the following structure:

1. **Prediction**: Choose ONE:
   - "BULLISH" if you believe the Brazilian Real will STRENGTHEN against the USD (BRL/USD rate goes UP)
   - "BEARISH" if you believe the Real will WEAKEN (BRL/USD rate goes DOWN)
   - "NEUTRAL" if forces are balanced or data is unclear

2. **Confidence**: A number from 0.0 to 1.0
   - 0.8-1.0: Very high confidence, multiple confirming signals
   - 0.6-0.79: Moderate confidence, some confirming signals
   - 0.4-0.59: Low confidence, mixed signals
   - 0.0-0.39: Very low confidence, contradictory data or insufficient information

3. **Thesis**: Write 2-3 sentences explaining WHY you made this prediction. Focus on:
   - The PRIMARY driver (e.g., interest rate differential, commodity strength, political risk)
   - Any OFFSETTING factors (e.g., "bullish on rates but bearish on politics")
   - The TIMESCALE (short-term volatility vs medium-term trend)

4. **Risk Flags**: Select relevant flags from this list (choose all that apply):
   - "interest_rate_squeeze": Selic-Fed differential is narrowing (bad for BRL)
   - "yield_curve_inversion": US recession risk, flight to safety
   - "commodity_headwind": Brazil's export commodities are falling
   - "commodity_tailwind": Brazil's export commodities are rising
   - "fiscal_concerns": Brazil's debt/deficit issues
   - "election_volatility": 2026 election uncertainty
   - "geopolitical_risk": Global conflicts affecting risk sentiment
   - "policy_uncertainty": Unclear central bank or government policy
   - "data_quality_low": Insufficient or contradictory data
   - "strong_fundamentals": High confidence in positive macro environment
   - "weak_fundamentals": High confidence in negative macro environment

5. **Metrics**: Extract and return the key numbers as a JSON object:
   - "selic_rate", "fed_funds_rate", "rate_differential"
   - "commodity_sentiment" (bullish/bearish/neutral)
   - "fiscal_health_score", "geopolitical_risk_score", "political_stability_score"
   - Any other relevant metrics

Remember:
- The Orchestrator will use this to make PAY vs WAIT decisions on USD bills
- A BULLISH call means "pay your USD bills NOW to lock in a strong Real"
- A BEARISH call means "WAIT, the Real will get cheaper later"
- Your confidence score affects whether the system acts on your recommendation

Be analytical, not speculative. Weight hard data (rates, yields) more heavily than soft data (news sentiment).
"""

    try:
        # Define the expected response structure
        class MarketMetrics(BaseModel):
            """Concrete metrics model (Gemini doesn't support Dict[str, Any])."""
            selic_rate: float | None = None
            fed_funds_rate: float | None = None
            rate_differential: float | None = None
            commodity_sentiment: str | None = None
            fiscal_health_score: int | None = None
            geopolitical_risk_score: int | None = None
            political_stability_score: int | None = None

        class MarketAnalysisResponse(BaseModel):
            prediction: str  # BULLISH | BEARISH | NEUTRAL
            confidence: float  # 0.0 to 1.0
            thesis: str  # 2-3 sentences
            risk_flags: list[str]  # List of risk identifiers
            metrics: MarketMetrics  # Structured metrics (not Dict to avoid additionalProperties)

        response = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite-preview",
            contents=[prompt],
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=MarketAnalysisResponse
            )
        )

        if response and response.text:
            analysis = json.loads(response.text)

            # Validate prediction
            prediction = analysis.get("prediction", "NEUTRAL").upper()
            if prediction not in ["BULLISH", "BEARISH", "NEUTRAL"]:
                print(f"   ⚠️  Invalid prediction '{prediction}', defaulting to NEUTRAL")
                prediction = "NEUTRAL"

            # Clamp confidence to [0, 1]
            confidence = max(0.0, min(1.0, float(analysis.get("confidence", 0.5))))

            market_analysis = {
                "prediction": prediction,
                "confidence": confidence,
                "thesis": analysis.get("thesis", "No thesis generated."),
                "metrics": analysis.get("metrics", {}),
                "risk_flags": analysis.get("risk_flags", [])
            }

            print(f"🧠 Market Synthesis Complete:")
            print(f"   Prediction: {prediction}")
            print(f"   Confidence: {confidence:.0%}")
            print(f"   Risk Flags: {', '.join(market_analysis['risk_flags'][:3])}...")
            print(f"   Thesis: {market_analysis['thesis'][:100]}...")

            return {
                "market_analysis": market_analysis,
                "market_prediction": prediction  # Backwards compatibility
            }

        else:
            print("   ✗ Gemini returned empty response")

    except Exception as e:
        print(f"   ✗ Gemini synthesis failed: {e}")

    # Fallback: Create a simple rule-based analysis
    print("   ⚠️  Using fallback rule-based analysis")

    # Simple rule: positive rate differential = bullish, negative = bearish
    rate_diff = macro.get("rate_differential", 0)
    commodity_sent = commodity.get("commodity_sentiment", "neutral")
    fiscal_score = sentiment.get("fiscal_health_score", 5)

    if rate_diff > 10 and commodity_sent == "bullish" and fiscal_score >= 6:
        prediction = "BULLISH"
        confidence = 0.7
        thesis = f"Strong fundamentals: Selic-Fed spread is {rate_diff:.1f}pp, commodities are rising, and fiscal health is acceptable."
        risk_flags = ["strong_fundamentals"]
    elif rate_diff < 5 or fiscal_score < 4:
        prediction = "BEARISH"
        confidence = 0.6
        thesis = f"Weak fundamentals: Interest rate advantage is eroding (spread: {rate_diff:.1f}pp) and/or fiscal concerns are mounting."
        risk_flags = ["interest_rate_squeeze", "fiscal_concerns"]
    else:
        prediction = "NEUTRAL"
        confidence = 0.5
        thesis = "Mixed signals from macro data, commodities, and political environment. No clear directional bias."
        risk_flags = ["data_quality_low"]

    market_analysis = {
        "prediction": prediction,
        "confidence": confidence,
        "thesis": thesis,
        "metrics": {
            "selic_rate": macro.get("selic_rate"),
            "fed_funds_rate": macro.get("fed_funds_rate"),
            "rate_differential": rate_diff,
            "commodity_sentiment": commodity_sent,
            "fiscal_health_score": fiscal_score
        },
        "risk_flags": risk_flags
    }

    print(f"🧠 Fallback Analysis: {prediction} (confidence: {confidence:.0%})")

    return {
        "market_analysis": market_analysis,
        "market_prediction": prediction
    }
