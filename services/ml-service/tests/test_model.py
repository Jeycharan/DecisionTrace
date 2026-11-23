"""
Unit and Integration Tests for ML Service and SHAP Attributions
"""
import pytest
from app.schemas import LoanFeaturesInput
from app.model import CreditRiskModelService

@pytest.fixture
def service():
    return CreditRiskModelService()

def test_model_training_and_metrics(service):
    metrics = service.bundle["metrics"]
    assert metrics["modelId"] == "credit-risk-demo"
    assert metrics["modelVersion"] == "model_v1"
    assert "roc_auc" in metrics["metrics"]
    assert metrics["metrics"]["roc_auc"] > 0.60
    assert len(metrics["features"]) == 5

def test_score_produces_valid_probabilities(service):
    inp = LoanFeaturesInput(
        requestedAmount=500000,
        monthlyIncome=45000,
        existingLoanAmount=200000,
        accountAgeMonths=8,
        creditBureauScore=680,
    )
    res = service.score_and_explain(inp)
    assert 0.0 <= res.probabilityOfDefault <= 1.0
    assert 0 <= res.riskScore <= 100
    assert res.recommendedOutcome in ["APPROVED", "MANUAL_REVIEW", "REJECTED"]
    assert "synthetic" in res.datasetDisclosure.lower()

def test_shap_feature_attributions(service):
    inp = LoanFeaturesInput(
        requestedAmount=500000,
        monthlyIncome=45000,
        existingLoanAmount=200000,
        accountAgeMonths=8,
        creditBureauScore=680,
    )
    res = service.score_and_explain(inp)
    assert len(res.featureContributions) == 5
    
    # Check that contributions have direction and values
    for item in res.featureContributions:
        assert item.direction in ["increases_risk", "reduces_risk"]
        assert isinstance(item.shap_value, float)
        assert item.impact_percentage >= 0

def test_counterfactual_recommendation_present(service):
    # High risk case
    inp = LoanFeaturesInput(
        requestedAmount=800000,
        monthlyIncome=30000,
        existingLoanAmount=300000,
        accountAgeMonths=4,
        creditBureauScore=580,
    )
    res = service.score_and_explain(inp)
    assert len(res.counterfactualRecommendation) > 0
    assert "counterfactual" in res.counterfactualRecommendation.lower()
