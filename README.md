# Data Extraction Tool

Scientific article data extraction web application with GRADE (Grading of Recommendations Assessment, Development and Evaluation) framework assessment.

## Features

- **Dual-panel workspace**: PDF viewer with highlighted source locations alongside extracted data
- **AI-powered extraction**: Uses Claude API to extract structured PICO data (Population, Intervention, Comparator, Outcomes) from scientific articles
- **GRADE framework assessment**: Automated evidence certainty assessment across 5 domains (risk of bias, inconsistency, indirectness, imprecision, publication bias) with 3 upgrade factors
- **Learning system**: Improves extraction accuracy over time through user corrections and imported training data (Word documents)
- **Training contributor control**: Admin-configurable per-user toggle for whose corrections feed into the training pool
- **Methodology references**: Upload GRADE handbooks, Cochrane methods manuals, and other reference PDFs to guide AI assessments
- **Custom extraction templates**: Upload Word documents that define what data to extract and serve as the output layout
- **Multi-study projects**: Group articles into projects for batch extraction and combined Word document export
- **Word export**: Generate GRADE evidence profile tables and Summary of Findings documents

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy (async), PostgreSQL with pgvector, Celery + Redis
- **Frontend**: React 18, TypeScript, Vite, Mantine UI, TanStack Query, Zustand
- **AI**: Anthropic Claude API (native PDF support)
- **PDF Processing**: PyMuPDF for text extraction and coordinate mapping

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Anthropic API key

### Setup

1. Clone and configure:
   ```bash
   cp .env.example .env
   # Edit .env and set your ANTHROPIC_API_KEY
   ```

2. Start services:
   ```bash
   docker compose up -d
   ```

3. Run database migrations:
   ```bash
   docker compose exec backend alembic upgrade head
   ```

4. Access the app at `http://localhost:5173`

5. Register the first admin user via the registration tab on the login page.

### Development (without Docker)

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## Architecture

```
data-extraction-tool/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application
│   │   ├── config.py            # Environment configuration
│   │   ├── database.py          # SQLAlchemy async engine
│   │   ├── models/              # 11 ORM models
│   │   ├── schemas/             # Pydantic request/response schemas
│   │   ├── api/v1/              # REST API routes
│   │   ├── services/            # Business logic
│   │   └── ai/                  # Claude API client, prompts, example selector
│   └── tests/
├── frontend/
│   └── src/
│       ├── api/                 # Typed API client
│       ├── components/          # React components (pdf, extraction, grade, training)
│       ├── pages/               # Route pages
│       ├── store/               # Zustand state management
│       └── types/               # TypeScript type definitions
├── docker-compose.yml
└── storage/                     # Runtime file storage (gitignored)
```

## API Overview

| Endpoint | Description |
|---|---|
| `POST /api/v1/auth/login` | JWT authentication |
| `POST /api/v1/articles/` | Upload PDF article |
| `POST /api/v1/articles/{id}/extract` | Trigger AI extraction |
| `POST /api/v1/extractions/{id}/grade` | Run GRADE assessment |
| `POST /api/v1/extractions/{id}/corrections` | Submit correction (feeds training) |
| `POST /api/v1/export/extractions/{id}/word` | Export to Word |
| `POST /api/v1/export/projects/{id}/word` | Export entire project to Word |
| `POST /api/v1/training/import-word-doc` | Import Word doc as training data |
| `POST /api/v1/methodology/references` | Upload methodology PDF |
| `POST /api/v1/templates/` | Upload extraction template |
| `POST /api/v1/projects/{id}/extract-all` | Batch extract all articles in project |
