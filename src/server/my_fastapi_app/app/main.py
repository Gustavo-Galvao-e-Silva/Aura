from dotenv import load_dotenv
load_dotenv()

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agents.aura_graph import aura_graph
from db.models import Base
from my_fastapi_app.app.settings import settings
from my_fastapi_app.app.db.session import engine
from my_fastapi_app.app.state import current_state, update_state

# Import all route modules
from my_fastapi_app.app.routes import agents, blockchain, expenses, fx_routes, users


async def monitor_market_loop():
    """Background heartbeat for AI agent system"""
    while True:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] Aura heartbeat: Updating market and routes...")

        result = await aura_graph.ainvoke(current_state)
        update_state(result)

        await asyncio.sleep(settings.MARKET_MONITOR_INTERVAL_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern FastAPI lifespan context manager (replaces deprecated on_event)"""
    # Startup
    print("🚀 Revellio Backend: Startup event triggered")

    print("🚀 Revellio Backend: Initializing database...")
    Base.metadata.create_all(bind=engine)

    print("🚀 Revellio Backend: Starting market monitor background task...")
    task = asyncio.create_task(monitor_market_loop())
    print("🚀 Revellio Backend: Startup complete!")

    yield  # Application runs here

    # Shutdown
    print("👋 Revellio Backend: Shutting down...")
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Revellio API",
    description="AI-powered global finance co-pilot for international students. Manage expenses, optimize FX rates, and make intelligent payment decisions.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "ok", "service": "revellio-backend"}

# Register all route modules
app.include_router(users.router)
app.include_router(expenses.router)
app.include_router(fx_routes.router)
app.include_router(blockchain.router)
app.include_router(agents.router)
