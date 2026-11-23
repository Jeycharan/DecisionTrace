"""
FastAPI Microservice for DecisionTrace Credit Risk Scoring & SHAP Attribution
Port configurable via ML_SERVICE_PORT (default: 8000)
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .schemas import LoanFeaturesInput, ModelScoreResponse
from .model import model_service

app = FastAPI(
    title="DecisionTrace ML Scoring Service",
    description="Credit risk scoring baseline with exact SHAP feature attributions and counterfactual analysis.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "decisiontrace-ml-service",
        "modelId": model_service.bundle["metrics"]["modelId"],
        "modelVersion": model_service.bundle["metrics"]["modelVersion"],
    }

@app.get("/model/metadata")
def get_model_metadata():
    return model_service.bundle["metrics"]

@app.post("/score", response_model=ModelScoreResponse)
def score_application(payload: LoanFeaturesInput):
    return model_service.score_and_explain(payload)
