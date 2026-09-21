from fastapi import FastAPI

app = FastAPI(
    title="VehicleVision",
    description="Local vehicle image intelligence and processing system",
    version="1.0.0"
)


@app.get("/")
def root():
    return {
        "message": "VehicleVision is running"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }