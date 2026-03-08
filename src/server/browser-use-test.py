import asyncio
import os
from browser_use import Agent, Browser, BrowserProfile
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr


class _BoundToolsProxy:
    """Wraps bind_tools result so browser-use's internal setattr doesn't hit a Pydantic model."""
    def __init__(self, bound):
        self._bound = bound

    async def ainvoke(self, *args, **kwargs):
        return await self._bound.ainvoke(*args, **kwargs)

    def invoke(self, *args, **kwargs):
        return self._bound.invoke(*args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._bound, name)


class GeminiProviderProxy:
    def __init__(self, llm):
        self.llm = llm
        self.provider = "google"

    @property
    def model_name(self):
        return getattr(self.llm, "model", "gemini-2.0-flash")

    def bind_tools(self, *args, **kwargs):
        # ✅ Wrap result — prevents browser-use's setattr from crashing on Pydantic model
        return _BoundToolsProxy(self.llm.bind_tools(*args, **kwargs))

    def __getattr__(self, name):
        return getattr(self.llm, name)

    async def ainvoke(self, *args, **kwargs):
        return await self.llm.ainvoke(*args, **kwargs)

    def invoke(self, *args, **kwargs):
        return self.llm.invoke(*args, **kwargs)


async def main():
    raw_llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        api_key=SecretStr(os.getenv("GOOGLE_API_KEY"))
    )
    llm = GeminiProviderProxy(raw_llm)

    profile = BrowserProfile(
        headless=True,
        extra_chromium_args=[
            "--disable-http2",
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox"
        ]
    )
    browser = Browser(browser_profile=profile)

    agent = Agent(
        task="Navigate to https://www.basketball-reference.com/leagues/NBA_2026_standings.html. Wait 5 seconds for the table to load, then tell me which team has the highest 'W/L%' in the 'League Standings' table.",
        llm=llm,
        browser=browser,
        use_vision=True
    )

    result = await agent.run()
    # ✅ No browser.close() — removed in 0.12.x, agent handles its own cleanup
    print(f"\nFinal Result: {result.final_result()}")


if __name__ == "__main__":
    asyncio.run(main())
