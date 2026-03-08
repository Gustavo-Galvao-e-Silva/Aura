import asyncio
import os
from browser_use import Agent, Browser, BrowserProfile
from langchain_google_genai import ChatGoogleGenerativeAI
from pydantic import SecretStr


class GeminiProviderProxy:
    """
    Wraps ChatGoogleGenerativeAI to satisfy browser-use's attribute checks.
    - Proxy is a plain Python class → browser-use can setattr (e.g. ainvoke) freely
    - bind_tools() returns the NATIVE LangChain object (no re-wrap) → tool calls work
    - provider + model_name are exposed for Agent.__init__ and cloud_events checks
    """
    def __init__(self, llm):
        self.llm = llm
        self.provider = "google"

    @property
    def model_name(self):
        return getattr(self.llm, "model", "gemini-2.0-flash")

    def bind_tools(self, *args, **kwargs):
        # DO NOT re-wrap — return native LangChain runnable to preserve tool-call chain
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

    profile = BrowserProfile(
        headless=True,
        extra_chromium_args=[
            "--disable-http2",
            "--disable-blink-features=AutomationControlled"
        ]
    )
    browser = Browser(browser_profile=profile)

    agent = Agent(
        task="Go to basketball-reference.com/leagues/NBA_2026_standings.html and find the team with the best win percentage.",
        llm=llm,
        browser=browser
    )

    result = await agent.run()
    print(f"\nFinal Result: {result.final_result()}")


if __name__ == "__main__":
    asyncio.run(main())
