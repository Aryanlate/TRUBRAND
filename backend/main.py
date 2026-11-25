import os
import json
import uuid
import datetime
from typing import Optional, Any
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

import db
import llm
import review
import assistant
from privacy import mask_pii, unmask_text
from extract import extract_content
from auth import verify_password, create_token, get_user, require_role
from seed import seed_if_empty, seed_demo_history

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    seed_if_empty()
    seed_demo_history()
    yield

app = FastAPI(title="TruBrand API", lifespan=lifespan)

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for err in exc.errors():
        msg = err.get("msg", "Validation error")
        loc = " -> ".join(str(l) for l in err.get("loc", []) if l != "body")
        errors.append(f"{loc}: {msg}" if loc else msg)
    detail = "; ".join(errors) if errors else "Invalid request data"
    return JSONResponse(status_code=422, content={"detail": detail})

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    return JSONResponse(status_code=500, content={"detail": f"Internal server error: {str(exc)}"})

frontend_env = os.getenv("FRONTEND_URL", "http://localhost:3000")
origins = ["http://localhost:3000", "http://127.0.0.1:3000"]
for u in frontend_env.split(","):
    u_clean = u.strip().rstrip("/")
    if u_clean and u_clean not in origins:
        origins.append(u_clean)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def load_kb():
    rows = db.query("SELECT id, kind, data FROM kb_items")
    kb = {"rules": [], "terms": [], "facts": [], "claims": [], "assets": {"approved_logo_backgrounds": [], "palette": []}}
    for r in rows:
        kind = r["kind"]
        try:
            val = json.loads(r["data"])
        except Exception:
            continue
        if kind in ("rule", "rules"):
            if isinstance(val, dict) and "id" not in val:
                val["id"] = r["id"]
            kb["rules"].append(val)
        elif kind in ("term", "terms"):
            if isinstance(val, dict) and "id" not in val:
                val["id"] = r["id"]
            kb["terms"].append(val)
        elif kind in ("fact", "facts"):
            if isinstance(val, dict) and "id" not in val:
                val["id"] = r["id"]
            kb["facts"].append(val)
        elif kind in ("claim", "claims"):
            if isinstance(val, dict) and "id" not in val:
                val["id"] = r["id"]
            kb["claims"].append(val)
        elif kind in ("asset", "assets"):
            kb["assets"] = val
    return kb

KIND_NORM = {
    "rules": "rule", "rule": "rule",
    "terms": "term", "term": "term",
    "facts": "fact", "fact": "fact",
    "claims": "claim", "claim": "claim",
    "assets": "asset", "asset": "asset",
}

# --- Auth & System Endpoints ---

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/login")
def login(req: LoginRequest):
    if not req.email or not req.email.strip() or not req.password or not req.password.strip():
        raise HTTPException(status_code=400, detail="Email and password cannot be empty.")
    users = db.query("SELECT * FROM users WHERE email = ?", (req.email.strip(),))
    if not users or not verify_password(req.password, users[0]["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user = users[0]
    token = create_token(user["id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"]
        }
    }

@app.get("/auth/me")
def me(user: dict = Depends(get_user)):
    return user

@app.get("/providers")
def providers():
    return llm.available()

@app.get("/health")
def health():
    return {"status": "ok"}

# --- KB CRUD Endpoints ---

@app.get("/kb/{kind}")
def get_kb_kind(kind: str, user: dict = Depends(get_user)):
    k = KIND_NORM.get(kind.lower())
    if not k:
        raise HTTPException(status_code=400, detail=f"Unknown kind '{kind}'")
    if k == "asset":
        rows = db.query("SELECT id, kind, data FROM kb_items WHERE kind = 'asset'")
        if rows:
            try:
                return json.loads(rows[0]["data"])
            except Exception:
                return {}
        return {"approved_logo_backgrounds": [], "palette": []}
    rows = db.query("SELECT id, kind, data FROM kb_items WHERE kind = ?", (k,))
    items = []
    for r in rows:
        try:
            val = json.loads(r["data"])
            if isinstance(val, dict) and "id" not in val:
                val["id"] = r["id"]
            items.append(val)
        except Exception:
            continue
    return items

@app.post("/kb/{kind}")
def create_kb_item(kind: str, item: dict, user: dict = Depends(require_role("manager", "admin"))):
    k = KIND_NORM.get(kind.lower())
    if not k:
        raise HTTPException(status_code=400, detail=f"Unknown kind '{kind}'")
    if not isinstance(item, dict):
        raise HTTPException(status_code=400, detail="Invalid item payload")
    dumped = json.dumps(item)
    if len(dumped) > 20000:
        raise HTTPException(status_code=400, detail="Item data cannot exceed 20,000 characters.")
    if k == "asset":
        db.execute("INSERT OR REPLACE INTO kb_items (id, kind, data) VALUES ('assets', 'asset', ?)", (dumped,))
        return item
    item_id = item.get("id") or str(uuid.uuid4())
    item["id"] = item_id
    db.execute("INSERT INTO kb_items (id, kind, data) VALUES (?, ?, ?)", (item_id, k, json.dumps(item)))
    return item

@app.put("/kb/{kind}/{id}")
def update_kb_item(kind: str, id: str, item: dict, user: dict = Depends(require_role("manager", "admin"))):
    k = KIND_NORM.get(kind.lower())
    if not k:
        raise HTTPException(status_code=400, detail=f"Unknown kind '{kind}'")
    if not isinstance(item, dict):
        raise HTTPException(status_code=400, detail="Invalid item payload")
    dumped = json.dumps(item)
    if len(dumped) > 20000:
        raise HTTPException(status_code=400, detail="Item data cannot exceed 20,000 characters.")
    existing = db.query("SELECT id FROM kb_items WHERE id = ?", (id,))
    if not existing and k != "asset":
        raise HTTPException(status_code=404, detail="Item not found")
    item["id"] = id
    db.execute("INSERT OR REPLACE INTO kb_items (id, kind, data) VALUES (?, ?, ?)", (id, k, json.dumps(item)))
    return item

@app.delete("/kb/{kind}/{id}")
def delete_kb_item(kind: str, id: str, user: dict = Depends(require_role("manager", "admin"))):
    k = KIND_NORM.get(kind.lower())
    if not k:
        raise HTTPException(status_code=400, detail=f"Unknown kind '{kind}'")
    existing = db.query("SELECT id FROM kb_items WHERE id = ?", (id,))
    if not existing and k != "asset":
        raise HTTPException(status_code=404, detail="Item not found")
    db.execute("DELETE FROM kb_items WHERE id = ?", (id,))
    return {"ok": True}

# --- Content Endpoints ---

class CreateContentRequest(BaseModel):
    title: str
    channel: str
    text: str
    meta: Optional[dict] = None

@app.post("/content")
def create_content(req: CreateContentRequest, user: dict = Depends(get_user)):
    if not req.title or not req.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty.")
    if len(req.title) > 20000:
        raise HTTPException(status_code=400, detail="Title cannot exceed 20,000 characters.")
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Content text cannot be empty.")
    if len(req.text) > 20000:
        raise HTTPException(status_code=400, detail="Content text cannot exceed 20,000 characters.")
    if not req.channel or not req.channel.strip():
        raise HTTPException(status_code=400, detail="Channel cannot be empty.")

    content_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    db.execute(
        "INSERT INTO content (id, creator_id, title, channel, state, current_version, created_at) VALUES (?, ?, ?, ?, 'Draft', 1, ?)",
        (content_id, user["id"], req.title.strip(), req.channel.strip(), now)
    )
    version_id = str(uuid.uuid4())
    meta_json = json.dumps(req.meta or {})
    db.execute(
        "INSERT INTO versions (id, content_id, number, body, meta, score, created_by, created_at) VALUES (?, ?, 1, ?, ?, NULL, ?, ?)",
        (version_id, content_id, req.text, meta_json, user["id"], now)
    )
    return {
        "id": content_id,
        "creator_id": user["id"],
        "title": req.title,
        "channel": req.channel,
        "state": "Draft",
        "current_version": 1,
        "created_at": now
    }

@app.get("/content")
def list_content(user: dict = Depends(get_user)):
    if user["role"] == "creator":
        rows = db.query("SELECT * FROM content WHERE creator_id = ? ORDER BY created_at DESC", (user["id"],))
    else:
        rows = db.query("SELECT * FROM content ORDER BY created_at DESC")
    return rows

@app.get("/content/{id}")
def get_content(id: str, user: dict = Depends(get_user)):
    contents = db.query("SELECT * FROM content WHERE id = ?", (id,))
    if not contents:
        raise HTTPException(status_code=404, detail="Content not found")
    c = contents[0]
    if user["role"] == "creator" and c["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden: creators can only access their own content")

    raw_versions = db.query("SELECT * FROM versions WHERE content_id = ? ORDER BY number ASC", (id,))
    versions = []
    for v in raw_versions:
        vd = dict(v)
        try:
            vd["meta"] = json.loads(vd["meta"]) if vd["meta"] else {}
        except Exception:
            pass
        try:
            vd["score"] = json.loads(vd["score"]) if vd["score"] else None
        except Exception:
            pass
        versions.append(vd)

    raw_findings = db.query("SELECT * FROM findings WHERE content_id = ?", (id,))
    findings = []
    for f in raw_findings:
        fd = dict(f)
        try:
            parsed = json.loads(fd["data"]) if isinstance(fd["data"], str) else fd["data"]
            if isinstance(parsed, dict):
                for k, val in parsed.items():
                    if k not in fd or fd[k] is None:
                        fd[k] = val
                fd["data"] = parsed
        except Exception:
            pass
        findings.append(fd)

    comments = db.query(
        "SELECT c.*, u.name as author_name, u.role as author_role FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.content_id = ? ORDER BY c.created_at ASC",
        (id,)
    )
    approvals = db.query(
        "SELECT a.*, u.name as reviewer_name, u.role as reviewer_role FROM approvals a LEFT JOIN users u ON a.reviewer_id = u.id WHERE a.content_id = ? ORDER BY a.created_at ASC",
        (id,)
    )

    res = dict(c)
    res["content"] = dict(c)
    res["versions"] = versions
    res["findings"] = findings
    res["comments"] = [dict(cm) for cm in comments]
    res["approvals"] = [dict(ap) for ap in approvals]
    return res

@app.get("/content/{id}/report-data")
def get_content_report_data(id: str, user: dict = Depends(get_user)):
    contents = db.query(
        "SELECT c.*, u.name as creator_name, u.email as creator_email FROM content c LEFT JOIN users u ON c.creator_id = u.id WHERE c.id = ?",
        (id,)
    )
    if not contents:
        raise HTTPException(status_code=404, detail="Content not found")
    c = contents[0]
    if user["role"] == "creator" and c["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden: creators can only access their own content")

    raw_versions = db.query("SELECT * FROM versions WHERE content_id = ? ORDER BY number ASC", (id,))
    versions = []
    for v in raw_versions:
        vd = dict(v)
        try:
            vd["meta"] = json.loads(vd["meta"]) if vd["meta"] else {}
        except Exception:
            pass
        try:
            vd["score"] = json.loads(vd["score"]) if vd["score"] else None
        except Exception:
            pass
        versions.append(vd)

    raw_findings = db.query("SELECT * FROM findings WHERE content_id = ? ORDER BY version_number ASC", (id,))
    findings = []
    for f in raw_findings:
        fd = dict(f)
        try:
            parsed = json.loads(fd["data"]) if isinstance(fd["data"], str) else fd["data"]
            if isinstance(parsed, dict):
                for k, val in parsed.items():
                    if k not in fd or fd[k] is None:
                        fd[k] = val
                fd["data"] = parsed
        except Exception:
            pass
        findings.append(fd)

    comments = db.query(
        "SELECT c.*, u.name as author_name, u.role as author_role FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.content_id = ? ORDER BY c.created_at ASC",
        (id,)
    )
    approvals = db.query(
        "SELECT a.*, u.name as reviewer_name, u.role as reviewer_role FROM approvals a LEFT JOIN users u ON a.reviewer_id = u.id WHERE a.content_id = ? ORDER BY a.created_at ASC",
        (id,)
    )

    audit_rows = db.query("SELECT DISTINCT services FROM audit WHERE object LIKE ? AND services != ''", (f"content:{id}%",))
    services_used = [r["services"] for r in audit_rows if r.get("services")]

    return {
        "content": dict(c),
        "version_history": versions,
        "versions": versions,
        "findings": findings,
        "comments": [dict(cm) for cm in comments],
        "approvals": [dict(ap) for ap in approvals],
        "services_used": services_used,
    }

class ReviewContentRequest(BaseModel):
    provider: Optional[str] = None
    mask_pii: Optional[bool] = True

@app.post("/content/{id}/review")
def review_content(id: str, req: Optional[ReviewContentRequest] = None, user: dict = Depends(get_user)):
    contents = db.query("SELECT * FROM content WHERE id = ?", (id,))
    if not contents:
        raise HTTPException(status_code=404, detail="Content not found")
    c = contents[0]
    if user["role"] == "creator" and c["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden: creators can only review their own content")

    ver_num = c["current_version"]
    ver_rows = db.query("SELECT * FROM versions WHERE content_id = ? AND number = ?", (id, ver_num))
    if not ver_rows:
        raise HTTPException(status_code=404, detail="Version not found")
    v = ver_rows[0]
    body = v["body"]
    meta = json.loads(v["meta"]) if v["meta"] else {}

    # Handle PII masking (default: True)
    should_mask = True if req is None or req.mask_pii is None else req.mask_pii
    text_to_review = body
    pii_map = {}
    if should_mask:
        text_to_review, pii_map = mask_pii(body)

    preferred = req.provider if req else None
    result = review.review(text_to_review, load_kb(), meta, preferred=preferred)
    findings = result["findings"]
    score = result["score"]
    provider = result["provider"]
    ai_error = result["ai_error"]

    # Restore placeholders in returned finding quotes and suggestions
    if should_mask and pii_map:
        for f in findings:
            if f.get("quote"):
                f["quote"] = unmask_text(f["quote"], pii_map)
            if f.get("suggestion"):
                f["suggestion"] = unmask_text(f["suggestion"], pii_map)
            if f.get("explanation"):
                f["explanation"] = unmask_text(f["explanation"], pii_map)

    # delete previous findings of that version (ensures review is idempotent)
    db.execute("DELETE FROM findings WHERE content_id = ? AND version_number = ?", (id, ver_num))

    # store new findings (status open)
    saved_findings = []
    for f in findings:
        f_copy = dict(f)
        f_id = f_copy.get("id") or str(uuid.uuid4())
        f_copy["id"] = f_id
        f_copy["status"] = "open"
        db.execute(
            "INSERT INTO findings (id, content_id, version_number, data, status, dismiss_reason) VALUES (?, ?, ?, ?, 'open', NULL)",
            (f_id, id, ver_num, json.dumps(f_copy))
        )
        saved_findings.append(f_copy)

    # store the score JSON in versions.score
    db.execute("UPDATE versions SET score = ? WHERE content_id = ? AND number = ?", (json.dumps(score), id, ver_num))

    # set state Reviewed
    db.execute("UPDATE content SET state = 'Reviewed' WHERE id = ?", (id,))

    # write audit with services ("pii_masked" recorded when active)
    services_field = provider or ""
    if should_mask:
        services_field = f"{services_field}:pii_masked" if services_field else "pii_masked"

    db.audit(user["email"], "review", f"content:{id}:v{ver_num}", {"overall_score": score.get("overall"), "findings_count": len(findings), "mask_pii": should_mask}, services=services_field)

    return {
        "findings": saved_findings,
        "score": score,
        "provider": provider,
        "ai_error": ai_error
    }

class ReviseContentRequest(BaseModel):
    text: str
    meta: Optional[dict] = None

@app.post("/content/{id}/revise")
def revise_content(id: str, req: ReviseContentRequest, user: dict = Depends(get_user)):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Content text cannot be empty.")
    if len(req.text) > 20000:
        raise HTTPException(status_code=400, detail="Content text cannot exceed 20,000 characters.")

    contents = db.query("SELECT * FROM content WHERE id = ?", (id,))
    if not contents:
        raise HTTPException(status_code=404, detail="Content not found")
    c = contents[0]
    if user["role"] == "creator" and c["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden: creators can only revise their own content")

    # Safe to repeat: if identical to current version, return current state idempotently
    cur_ver = c["current_version"]
    cur_ver_rows = db.query("SELECT * FROM versions WHERE content_id = ? AND number = ?", (id, cur_ver))
    if cur_ver_rows:
        cv = cur_ver_rows[0]
        try:
            cv_meta = json.loads(cv["meta"]) if cv["meta"] else {}
        except Exception:
            cv_meta = {}
        if cv["body"] == req.text and cv_meta == (req.meta or {}):
            return {
                "content_id": id,
                "current_version": cur_ver,
                "state": c["state"],
                "version_id": cv["id"]
            }

    new_ver = c["current_version"] + 1
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    meta_json = json.dumps(req.meta or {})
    ver_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO versions (id, content_id, number, body, meta, score, created_by, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)",
        (ver_id, id, new_ver, req.text, meta_json, user["id"], now)
    )
    db.execute("UPDATE content SET current_version = ?, state = 'Draft' WHERE id = ?", (new_ver, id))
    return {
        "content_id": id,
        "current_version": new_ver,
        "state": "Draft",
        "version_id": ver_id
    }

class PatchFindingRequest(BaseModel):
    status: str
    dismiss_reason: Optional[str] = None

@app.patch("/findings/{id}")
def patch_finding(id: str, req: PatchFindingRequest, user: dict = Depends(get_user)):
    if req.status not in ("accepted", "dismissed", "open"):
        raise HTTPException(status_code=400, detail="Invalid status. Must be accepted, dismissed, or open.")
    if req.status == "dismissed" and not (req.dismiss_reason or "").strip():
        raise HTTPException(status_code=400, detail="Dismissing a finding requires a dismiss_reason")
    if req.dismiss_reason and len(req.dismiss_reason) > 20000:
        raise HTTPException(status_code=400, detail="Dismiss reason cannot exceed 20,000 characters.")

    findings = db.query("SELECT * FROM findings WHERE id = ?", (id,))
    if not findings:
        raise HTTPException(status_code=404, detail="Finding not found")
    f = findings[0]

    contents = db.query("SELECT * FROM content WHERE id = ?", (f["content_id"],))
    if not contents:
        raise HTTPException(status_code=404, detail="Content not found")
    c = contents[0]

    is_creator = (c["creator_id"] == user["id"])
    is_privileged = (user["role"] in ("manager", "admin"))
    if not (is_creator or is_privileged):
        raise HTTPException(status_code=403, detail="Forbidden: only creator or manager/admin can modify findings")

    try:
        data = json.loads(f["data"]) if isinstance(f["data"], str) else f["data"]
    except Exception:
        data = {}

    data["status"] = req.status
    dismiss_reason = req.dismiss_reason if req.status == "dismissed" else None
    data["dismiss_reason"] = dismiss_reason

    db.execute(
        "UPDATE findings SET status = ?, dismiss_reason = ?, data = ? WHERE id = ?",
        (req.status, dismiss_reason, json.dumps(data), id)
    )

    # Recalculate and update version score
    all_f_rows = db.query("SELECT data, status FROM findings WHERE content_id = ? AND version_number = ?", (f["content_id"], f["version_number"]))
    all_f = []
    for r in all_f_rows:
        try:
            d = json.loads(r["data"]) if isinstance(r["data"], str) else r["data"]
            d["status"] = r["status"]
            all_f.append(d)
        except Exception:
            pass
    updated_score = review.score(all_f)
    db.execute("UPDATE versions SET score = ? WHERE content_id = ? AND number = ?", (json.dumps(updated_score), f["content_id"], f["version_number"]))

    return {
        "id": id,
        "content_id": f["content_id"],
        "version_number": f["version_number"],
        "status": req.status,
        "dismiss_reason": dismiss_reason,
        "data": data,
        "score": updated_score
    }

# --- Workflow Endpoints (Submit, Comments, Decision, Audit) ---

@app.post("/content/{id}/submit")
def submit_content(id: str, user: dict = Depends(get_user)):
    contents = db.query("SELECT * FROM content WHERE id = ?", (id,))
    if not contents:
        raise HTTPException(status_code=404, detail="Content not found")
    c = contents[0]

    is_creator = (c["creator_id"] == user["id"])
    is_privileged = (user["role"] in ("manager", "admin"))
    if not (is_creator or is_privileged):
        raise HTTPException(status_code=403, detail="Forbidden: only creator or manager/admin can submit content")

    # Safe to repeat: if already InReview, return current state
    if c["state"] == "InReview":
        return {"id": id, "state": "InReview"}

    if c["state"] != "Reviewed":
        raise HTTPException(status_code=400, detail=f"Content must be in 'Reviewed' state to submit (current state is '{c['state']}')")

    db.execute("UPDATE content SET state = 'InReview' WHERE id = ?", (id,))
    db.audit(user["email"], "submit", f"content:{id}", {"from_state": "Reviewed", "to_state": "InReview"})

    return {"id": id, "state": "InReview"}

class CreateCommentRequest(BaseModel):
    text: str
    finding_id: Optional[str] = None

@app.post("/content/{id}/comments")
def add_comment(id: str, req: CreateCommentRequest, user: dict = Depends(get_user)):
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Comment text cannot be empty.")
    if len(req.text) > 20000:
        raise HTTPException(status_code=400, detail="Comment text cannot exceed 20,000 characters.")

    contents = db.query("SELECT * FROM content WHERE id = ?", (id,))
    if not contents:
        raise HTTPException(status_code=404, detail="Content not found")
    c = contents[0]
    if user["role"] == "creator" and c["creator_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Forbidden: creators can only comment on their own content")

    if req.finding_id:
        f_check = db.query("SELECT id FROM findings WHERE id = ? AND content_id = ?", (req.finding_id, id))
        if not f_check:
            raise HTTPException(status_code=404, detail="Finding not found")

    comment_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    db.execute(
        "INSERT INTO comments (id, content_id, finding_id, author_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (comment_id, id, req.finding_id, user["id"], req.text.strip(), now)
    )
    return {
        "id": comment_id,
        "content_id": id,
        "finding_id": req.finding_id,
        "author_id": user["id"],
        "author_name": user["name"],
        "author_role": user["role"],
        "text": req.text.strip(),
        "created_at": now
    }

class DecisionRequest(BaseModel):
    decision: str
    reason: Optional[str] = ""
    override: Optional[bool] = False

@app.post("/content/{id}/decision")
def content_decision(id: str, req: DecisionRequest, user: dict = Depends(get_user)):
    if user["role"] not in ("reviewer", "manager", "admin"):
        raise HTTPException(
            status_code=403,
            detail=f"Forbidden: Action requires role 'reviewer', 'manager', or 'admin'. Your current role is '{user['role']}'."
        )

    contents = db.query("SELECT * FROM content WHERE id = ?", (id,))
    if not contents:
        raise HTTPException(status_code=404, detail="Content not found")
    c = contents[0]

    # Safe to repeat: if identical decision already made, return current state
    if req.decision == "approve" and c["state"] == "Approved":
        approvals = db.query("SELECT id FROM approvals WHERE content_id = ? ORDER BY created_at DESC LIMIT 1", (id,))
        app_id = approvals[0]["id"] if approvals else ""
        return {"id": id, "state": "Approved", "decision": req.decision, "approval_id": app_id}
    if req.decision == "request_changes" and c["state"] == "ChangesRequested":
        approvals = db.query("SELECT id FROM approvals WHERE content_id = ? ORDER BY created_at DESC LIMIT 1", (id,))
        app_id = approvals[0]["id"] if approvals else ""
        return {"id": id, "state": "ChangesRequested", "decision": req.decision, "approval_id": app_id}

    if c["state"] != "InReview":
        raise HTTPException(status_code=400, detail=f"Content must be in 'InReview' state to make a decision (current state is '{c['state']}')")

    if req.decision not in ("approve", "request_changes"):
        raise HTTPException(status_code=400, detail="Invalid decision. Must be 'approve' or 'request_changes'.")

    if req.reason and len(req.reason) > 20000:
        raise HTTPException(status_code=400, detail="Decision reason cannot exceed 20,000 characters.")

    override_stored = None
    if req.decision == "approve":
        cur_ver = c["current_version"]
        finding_rows = db.query("SELECT data, status FROM findings WHERE content_id = ? AND version_number = ? AND status = 'open'", (id, cur_ver))
        has_blocker = False
        for fr in finding_rows:
            try:
                fd = json.loads(fr["data"]) if isinstance(fr["data"], str) else fr["data"]
                if fd.get("severity") == "Blocker":
                    has_blocker = True
                    break
            except Exception:
                pass

        if has_blocker:
            has_valid_override = bool(req.override) and bool(req.reason and req.reason.strip())
            if not has_valid_override:
                raise HTTPException(
                    status_code=409,
                    detail="Cannot approve content with open Blocker findings unless override is true with a non-empty reason."
                )
            override_stored = req.reason.strip()
        new_state = "Approved"
    else:
        new_state = "ChangesRequested"

    db.execute("UPDATE content SET state = ? WHERE id = ?", (new_state, id))

    approval_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    db.execute(
        "INSERT INTO approvals (id, content_id, reviewer_id, decision, reason, override, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (approval_id, id, user["id"], req.decision, req.reason or "", override_stored, now)
    )

    db.audit(
        user["email"],
        "decision",
        f"content:{id}",
        {"decision": req.decision, "reason": req.reason, "override": req.override, "new_state": new_state}
    )

    return {
        "id": id,
        "state": new_state,
        "decision": req.decision,
        "approval_id": approval_id
    }

@app.get("/audit")
def get_audit(user: dict = Depends(require_role("manager", "admin"))):
    rows = db.query("SELECT * FROM audit ORDER BY created_at DESC LIMIT 200")
    return rows

@app.get("/insights")
def get_insights(user: dict = Depends(require_role("manager", "admin"))):
    # 1. Findings analysis for top rules and categories
    finding_rows = db.query("SELECT data, status FROM findings")
    rule_stats = {}
    category_counts = {}

    for row in finding_rows:
        try:
            fd = json.loads(row["data"]) if isinstance(row["data"], str) else (row["data"] or {})
        except Exception:
            fd = {}
        
        rule_id = fd.get("rule_id") or "Unknown"
        cat = fd.get("category") or "general"

        if rule_id not in rule_stats:
            rule_stats[rule_id] = {"rule_id": rule_id, "total": 0, "dismissed": 0}
        rule_stats[rule_id]["total"] += 1
        if row["status"] == "dismissed":
            rule_stats[rule_id]["dismissed"] += 1

        category_counts[cat] = category_counts.get(cat, 0) + 1

    top_rules = []
    for r_id, s in rule_stats.items():
        total = s["total"]
        dismissed = s["dismissed"]
        rate = round(dismissed / total, 3) if total > 0 else 0.0
        top_rules.append({
            "rule_id": r_id,
            "total": total,
            "dismissed": dismissed,
            "dismissal_rate": rate
        })
    top_rules.sort(key=lambda x: x["total"], reverse=True)

    # 2. Gap rules: total >= 5 and dismissal_rate >= 0.4
    gap_rules = []
    for r in top_rules:
        if r["total"] >= 5 and r["dismissal_rate"] >= 0.4:
            gap_item = dict(r)
            gap_item["recommendation"] = "Add examples or rewrite this rule"
            gap_rules.append(gap_item)

    # 3. Override count from approvals
    override_res = db.query("SELECT COUNT(*) as c FROM approvals WHERE override IS NOT NULL AND TRIM(override) != ''")
    override_count = override_res[0]["c"] if override_res else 0

    # 4. Average score per day from versions.score
    version_rows = db.query("SELECT score, created_at FROM versions WHERE score IS NOT NULL")
    day_scores = {}
    for vr in version_rows:
        try:
            score_data = json.loads(vr["score"]) if isinstance(vr["score"], str) else vr["score"]
            overall = score_data.get("overall") if isinstance(score_data, dict) else None
        except Exception:
            overall = None
        
        if overall is not None:
            day = vr["created_at"][:10] if vr["created_at"] else "Unknown"
            if day not in day_scores:
                day_scores[day] = []
            day_scores[day].append(float(overall))

    average_score_per_day = []
    for day in sorted(day_scores.keys()):
        scores = day_scores[day]
        avg = round(sum(scores) / len(scores), 1) if scores else 0.0
        average_score_per_day.append({
            "date": day,
            "average_score": avg,
            "count": len(scores)
        })

    # 5. Claims expiring within 30 days or already expired
    claim_rows = db.query("SELECT data FROM kb_items WHERE kind = 'claim'")
    today = datetime.date.today()
    threshold = today + datetime.timedelta(days=30)
    claims_expiring = []

    for cr in claim_rows:
        try:
            c = json.loads(cr["data"]) if isinstance(cr["data"], str) else (cr["data"] or {})
        except Exception:
            c = {}
        
        exp_str = c.get("expires_on")
        if exp_str:
            try:
                exp_date = datetime.date.fromisoformat(exp_str)
                if exp_date <= threshold:
                    days_remaining = (exp_date - today).days
                    claims_expiring.append({
                        "id": c.get("id"),
                        "phrase": c.get("phrase", ""),
                        "evidence": c.get("evidence", ""),
                        "expires_on": exp_str,
                        "days_remaining": days_remaining,
                        "is_expired": days_remaining < 0
                    })
            except Exception:
                pass
    claims_expiring.sort(key=lambda x: x["expires_on"])

    # 6. Most frequent categories
    most_frequent_categories = [
        {"category": cat, "count": cnt}
        for cat, cnt in sorted(category_counts.items(), key=lambda x: x[1], reverse=True)
    ]

    return {
        "top_rules": top_rules,
        "gap_rules": gap_rules,
        "override_count": override_count,
        "average_score_per_day": average_score_per_day,
        "claims_expiring": claims_expiring,
        "most_frequent_categories": most_frequent_categories
    }

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), user: dict = Depends(get_user)):
    file_bytes = await file.read()
    
    # Retrieve brand palette from kb_items assets
    asset_rows = db.query("SELECT data FROM kb_items WHERE kind = 'asset'")
    palette = []
    if asset_rows:
        try:
            asset_data = json.loads(asset_rows[0]["data"])
            palette = asset_data.get("palette", [])
        except Exception:
            pass

    try:
        result = extract_content(file.filename or "", file_bytes, brand_palette=palette)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File extraction failed: {str(e)}")

# --- Assistant & Explanation Endpoints ---

@app.post("/findings/{id}/why")
def get_finding_why(id: str, user: dict = Depends(get_user)):
    rows = db.query("SELECT data FROM findings WHERE id = ?", (id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Finding not found")
    
    try:
        fd = json.loads(rows[0]["data"]) if isinstance(rows[0]["data"], str) else (rows[0]["data"] or {})
    except Exception:
        fd = {}
    
    rule_id = fd.get("rule_id")
    if not rule_id:
        return {"explanation": "No supporting source found"}

    source_row = db.query("SELECT kind, data FROM kb_items WHERE id = ?", (rule_id,))
    if not source_row:
        return {"explanation": "No supporting source found"}

    try:
        source_data = json.loads(source_row[0]["data"])
        kind = source_row[0]["kind"]
        if kind == "rule":
            text = f"{source_data.get('title')}: {source_data.get('text')}"
        elif kind == "fact":
            text = source_data.get("statement", "")
        elif kind == "claim":
            text = f"Approved claim '{source_data.get('phrase')}', evidence: {source_data.get('evidence')}"
        else:
            text = json.dumps(source_data)
    except Exception:
        text = rule_id

    explanation, provider = assistant.explain_finding(fd, {"id": rule_id, "text": text})
    return {"explanation": explanation}

class AssistantQuestionRequest(BaseModel):
    question: str
    content_id: Optional[str] = None

@app.post("/assistant")
def chat_assistant(req: AssistantQuestionRequest, user: dict = Depends(get_user)):
    if not req.question or not req.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if len(req.question) > 20000:
        raise HTTPException(status_code=400, detail="Question cannot exceed 20,000 characters.")

    open_findings = []
    if req.content_id:
        content_rows = db.query("SELECT current_version FROM content WHERE id = ?", (req.content_id,))
        if not content_rows:
            raise HTTPException(status_code=404, detail="Content not found")
        cur_ver = content_rows[0]["current_version"]
        f_rows = db.query(
            "SELECT data FROM findings WHERE content_id = ? AND version_number = ? AND status = 'open'",
            (req.content_id, cur_ver)
        )
        for fr in f_rows:
            try:
                open_findings.append(json.loads(fr["data"]))
            except Exception:
                pass

    kb = load_kb()
    answer, source_ids, grounded, provider = assistant.answer_brand_question(
        req.question.strip(),
        kb,
        open_findings=open_findings
    )

    msg_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    db.execute(
        "INSERT INTO assistant_messages (id, user_id, content_id, question, answer, cited_ids, grounded, feedback, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)",
        (msg_id, user["id"], req.content_id, req.question.strip(), answer, json.dumps(source_ids), 1 if grounded else 0, now)
    )

    db.audit(
        user["email"],
        "assistant_query",
        f"assistant_message:{msg_id}",
        {"question": req.question.strip(), "grounded": grounded, "sources_count": len(source_ids)},
        services=provider or ""
    )

    return {
        "id": msg_id,
        "answer": answer,
        "source_ids": source_ids,
        "grounded": grounded,
        "created_at": now
    }

class AssistantFeedbackRequest(BaseModel):
    feedback: str

@app.patch("/assistant/{id}")
def update_assistant_feedback(id: str, req: AssistantFeedbackRequest, user: dict = Depends(get_user)):
    if req.feedback and len(req.feedback) > 20000:
        raise HTTPException(status_code=400, detail="Feedback cannot exceed 20,000 characters.")
    rows = db.query("SELECT id FROM assistant_messages WHERE id = ?", (id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Assistant message not found")
    
    db.execute("UPDATE assistant_messages SET feedback = ? WHERE id = ?", (req.feedback, id))
    return {"id": id, "feedback": req.feedback}
