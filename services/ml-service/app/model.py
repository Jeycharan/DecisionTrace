"""
Model Inference & SHAP Feature Contribution Service
"""
import os
import joblib
import numpy as np
import shap
from .schemas import LoanFeaturesInput, ModelScoreResponse, SHAPFeatureContribution
from .train import train_and_export, MODEL_PATH, FEATURE_NAMES

LABEL_MAP = {
    "monthly_income": "Monthly Income",
    "debt_to_income_ratio": "Debt-to-Income (DTI)",
    "requested_to_income_ratio": "Requested Amount / Income",
    "account_age_months": "Account Tenure (Months)",
    "bureau_score": "Credit Bureau Score",
}

class CreditRiskModelService:
    def __init__(self):
        self.bundle = None
        self.explainer = None
        self._load_or_train()

    def _load_or_train(self):
        if not os.path.exists(MODEL_PATH):
            print("Model artifact not found. Training model_v1...")
            self.bundle = train_and_export()
        else:
            self.bundle = joblib.load(MODEL_PATH)
            
        model = self.bundle["model"]
        scaler = self.bundle["scaler"]
        
        # LinearExplainer for logistic regression
        # Baseline reference: zeros in scaled space (the mean of each feature)
        masker = np.zeros((1, len(FEATURE_NAMES)))
        self.explainer = shap.LinearExplainer(model, masker=masker)

    def extract_features(self, inp: LoanFeaturesInput) -> np.ndarray:
        monthly_income = inp.monthlyIncome
        annual_income = monthly_income * 12.0
        dti = inp.existingLoanAmount / annual_income if annual_income > 0 else 0.0
        req_ratio = inp.requestedAmount / monthly_income if monthly_income > 0 else 0.0
        account_age = float(inp.accountAgeMonths)
        bureau_score = float(inp.creditBureauScore or 680)

        return np.array([[
            monthly_income,
            dti,
            req_ratio,
            account_age,
            bureau_score,
        ]])

    def score_and_explain(self, inp: LoanFeaturesInput) -> ModelScoreResponse:
        raw_feats = self.extract_features(inp)
        scaler = self.bundle["scaler"]
        model = self.bundle["model"]
        metrics = self.bundle["metrics"]

        scaled_feats = scaler.transform(raw_feats)
        prob_default = float(model.predict_proba(scaled_feats)[0, 1])
        risk_score = int(round(prob_default * 100))

        # Decision threshold mapping
        if risk_score >= 80:
            recommended_outcome = "REJECTED"
        elif risk_score >= 60:
            recommended_outcome = "MANUAL_REVIEW"
        else:
            recommended_outcome = "APPROVED"

        # Calculate SHAP values
        shap_values = self.explainer(scaled_feats)
        base_value = float(shap_values.base_values[0])
        shap_vals_arr = shap_values.values[0]

        contributions = []
        total_abs_shap = sum(abs(v) for v in shap_vals_arr) or 1.0

        for i, feat_name in enumerate(FEATURE_NAMES):
            val = float(raw_feats[0, i])
            s_val = float(shap_vals_arr[i])
            direction = "increases_risk" if s_val > 0 else "reduces_risk"
            impact_pct = round((abs(s_val) / total_abs_shap) * 100, 1)

            contributions.append(SHAPFeatureContribution(
                feature=feat_name,
                feature_label=LABEL_MAP.get(feat_name, feat_name),
                feature_value=round(val, 2),
                shap_value=round(s_val, 4),
                direction=direction,
                impact_percentage=impact_pct,
            ))

        # Sort contributions by absolute impact descending
        contributions.sort(key=lambda x: abs(x.shap_value), reverse=True)

        # Counterfactual analysis
        counterfactual = self._generate_counterfactual(inp, risk_score)

        return ModelScoreResponse(
            modelId=metrics["modelId"],
            modelVersion=metrics["modelVersion"],
            probabilityOfDefault=round(prob_default, 4),
            riskScore=risk_score,
            recommendedOutcome=recommended_outcome,
            baseValue=round(base_value, 4),
            featureContributions=contributions,
            counterfactualRecommendation=counterfactual,
            datasetDisclosure="Model trained on 3,000 synthetic financial applicants. Designed strictly for prototype explanation; not real-bank credit underwriting."
        )

    def _generate_counterfactual(self, inp: LoanFeaturesInput, current_risk: int) -> str:
        if current_risk < 60:
            return "Application qualifies for automated approval under baseline credit thresholds."

        # Test reducing requested amount
        for reduction_pct in [15, 25, 35, 50]:
            reduced_amount = inp.requestedAmount * (1 - reduction_pct / 100.0)
            candidate = LoanFeaturesInput(
                requestedAmount=reduced_amount,
                monthlyIncome=inp.monthlyIncome,
                existingLoanAmount=inp.existingLoanAmount,
                accountAgeMonths=inp.accountAgeMonths,
                creditBureauScore=inp.creditBureauScore,
            )
            raw = self.extract_features(candidate)
            scaled = self.bundle["scaler"].transform(raw)
            p = float(self.bundle["model"].predict_proba(scaled)[0, 1])
            new_score = int(round(p * 100))

            if new_score < 60:
                return f"Counterfactual: Reducing requested amount by {reduction_pct}% (from INR {inp.requestedAmount:,.0f} to INR {reduced_amount:,.0f}) lowers risk score from {current_risk} to {new_score}, moving decision to APPROVED."

        return "Counterfactual: High existing debt-to-income and short account history remain primary risk drivers; restructuring existing debt obligations is recommended."

model_service = CreditRiskModelService()
