"""
Synthetic Training Pipeline for Credit Risk Model v1
Generates synthetic financial data, fits a reproducible Logistic Regression
baseline, evaluates test performance, and computes SHAP explanations.
"""
import os
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import roc_auc_score, accuracy_score, precision_score, recall_score, f1_score

ARTIFACT_DIR = os.path.join(os.path.dirname(__file__), "..", "model_artifacts")
MODEL_PATH = os.path.join(ARTIFACT_DIR, "credit_risk_v1.joblib")
METRICS_PATH = os.path.join(ARTIFACT_DIR, "metrics_v1.json")

FEATURE_NAMES = [
    "monthly_income",
    "debt_to_income_ratio",
    "requested_to_income_ratio",
    "account_age_months",
    "bureau_score",
]

def generate_synthetic_data(n_samples: int = 2500, seed: int = 42) -> pd.DataFrame:
    """Generate synthetic financial applicant data."""
    np.random.seed(seed)
    
    # 1. Monthly income in INR (log-normal, median ~ 45,000)
    monthly_income = np.random.lognormal(mean=10.7, sigma=0.55, size=n_samples).clip(15000, 300000)
    
    # 2. Existing debt-to-income (annual)
    dti = np.random.beta(a=2, b=5, size=n_samples) * 0.9  # 0 to 0.8
    existing_loan = dti * (monthly_income * 12)
    
    # 3. Requested loan amount
    req_ratio = np.random.uniform(2.0, 16.0, size=n_samples)
    requested_amount = monthly_income * req_ratio
    
    # 4. Bank account age in months
    account_age = np.random.exponential(scale=24, size=n_samples).clip(1, 120).astype(int)
    
    # 5. Bureau score (300 to 900)
    bureau_score = np.random.normal(loc=710, scale=65, size=n_samples).clip(300, 900).astype(int)
    
    # Latent logit for default risk
    # Higher DTI, higher requested ratio -> higher risk
    # Higher income, higher account tenure, higher bureau score -> lower risk
    z = (
        -2.2
        + 2.8 * dti
        + 0.18 * req_ratio
        - 0.000008 * (monthly_income - 45000)
        - 0.025 * (account_age - 12)
        - 0.008 * (bureau_score - 650)
    )
    
    prob_default = 1 / (1 + np.exp(-z))
    default_label = (np.random.uniform(0, 1, size=n_samples) < prob_default).astype(int)
    
    df = pd.DataFrame({
        "monthly_income": monthly_income,
        "debt_to_income_ratio": dti,
        "requested_to_income_ratio": req_ratio,
        "account_age_months": account_age,
        "bureau_score": bureau_score,
        "default": default_label,
    })
    
    return df

def train_and_export():
    """Train the model, evaluate metrics, and export artifacts."""
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    df = generate_synthetic_data(n_samples=3000, seed=42)
    
    X = df[FEATURE_NAMES]
    y = df["default"]
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    model = LogisticRegression(C=1.0, random_state=42, max_iter=500)
    model.fit(X_train_scaled, y_train)
    
    y_pred = model.predict(X_test_scaled)
    y_pred_proba = model.predict_proba(X_test_scaled)[:, 1]
    
    metrics = {
        "modelId": "credit-risk-demo",
        "modelVersion": "model_v1",
        "algorithm": "StandardScaler + LogisticRegression",
        "dataset": "Synthetic financial loan applicants (N=3000)",
        "features": FEATURE_NAMES,
        "testSplit": 0.25,
        "metrics": {
            "roc_auc": round(float(roc_auc_score(y_test, y_pred_proba)), 4),
            "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
            "precision": round(float(precision_score(y_test, y_pred)), 4),
            "recall": round(float(recall_score(y_test, y_pred)), 4),
            "f1": round(float(f1_score(y_test, y_pred)), 4),
        },
        "intercept": float(model.intercept_[0]),
        "coefficients": {feat: float(coef) for feat, coef in zip(FEATURE_NAMES, model.coef_[0])},
        "disclaimer": "This model was trained on synthetic data for demonstration purposes only. It does not establish predictive accuracy on real bank portfolios."
    }
    
    # Save model pipeline bundle
    bundle = {
        "scaler": scaler,
        "model": model,
        "feature_names": FEATURE_NAMES,
        "metrics": metrics,
    }
    
    joblib.dump(bundle, MODEL_PATH)
    
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)
        
    print(f"Model artifact saved to {MODEL_PATH}")
    print(f"Evaluation metrics: ROC-AUC={metrics['metrics']['roc_auc']}, F1={metrics['metrics']['f1']}")
    return bundle

if __name__ == "__main__":
    train_and_export()
