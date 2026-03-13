from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.boards.router import router as boards_router
from app.modules.elements.router import router as elements_router
from app.modules.users.router import router as users_router
from app.modules.workspaces.router import router as workspaces_router
from app.websocket.router import router as ws_router

api_router = APIRouter(prefix="/api")
api_router.include_router(auth_router)
api_router.include_router(users_router)
api_router.include_router(workspaces_router)
api_router.include_router(boards_router)
api_router.include_router(elements_router)
api_router.include_router(ws_router)
