# TruBrand: Autonomous Brand Governance Platform

TruBrand is a solo hackathon project built to govern brand consistency and compliance before content is published. It evaluates drafts against approved brand rules, terminology, verified facts, and legal claims, provides cited rationales and suggested fixes, and powers a complete human-in-the-loop review and approval workflow with governance insights.

---

## Quick Start

### 1. Configure Environment
Copy or edit `backend/.env` with your API keys:
```env
# Optional LLM API keys (TruBrand automatically falls back across available providers or rule-based checks)
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
GROK_API_KEY=your_grok_api_key

# Security & Network
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=http://localhost:3000
```

### 2. Launch the Platform
- **Windows**: Run `start.bat`
- **Linux / macOS**: Run `chmod +x start.sh && ./start.sh`

### 3. Demo Credentials (Password: `demo1234`)
- **Creator**: `creator@demo.com` — Create, revise, run review, submit drafts.
- **Reviewer**: `reviewer@demo.com` — Review, comment, approve or request changes on submitted copy.
- **Manager**: `manager@demo.com` — Reviewer privileges + edit Knowledge Base, view insights, override Blockers.
- **Admin**: `admin@demo.com` — Full platform administrative control.

---

## Architecture (10 Lines)

1. **Backend Service**: FastAPI REST application in Python with modular rule evaluation and LLM orchestration.
2. **Database**: Lightweight SQLite (`backend/trubrand.db`) storing users, knowledge base items, versioned content, audit logs, and approval trails.
3. **Rules Engine**: Deterministic Python regex and WCAG luminance calculations for terms, brand naming, claims validity, and accessibility.
4. **Retrieval**: Scikit-learn TF-IDF vectorizer retrieving top matching rules, facts, and claims for targeted context injection.
5. **LLM Provider Router**: Resilient fallback client supporting Groq, Google Gemini, OpenAI, and xAI Grok via OpenAI-compatible endpoints.
6. **Privacy Layer**: Regex-based PII masking that replaces sensitive emails, phones, and IDs before external AI transmission.
7. **Document Parser**: Ingestion pipeline extracting text and visual metadata from PDF, DOCX, TXT, and image files (pytesseract OCR + Pillow).
8. **Frontend Application**: Next.js App Router (React, TypeScript) with server and client components styled via Tailwind CSS.
9. **Visual Analytics**: Recharts charts for brand health trends, rule violation frequencies, gap detection, and claim expirations.
10. **Governance Reporting**: Dedicated print-friendly one-page compliance audit report with verification hash and decision logging.

---

## How Grounding Works

TruBrand strictly enforces hallucination prevention and citation integrity:
1. **Targeted Retrieval**: When copy is submitted for review or assistant inquiry, `retrieval.py` indexes brand rules, verified company facts, and active claims with TF-IDF, picking the top grounded sources for the context window.
2. **Citation Validation**: Every AI-assisted finding returned by an LLM is validated by `review.py`. An AI finding is accepted **only** if its cited `rule_id` exists in the retrieved sources and its quoted text appears verbatim in the content draft. Any ungrounded or invented citations are immediately discarded.
3. **Cannot Verify Behavior**: If a marketing claim lacks approved evidence or its certification date has expired, the rules engine automatically flags a Blocker. When the Brand Assistant cannot find supporting documentation in approved sources, it refuses speculation with: *"I cannot find this in the approved guidelines. Please ask a brand manager."* (grounded=false).

---

## Features by Round

- **Round 1 (Core Governance Engine)**: Deterministic rules engine (`rules_engine.py`), WCAG contrast ratio checks, brand health scoring algorithm (0–100 scale), multi-provider JSON chat client (`llm.py`), SQLite schema, and GreenBrew seed data.
- **Round 2 (Web Portal & Knowledge Base)**: Next.js App Router frontend, secure JWT authentication, responsive AppShell, content dashboard table, new content draft creation form, and full Knowledge Base CRUD interface for Rules, Terms, Facts, and Claims.
- **Round 3 (Interactive Review Workspace)**: Two-column live review screen, severity-colored quote highlights, word-level version diffing, interactive finding cards with Accept / Edit / Dismiss workflows, comments thread, and role-gated decision panel with Blocker override checks.
- **Round 4 (Multi-Format Document Extraction)**: Ingestion endpoint (`POST /upload`) supporting PDF (`pdfplumber`), DOCX (`python-docx`), TXT, and images (`pytesseract` OCR). Dominant color extraction via Pillow with WCAG contrast and palette validation against approved brand assets.
- **Round 5 (Interactive Brand Assistant)**: Floating AI chatbot (`BrandAssistant.tsx`) providing guideline Q&A grounded strictly in company rules and facts, inline *"Why this?"* rationale button on finding cards, cited-source chips, and feedback logging.
- **Round 6 (Governance Insights & Analytics)**: Executive insights dashboard (`/insights`) with Recharts bar chart of top violated rules, daily average health score trend line chart, rule gap analysis (high dismissal rates), and expiring claim alerts.
- **Round 7 (Privacy Masking & Approval Reporting)**: PII redaction layer (`privacy.py`) masking personal data before AI processing, AI service audit logging, provider disclosure footer in AppShell, and print-ready one-page compliance approval report (`/content/[id]/report`).
- **Round 8 (Polish, Accessibility & Testing)**: Accessible loading skeletons and empty states across all screens, dismissible error toasts (`Toast.tsx`), explicit input label pairings, visible focus rings on all interactive elements, non-color-alone severity badges, 375px mobile responsiveness, and `test_core.py` test suite.

---

## AI, Libraries, and External Services Used

- **Antigravity**: AI coding assistant used to generate, iterate, and refactor the platform codebase.
- **LLM Providers**: Groq (`llama-3.3-70b-versatile`), Google Gemini (`gemini-2.0-flash`), OpenAI (`gpt-4o-mini`), and xAI Grok (`grok-beta`) accessed via OpenAI-compatible REST APIs with automatic fallback.
- **scikit-learn**: TF-IDF vectorization and cosine similarity retrieval for grounded rule selection.
- **FastAPI & Uvicorn**: High-performance asynchronous Python web API backend.
- **SQLite3**: ACID-compliant zero-configuration relational database.
- **Next.js & React**: Modern React framework utilizing App Router and client/server components.
- **Tailwind CSS**: Utility-first CSS styling strictly following the TruBrand design token palette.
- **Recharts**: Composable charting library for compliance metrics and score trend visualization.
- **pdfplumber**: PDF text and table extraction.
- **python-docx**: Microsoft Word document text parsing.
- **Pillow (PIL)**: Image dimension analysis, dominant palette color quantization, and luminance calculation.
- **pytesseract**: Optical Character Recognition (OCR) for extracting marketing copy from images.
- **PyJWT**: Secure JSON Web Token authentication for role-based access control.
- **pytest**: Automated testing framework for core logic, scoring, and grounding assertions.

---

## Privacy and Human Oversight

- **Proactive PII Masking**: Email addresses, Indian & international phone numbers, and 12-digit identification numbers are sanitized with placeholders (e.g., `[EMAIL_1]`, `[PHONE_1]`) prior to passing text to external AI services, and mapped back upon response.
- **AI Service Transparency**: The platform explicitly displays which AI provider and model generated any assisted finding, audits each AI invocation in `audit.services`, and notifies users via AppShell footer disclosures.
- **Human Authority**: Findings labeled *AI-assisted* serve as advisory recommendations. Human creators, reviewers, and managers make all publication and approval decisions. Approval is strictly blocked if open Blocker findings remain, unless a privileged user provides a documented override justification.

---

## Known Limitations

- **OCR Dependency**: Optical character recognition relies on a local installation of the Google Tesseract OCR binary on the operating system PATH; if absent, an informative warning is returned while preserving image metadata.
- **Single-Node Database**: SQLite is utilized for simple hackathon evaluation and local zero-dependency execution, which is not suited for high-concurrency multi-region deployments.
- **Document Length**: Very large multi-hundred-page documents are bounded by the top-k TF-IDF retrieval window and model context constraints.

---

## Contribution

**Solo Participant**: Aryan built everything.
