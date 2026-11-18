import sqlite3
import os
import json
import uuid
import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "trubrand.db")

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def execute(sql, params=()):
    with get_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        return cursor

def query(sql, params=()):
    with get_conn() as conn:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        return [dict(r) for r in rows]

def init_db():
    tables = [
        """
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS kb_items (
            id TEXT PRIMARY KEY,
            kind TEXT NOT NULL,
            data TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS content (
            id TEXT PRIMARY KEY,
            creator_id TEXT NOT NULL,
            title TEXT NOT NULL,
            channel TEXT NOT NULL,
            state TEXT NOT NULL,
            current_version INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS versions (
            id TEXT PRIMARY KEY,
            content_id TEXT NOT NULL,
            number INTEGER NOT NULL,
            body TEXT NOT NULL,
            meta TEXT,
            score TEXT,
            created_by TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS findings (
            id TEXT PRIMARY KEY,
            content_id TEXT NOT NULL,
            version_number INTEGER NOT NULL,
            data TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open',
            dismiss_reason TEXT
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS comments (
            id TEXT PRIMARY KEY,
            content_id TEXT NOT NULL,
            finding_id TEXT,
            author_id TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS approvals (
            id TEXT PRIMARY KEY,
            content_id TEXT NOT NULL,
            reviewer_id TEXT NOT NULL,
            decision TEXT NOT NULL,
            reason TEXT,
            override TEXT,
            created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS audit (
            id TEXT PRIMARY KEY,
            actor TEXT NOT NULL,
            action TEXT NOT NULL,
            object TEXT NOT NULL,
            detail TEXT NOT NULL,
            services TEXT DEFAULT '',
            created_at TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS assistant_messages (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            content_id TEXT NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            cited_ids TEXT,
            grounded INTEGER DEFAULT 1,
            feedback TEXT,
            created_at TEXT NOT NULL
        )
        """
    ]
    with get_conn() as conn:
        cursor = conn.cursor()
        for t in tables:
            cursor.execute(t)
        conn.commit()

def audit(actor, action, obj, detail, services=""):
    det = json.dumps(detail) if isinstance(detail, (dict, list)) else str(detail)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    execute(
        "INSERT INTO audit (id, actor, action, object, detail, services, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), actor, action, obj, det, services, now)
    )

def load_kb():
    rows = query("SELECT kind, data FROM kb_items")
    kb = {"rules": [], "terms": [], "facts": [], "claims": [], "assets": {}}
    for r in rows:
        kind = r["kind"]
        try:
            val = json.loads(r["data"])
        except Exception:
            continue
        if kind == "rule":
            kb["rules"].append(val)
        elif kind == "term":
            kb["terms"].append(val)
        elif kind == "fact":
            kb["facts"].append(val)
        elif kind == "claim":
            kb["claims"].append(val)
        elif kind == "asset":
            kb["assets"] = val
    return kb
