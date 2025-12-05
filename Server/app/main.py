"""Main FastAPI application entry point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="UITrace Platform API",
    description="RESTful API for UITrace UI automation testing platform",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:1420", "app://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "uitrace-api"}


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "UITrace Platform API", "version": "1.0.0"}
