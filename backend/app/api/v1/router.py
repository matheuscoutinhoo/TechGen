"""Router agregador da API v1."""
from fastapi import APIRouter

from app.api.v1 import auth, learning_trails, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(learning_trails.router)
