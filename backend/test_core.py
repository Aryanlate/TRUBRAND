import os
import sys
import pytest

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from rules_engine import contrast_ratio, run_rules
from review import score, review
import review as review_module


def test_contrast_ratio():
    # contrast_ratio of #000000 vs #FFFFFF is about 21
    cr_bw = contrast_ratio("#000000", "#FFFFFF")
    assert round(cr_bw) == 21
    assert abs(cr_bw - 21.0) < 0.1

    # #9E9E9E vs #FFFFFF is below 4.5
    cr_gray = contrast_ratio("#9E9E9E", "#FFFFFF")
    assert cr_gray < 4.5


def test_banned_term():
    # banned term "cheapest" produces an R-4.2 Blocker
    kb = {
        "terms": [
            {
                "type": "banned",
                "term": "cheapest",
                "rule_id": "R-4.2",
                "severity": "Blocker",
                "note": "Superlative claims without proof are banned."
            }
        ]
    }
    findings = run_rules("We have the cheapest coffee around.", kb, {})
    matches = [f for f in findings if f["rule_id"] == "R-4.2" and f["severity"] == "Blocker"]
    assert len(matches) == 1
    assert matches[0]["quote"].lower() == "cheapest"


def test_claims_expired_and_valid():
    # an expired claim produces a Blocker and a valid one does not
    kb = {
        "claims": [
            {
                "id": "CLM-EXPIRED",
                "phrase": "100% organic beans",
                "evidence": "Cert #123",
                "expires_on": "2020-01-01"
            },
            {
                "id": "CLM-VALID",
                "phrase": "Single-origin roast",
                "evidence": "Audit 2025",
                "expires_on": "2099-12-31"
            }
        ]
    }
    text = "We use 100% organic beans and single-origin roast in every cup."
    findings = run_rules(text, kb, {})

    expired_findings = [f for f in findings if f["rule_id"] == "CLM-EXPIRED"]
    valid_findings = [f for f in findings if f["rule_id"] == "CLM-VALID"]

    assert len(expired_findings) == 1
    assert expired_findings[0]["severity"] == "Blocker"
    assert len(valid_findings) == 0


def test_brand_name_variants():
    # brand name variants "Greenbrew" and "Green Brew" are flagged and "GreenBrew" is not
    kb = {
        "terms": [
            {
                "type": "brand_name",
                "term": "GreenBrew",
                "rule_id": "R-1.1"
            }
        ]
    }

    # "Greenbrew" should be flagged
    findings_lower = run_rules("Try Greenbrew today.", kb, {})
    assert any(f["rule_id"] == "R-1.1" and f["quote"] == "Greenbrew" for f in findings_lower)

    # "Green Brew" should be flagged
    findings_spaced = run_rules("Try Green Brew today.", kb, {})
    assert any(f["rule_id"] == "R-1.1" and f["quote"] == "Green Brew" for f in findings_spaced)

    # "GreenBrew" should NOT be flagged
    findings_exact = run_rules("Try GreenBrew today.", kb, {})
    assert not any(f["rule_id"] == "R-1.1" for f in findings_exact)


def test_score_calculation():
    # score() deducts correctly and sets approvable=false with an open Blocker
    clean_score = score([])
    assert clean_score["overall"] == 100
    assert clean_score["approvable"] is True

    blocker = {
        "category": "claims",
        "severity": "Blocker",
        "status": "open"
    }
    blocked_score = score([blocker])
    # Blocker deducts 25 from claims category (weight 25, claims category becomes 75)
    assert blocked_score["categories"]["claims"] == 75
    assert blocked_score["overall"] < 100
    assert blocked_score["approvable"] is False


def test_review_discards_invalid_ai_findings(monkeypatch):
    # review() discards an AI finding that cites a non-existent rule_id or a quote not present in the text
    kb = {
        "rules": [
            {"id": "R-TONE-1", "category": "tone", "title": "Tone Rule", "text": "Be polite."}
        ],
        "facts": [],
        "claims": [],
        "terms": []
    }
    text = "We craft fresh coffee every morning."

    mock_data = {
        "findings": [
            # Valid: cites existing rule and exact quote in text
            {
                "category": "tone",
                "severity": "Warning",
                "quote": "fresh coffee",
                "rule_id": "R-TONE-1",
                "explanation": "Valid finding",
                "confidence": 0.85,
                "suggestion": "our roasted coffee"
            },
            # Invalid 1: non-existent rule_id
            {
                "category": "tone",
                "severity": "Warning",
                "quote": "fresh coffee",
                "rule_id": "NON_EXISTENT_RULE_999",
                "explanation": "Should be discarded due to rule_id",
                "confidence": 0.85
            },
            # Invalid 2: quote not in text
            {
                "category": "tone",
                "severity": "Warning",
                "quote": "nonexistent text snippet",
                "rule_id": "R-TONE-1",
                "explanation": "Should be discarded due to missing quote",
                "confidence": 0.85
            }
        ]
    }

    def mock_chat_json(system, user, preferred=None):
        return mock_data, "mock-llm-provider"

    monkeypatch.setattr(review_module, "chat_json", mock_chat_json)

    res = review(text, kb)
    ai_findings = [f for f in res["findings"] if f.get("source_type") == "ai-assisted"]

    assert len(ai_findings) == 1
    assert ai_findings[0]["rule_id"] == "R-TONE-1"
    assert ai_findings[0]["quote"] == "fresh coffee"
