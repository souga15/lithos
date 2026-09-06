from __future__ import annotations

from fastapi import FastAPI

from src.api.schemas import PredictionRequest
from src.models.hybrid_model import prediction_to_dict, predict_hybrid_trained

app = FastAPI(title="Real Seismic Landslide Model", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "project": "real_seismic_landslide_model"}


@app.post("/predict")
def predict(payload: PredictionRequest) -> dict[str, float | str]:
    return prediction_to_dict(predict_hybrid_trained(payload.model_dump()))
