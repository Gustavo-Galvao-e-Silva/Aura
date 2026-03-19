from dotenv import load_dotenv
load_dotenv()

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agents.aura_graph import aura_graph
from db.models import Base
from my_fastapi_app.app.db.session import engine
from my_fastapi_app.app.state import current_state, update_state

# Import all route modules
from my_fastapi_app.app.routes import agents, blockchain, expenses, fx_routes, users


app = FastAPI(
    title="Revellio API",
    description="AI-powered global finance co-pilot for international students. Manage expenses, optimize FX rates, and make intelligent payment decisions.",
    version="1.0.0",
)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all route modules
app.include_router(users.router)
app.include_router(expenses.router)
app.include_router(fx_routes.router)
app.include_router(blockchain.router)
app.include_router(agents.router)


async def monitor_market_loop():
    """Background heartbeat for AI agent system"""
    while True:
        print("Aura heartbeat: Updating market and routes...")

        result = await aura_graph.ainvoke(current_state)
        update_state(result)

        await asyncio.sleep(60)  # Run every 60 seconds


@app.on_event("startup")
async def startup_event():
    """Initialize database and start background tasks"""
    Base.metadata.create_all(bind=engine)
    asyncio.create_task(monitor_market_loop())
