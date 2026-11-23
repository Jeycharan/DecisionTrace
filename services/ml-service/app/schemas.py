from pydantic import BaseModel, Field
from typing import List, Optional

class LoanFeaturesInput(BaseModel):
    requestedAmount: float = Field(..., gt=0, description="Requested loan amount in INR")
    monthlyIncome: float = Field(..., gt=0, description="Monthly gross income in INR")
    existingLoanAmount: float = Field(0.0, ge=0, description="Outstanding loan balance in INR")
    accountAgeMonths: int = Field(..., ge=0, description="Bank account age in months")
    creditBureauScore: Optional[int] = Field(680, ge=300, le=900, description="Credit Bureau score")

class SHAPFeatureContribution(BaseModel):
    feature: str
    feature_label: str
    feature_value: float
    shap_value: float
    direction: str  # "increases_risk" | "reduces_risk"
    impact_percentage: float

class ModelScoreResponse(BaseModel):
    modelId: str
    modelVersion: str
    probabilityOfDefault: float
    riskScore: int  # 0 to 100
    recommendedOutcome: str  # "APPROVED" | "MANUAL_REVIEW" | "REJECTED"
    baseValue: float
    featureContributions: List[SHAPFeatureContribution]
    counterfactualRecommendation: str
    datasetDisclosure: str
