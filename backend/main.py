import os

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from routers import chat, upload

load_dotenv()

app = FastAPI(title="DataViz Pro API", version="2.0.0")


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    # Spec contract: every error response is {"error": ..., "detail": ...}
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        payload = exc.detail
    else:
        payload = {"error": "Request failed", "detail": str(exc.detail)}
    return JSONResponse(status_code=exc.status_code, content=payload)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])


@app.get("/")
def root():
    return {"message": "DataViz Pro API", "version": "2.0.0"}


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0.0"}
