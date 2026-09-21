from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.routes.upload import router as upload_router


app = FastAPI(
    title="VehicleVision",
    description="Local vehicle image intelligence and processing system",
    version="1.0.0"
)


app.include_router(upload_router, prefix="/api")


@app.get("/api/health")
def health():
    return {
        "status": "healthy"
    }


app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")