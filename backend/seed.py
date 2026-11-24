import os
import json
import uuid
from datetime import datetime, timedelta
import db
from auth import hash_password

def seed_demo_history():
    finding_count = db.query("SELECT COUNT(*) as c FROM findings")[0]["c"]
    if finding_count > 0:
        return

    # Look up demo users
    user_rows = db.query("SELECT id, email, role FROM users")
    user_map = {u["email"]: u["id"] for u in user_rows}
    creator_id = user_map.get("creator@demo.com") or str(uuid.uuid4())
    reviewer_id = user_map.get("reviewer@demo.com") or str(uuid.uuid4())
    manager_id = user_map.get("manager@demo.com") or str(uuid.uuid4())

    now = datetime.now()

    # Define 6 demo content items with varied states
    content_configs = [
        {
            "id": "demo-cnt-01",
            "creator_id": creator_id,
            "title": "Summer Cold Brew Launch Campaign",
            "channel": "Social",
            "state": "Draft",
            "days_ago": 13,
            "versions": [
                {
                    "number": 1,
                    "days_ago": 13,
                    "body": "Beat the heat with our artisan cold brew. Hand-crafted daily using single-origin beans.",
                    "score": {"overall": 78, "categories": {"tone": 80, "claims": 75, "terminology": 75, "accessibility": 80, "visual": 80}, "approvable": False},
                }
            ],
        },
        {
            "id": "demo-cnt-02",
            "creator_id": creator_id,
            "title": "Autumn Blend Retail Brochure",
            "channel": "Brochure",
            "state": "Reviewed",
            "days_ago": 10,
            "versions": [
                {
                    "number": 1,
                    "days_ago": 10,
                    "body": "Discover the warm notes of caramel and spice in our signature Autumn blend roast.",
                    "score": {"overall": 85, "categories": {"tone": 88, "claims": 80, "terminology": 85, "accessibility": 85, "visual": 85}, "approvable": True},
                }
            ],
        },
        {
            "id": "demo-cnt-03",
            "creator_id": creator_id,
            "title": "Fair Trade Direct Farmer Partnerships",
            "channel": "Web",
            "state": "InReview",
            "days_ago": 6,
            "versions": [
                {
                    "number": 1,
                    "days_ago": 6,
                    "body": "We partner directly with smallholder farming cooperatives to ensure sustainable ethical agriculture.",
                    "score": {"overall": 82, "categories": {"tone": 85, "claims": 80, "terminology": 80, "accessibility": 80, "visual": 85}, "approvable": True},
                }
            ],
        },
        {
            "id": "demo-cnt-04",
            "creator_id": creator_id,
            "title": "100% Recyclable Packaging Commitment",
            "channel": "Web",
            "state": "Approved",
            "days_ago": 8,
            "versions": [
                {
                    "number": 1,
                    "days_ago": 8,
                    "body": "Our packaging is crafted from biodegradable plant fibers designed for zero environmental footprint.",
                    "score": {"overall": 74, "categories": {"tone": 75, "claims": 70, "terminology": 75, "accessibility": 75, "visual": 75}, "approvable": False},
                },
                {
                    "number": 2,
                    "days_ago": 4,
                    "body": "Our certified eco packaging is crafted from recyclable materials with minimal ecological footprint.",
                    "score": {"overall": 92, "categories": {"tone": 95, "claims": 90, "terminology": 92, "accessibility": 90, "visual": 95}, "approvable": True},
                }
            ],
            "approval": {
                "reviewer_id": manager_id,
                "decision": "approve",
                "reason": "Approved with manager override for packaging transition window.",
                "override": "Executive override approved for packaging launch window",
                "days_ago": 4,
            }
        },
        {
            "id": "demo-cnt-05",
            "creator_id": manager_id,
            "title": "Artisan Roasting Experience Newsletter",
            "channel": "Email",
            "state": "Approved",
            "days_ago": 12,
            "versions": [
                {
                    "number": 1,
                    "days_ago": 12,
                    "body": "Welcome to our coffee workshop. Learn how slow batch roasting unlocks delicate chocolate notes.",
                    "score": {"overall": 79, "categories": {"tone": 80, "claims": 80, "terminology": 75, "accessibility": 80, "visual": 80}, "approvable": False},
                },
                {
                    "number": 2,
                    "days_ago": 2,
                    "body": "Welcome to our coffee masterclass. Learn how artisanal roasting unlocks natural flavor clarity.",
                    "score": {"overall": 96, "categories": {"tone": 98, "claims": 95, "terminology": 95, "accessibility": 95, "visual": 98}, "approvable": True},
                }
            ],
            "approval": {
                "reviewer_id": reviewer_id,
                "decision": "approve",
                "reason": "Approved with secondary visual waiver.",
                "override": "Brand director override for seasonal visual styling",
                "days_ago": 2,
            }
        },
        {
            "id": "demo-cnt-06",
            "creator_id": creator_id,
            "title": "Seasonal Promo Flash Sale Copy",
            "channel": "Social",
            "state": "ChangesRequested",
            "days_ago": 3,
            "versions": [
                {
                    "number": 1,
                    "days_ago": 3,
                    "body": "Order the cheapest whole bean espresso today with guaranteed instant shipping discounts.",
                    "score": {"overall": 68, "categories": {"tone": 70, "claims": 60, "terminology": 65, "accessibility": 70, "visual": 75}, "approvable": False},
                }
            ],
            "approval": {
                "reviewer_id": reviewer_id,
                "decision": "request_changes",
                "reason": "Contains banned superlative pricing claim ('cheapest'). Revise and resubmit.",
                "override": None,
                "days_ago": 1,
            }
        },
    ]

    # Insert content, versions, and approvals
    for c in content_configs:
        c_time = (now - timedelta(days=c["days_ago"])).isoformat()
        db.execute(
            "INSERT INTO content (id, creator_id, title, channel, state, current_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (c["id"], c["creator_id"], c["title"], c["channel"], c["state"], len(c["versions"]), c_time)
        )

        for v in c["versions"]:
            v_id = str(uuid.uuid4())
            v_time = (now - timedelta(days=v["days_ago"])).isoformat()
            db.execute(
                "INSERT INTO versions (id, content_id, number, body, meta, score, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (v_id, c["id"], v["number"], v["body"], json.dumps({"has_image": False}), json.dumps(v["score"]), c["creator_id"], v_time)
            )

        if "approval" in c:
            ap = c["approval"]
            ap_time = (now - timedelta(days=ap["days_ago"])).isoformat()
            db.execute(
                "INSERT INTO approvals (id, content_id, reviewer_id, decision, reason, override, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), c["id"], ap["reviewer_id"], ap["decision"], ap["reason"], ap["override"], ap_time)
            )

        # Mark audit row
        db.execute(
            "INSERT INTO audit (id, actor, action, object, detail, services, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "system", "demo seed", f"content:{c['id']}", f"Seeded demo content '{c['title']}'", "demo seed", c_time)
        )

    # Distribute 41 findings across rules:
    # R-2.3: 10 findings (6 dismissed -> 60% dismissal rate >= 40%, total >= 5 -> GAP RULE)
    # R-4.1: 8 findings (4 dismissed -> 50% dismissal rate >= 40%, total >= 5 -> GAP RULE)
    # R-4.2: 10 findings (2 dismissed -> 20% dismissal rate)
    # R-6.1: 7 findings (1 dismissed -> 14% dismissal rate)
    # A11Y-1: 6 findings (0 dismissed -> 0% dismissal rate)
    findings_plan = [
        # rule_id, count, dismissed_count, category, severity, quote, explanation
        ("R-2.3", 10, 6, "tone", "Warning", "overly technical phrasing", "Tone is too dense; simplify for consumer copy."),
        ("R-4.1", 8, 4, "claims", "Blocker", "unverified organic health claim", "Health benefit claims require verified laboratory evidence."),
        ("R-4.2", 10, 2, "terminology", "Blocker", "cheapest pricing claim", "Banned superlative claim 'cheapest' violates brand guidelines."),
        ("R-6.1", 7, 1, "visual", "Warning", "unapproved logo background", "Logo background colour is not in the approved brand palette."),
        ("A11Y-1", 6, 0, "accessibility", "Warning", "[image]", "Image is missing required alternative description text."),
    ]

    target_contents = ["demo-cnt-01", "demo-cnt-02", "demo-cnt-03", "demo-cnt-04", "demo-cnt-05", "demo-cnt-06"]

    finding_idx = 0
    for rule_id, total_cnt, dis_cnt, category, severity, quote, explanation in findings_plan:
        for i in range(total_cnt):
            cid = target_contents[finding_idx % len(target_contents)]
            finding_idx += 1
            is_dismissed = i < dis_cnt
            status = "dismissed" if is_dismissed else ("accepted" if i % 2 == 0 else "open")
            dismiss_reason = "Approved brand manager exception for contextual nuance" if is_dismissed else None

            f_id = str(uuid.uuid4())
            f_data = {
                "category": category,
                "severity": severity,
                "source_type": "rule-based",
                "quote": quote,
                "rule_id": rule_id,
                "explanation": explanation,
                "confidence": 1.0,
                "suggestion": "Approved standard phrasing",
                "status": status,
                "label": None,
            }

            db.execute(
                "INSERT INTO findings (id, content_id, version_number, data, status, dismiss_reason) VALUES (?, ?, ?, ?, ?, ?)",
                (f_id, cid, 1, json.dumps(f_data), status, dismiss_reason)
            )

    # Add audit entry for findings seeding
    db.execute(
        "INSERT INTO audit (id, actor, action, object, detail, services, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), "system", "demo seed", "findings:batch", "Seeded 41 demo findings with gap rules and overrides", "demo seed", now.isoformat())
    )

def seed_if_empty():
    kb_count = db.query("SELECT COUNT(*) as c FROM kb_items")[0]["c"]
    if kb_count == 0:
        json_path = os.path.join(os.path.dirname(__file__), "seed", "greenbrew.json")
        if os.path.exists(json_path):
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Rules
            for r in data.get("rules", []):
                db.execute(
                    "INSERT INTO kb_items (id, kind, data) VALUES (?, ?, ?)",
                    (r["id"], "rule", json.dumps(r))
                )

            # Terms
            for t in data.get("terms", []):
                term_id = t.get("id") or str(uuid.uuid4())
                db.execute(
                    "INSERT INTO kb_items (id, kind, data) VALUES (?, ?, ?)",
                    (term_id, "term", json.dumps(t))
                )

            # Facts
            for fact in data.get("facts", []):
                db.execute(
                    "INSERT INTO kb_items (id, kind, data) VALUES (?, ?, ?)",
                    (fact["id"], "fact", json.dumps(fact))
                )

            # Claims
            for claim in data.get("claims", []):
                db.execute(
                    "INSERT INTO kb_items (id, kind, data) VALUES (?, ?, ?)",
                    (claim["id"], "claim", json.dumps(claim))
                )

            # Assets
            if "assets" in data:
                db.execute(
                    "INSERT INTO kb_items (id, kind, data) VALUES (?, ?, ?)",
                    ("assets", "asset", json.dumps(data["assets"]))
                )

    user_count = db.query("SELECT COUNT(*) as c FROM users")[0]["c"]
    if user_count == 0:
        demo_users = [
            ("Demo Creator", "creator@demo.com", "creator"),
            ("Demo Reviewer", "reviewer@demo.com", "reviewer"),
            ("Demo Manager", "manager@demo.com", "manager"),
            ("Demo Admin", "admin@demo.com", "admin"),
        ]
        pw_hash = hash_password("demo1234")
        for name, email, role in demo_users:
            db.execute(
                "INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), name, email, pw_hash, role)
            )

if __name__ == "__main__":
    db.init_db()
    seed_if_empty()
    seed_demo_history()
    print("Database and demo history seeded successfully.")
