import asyncio
import os
from browser_use import Agent, Browser, BrowserProfile
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr

# Keep your GeminiProviderProxy exactly as it is - it's working perfectly now!
class GeminiProviderProxy:
    def __init__(self, llm):
        self.llm = llm
        self.provider = "google"
    @property
    def model_name(self):
        return getattr(self.llm, "model", "gemini-2.0-flash")
    def bind_tools(self, *args, **kwargs):
        return self.llm.bind_tools(*args, **kwargs)
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

    # Simplified profile for better compatibility
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
        task=(
            "1. Navigate to https://www.basketball-reference.com/leagues/NBA_2026_standings.html\n"
            "2. Stop waiting for ads and immediately look for the 'League Standings' table.\n"
            "3. Identify the team with the highest W/L%."
        ),
        llm=llm,
        browser=browser,
        use_vision=True
    )

    try:
        # We wrap the run in a way that doesn't crash if the browser is already closed
        history = await agent.run()
        print(f"\nFinal Result: {history.final_result()}")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        # In v0.12.1, Browser doesn't always have .close(). 
        # Use this check to prevent the AttributeError at the end.
        if hasattr(browser, 'close'):
            await browser.close()
        elif hasattr(browser, 'reset'):
            await browser.reset(force=True)

if __name__ == "__main__":
    asyncio.run(main())
