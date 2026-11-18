import os
import json
import uuid
import db
from auth import hash_password

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
    print("Database seeded successfully.")
