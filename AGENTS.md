# TruBrand: brand-governance platform (solo hackathon project)
Reviews content before publication against approved brand rules, facts and claims; explains each finding with its cited source; suggests fixes; human approval workflow; insights.
 
## WORKING RULES (always)
- Read this file first. Write code directly into files. No plans, task lists, walkthroughs, extra docs or READMEs unless the prompt asks.
- Terminal use is allowed ONLY to install dependencies (pip into backend/.venv, npm in frontend) or run a command the prompt names. Never start dev servers, never open a browser, no screenshots.
- Only create or edit the files named in the prompt. Do not re-read unchanged files.
- If unsure, pick the simplest option. Do not ask questions.
- Final reply: max 3 lines.
 
## Stack
Backend: FastAPI + sqlite3 (file backend/trubrand.db). Frontend: Next.js App Router + TypeScript + Tailwind in /frontend. API base from NEXT_PUBLIC_API_URL (default http://localhost:8000).
Existing backend files (do not rewrite): llm.py (multi-provider JSON chat), retrieval.py, rules_engine.py, review.py (review(text, kb, meta, preferred) returns {findings, score, provider, ai_error}), seed/greenbrew.json.
 
## Colours (use everywhere)
primary #142D4E, secondary #2563EB, background #F8FAFC, text #1E293B, accent #38BDF8.
Severity: Blocker #B91C1C, Warning #D97706, Info #2563EB (always also show text or an icon, never colour alone). Cards white with 1px border #E2E8F0, rounded-xl. System sans font. Body text at least 16px, visible focus rings, labelled inputs.
 
## Roles
creator, reviewer, manager, admin. Demo users (password demo1234): creator@demo.com, reviewer@demo.com, manager@demo.com, admin@demo.com.
creator: create/revise/review own content, act on own findings, comment, submit.
reviewer: comment, decide (approve/request_changes) on InReview content.
manager: reviewer rights + edit knowledge base + insights + override Blockers.
admin: everything.
 
## DB tables (sqlite3, JSON stored as text)
users(id, name, email, password_hash, role)
kb_items(id, kind, data)  kind in rule|term|fact|claim|asset
content(id, creator_id, title, channel, state, current_version, created_at)
versions(id, content_id, number, body, meta, score, created_by, created_at)
findings(id, content_id, version_number, data, status, dismiss_reason)  data = finding JSON
comments(id, content_id, finding_id, author_id, text, created_at)
approvals(id, content_id, reviewer_id, decision, reason, override, created_at)
audit(id, actor, action, object, detail, services, created_at)
assistant_messages(id, user_id, content_id, question, answer, cited_ids, grounded, feedback, created_at)
 
## KB shape (load_kb() builds it from kb_items; same shape as seed/greenbrew.json)
{"rules":[{id,category,title,text,severity,good,bad}], "terms":[{type,term,replacement,rule_id,severity,note}], "facts":[{id,statement}], "claims":[{id,phrase,evidence,expires_on}], "assets":{approved_logo_backgrounds:[],palette:[]}}
assets is stored as one kb_items row (kind asset). Items without an id get a uuid.
 
## Finding JSON
{category, severity (Blocker|Warning|Info), source_type (rule-based|ai-assisted), quote, rule_id, explanation, confidence, suggestion, status (open|accepted|dismissed), label}
 
## Content states
Draft -> Reviewed (after review run) -> InReview (submit) -> Approved | ChangesRequested; ChangesRequested -> Draft on revise.
Approve is refused (409) if any open Blocker exists, unless the role is reviewer/manager/admin AND override=true with a non-empty reason (stored in approvals.override). Dismissing a finding requires a reason.
 
## API (JWT bearer except login)
POST /auth/login | GET /auth/me | GET /providers | GET /health
GET/POST /kb/{kind} | PUT/DELETE /kb/{kind}/{id} (write: manager/admin)
POST /content {title,channel,text,meta} | GET /content | GET /content/{id} (content, versions, findings, comments, approvals)
POST /content/{id}/review {provider?, mask_pii?} | POST /content/{id}/revise {text,meta}
PATCH /findings/{id} {status, dismiss_reason?} | POST /content/{id}/submit
POST /content/{id}/comments {text, finding_id?} | POST /content/{id}/decision {decision, reason, override?}
GET /audit
meta = {has_image, alt_text, logo_bg, fg, bg}
Every review and decision writes an audit row (services = provider:model used).