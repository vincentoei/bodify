# Bodify

Multi-agent AI health partner that adapts nutrition, fitness, and recovery plans to a user's real life.

Bodify is built for contexts where doctor-to-patient ratios are low and chronic conditions like diabetes, hypertension, and obesity require daily decision-making that a single consultation cannot cover. It uses a council of specialist AI agents, coordinated by a central agent, to produce personalized, safe, and actionable health plans.

## What it does

- **AI specialist council** — medical, nutrition, fitness, behavioral, and progress agents each contribute structured recommendations based on the user's profile, goals, daily logs, and durable memories.
- **Coordinator synthesis** — a coordinator agent resolves conflicts and emits a final plan with calorie targets, macros, meal options, workout options, phases, and an adaptive calendar.
- **Daily logging** — users log meals, workouts, hydration, sleep, and setbacks in plain text; the system parses them into structured entries and updates the calendar.
- **Recovery adaptation** — users report disruptions like travel, injury, illness, or social events; the system emits targeted calendar mutations and durable facts so the plan adapts over time.
- **What-if simulation** — users run lightweight scenarios (e.g., "What if I miss three workouts this week?") and see projected impact without regenerating the full plan.
- **Speech-to-text** — microphone input on daily log, recovery, and simulate pages transcribes audio via Deepgram for users who prefer speaking over typing.

## Architecture

Bodify is split into a FastAPI backend and a Next.js frontend.

The backend centers on a **LangGraph** workflow. Each graph invocation routes the user request through the relevant specialist agents, then through the coordinator. The coordinator produces Pydantic-typed decisions (`CoordinatorDecision`, `RecoveryDecision`, `SimulationSummary`) that the API layer converts into database writes and calendar mutations.

Key design choices:

- **Specialist separation** — no single prompt tries to be a doctor, nutritionist, trainer, and therapist simultaneously.
- **Structured output** — every agent emits JSON matching a Pydantic schema, making LLM reasoning safe to act on.
- **Durable memory** — facts extracted from recovery messages are persisted with optional TTLs, so adaptations survive beyond the current chat.
- **RAG grounding** — medical, nutrition, exercise, and behavioral guidelines are stored in a vector DB and retrieved to ground agent recommendations.

## Tech stack

- **Frontend:** Next.js 14, React 18, TypeScript 5, Tailwind CSS, shadcn/ui, Framer Motion, GSAP, Recharts, Valibot
- **Backend:** FastAPI, Uvicorn, Pydantic, Pydantic Settings, SQLAlchemy, Alembic, PostgreSQL, psycopg2-binary, python-jose
- **Relational Database and Auth:** Supabase
- **Vector Database:** ChromaDB
- **RAG:** medical guidelines for diabetes, hypertension, exercise, and behavior
- **AI / LLM:** LangGraph, LangChain, LangChain OpenAI, OpenRouter (`meta-llama/llama-3.3-70b-instruct`)
- **Multi-Agent System:** specialist agents (medical, nutrition, fitness, behavioral, progress), coordinator agent, fact extractor
- **Speech-to-Text:** Deepgram SDK
- **Deployment:** Docker, Railway

## Project structure

```
.
├── backend/                 # FastAPI API
│   ├── app/
│   │   ├── agents/          # Multi-agent orchestration
│   │   │   ├── coordinator.py
│   │   │   ├── fact_extractor.py
│   │   │   ├── llm.py
│   │   │   ├── graph/       # LangGraph nodes and state
│   │   │   └── specialists/ # medical, nutrition, fitness, behavioral, progress
│   │   ├── core/            # auth, config, supabase client
│   │   ├── models/          # SQLAlchemy models + Pydantic schemas
│   │   ├── routers/         # API endpoints
│   │   └── services/        # calendar, RAG retriever
│   ├── alembic/             # Database migrations
│   ├── data/guidelines/     # RAG source documents
│   ├── scripts/             # init_db, load_guidelines
│   └── tests/               # Backend tests
├── frontend/                # Next.js 14 app
│   ├── app/                 # Routes
│   │   ├── dashboard/       # home, calendar, recovery, simulate, help
│   │   ├── onboarding/
│   │   ├── signin/
│   │   └── signup/
│   ├── components/          # UI components and dashboard widgets
│   ├── lib/                   # API clients, utilities, validation
│   └── public/                # Static assets
└── skills/                  # Markdown skills for AI agent workflows
```

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase, OpenRouter, Deepgram, and ChromaDB credentials

# Run migrations
alembic upgrade head

# Optional: load RAG guidelines
python scripts/load_guidelines.py

# Start server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL, anon key, and backend API URL

npm run dev
```

The frontend runs on `http://localhost:3000` and the backend on `http://localhost:8000`.

## Environment variables

### Backend `.env`

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# AI Provider (OpenRouter)
OPENROUTER_API_KEY=your-openrouter-key
OPENROUTER_MODEL=meta-llama/llama-3.3-70b-instruct
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1

# STT
DEEPGRAM_API_KEY=your-deepgram-key

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8001
CHROMA_COLLECTION=bodify_guidelines

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/bodify

# App
APP_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Frontend `.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## API overview

| Router | Prefix | Purpose |
|--------|--------|---------|
| Auth | `/auth` | Sign up, sign in, token refresh, user profile |
| Onboarding | `/onboarding` | Submit profile and generate initial plan |
| Plan | `/plan` | Regenerate plan, fetch current plan |
| Calendar | `/calendar` | Get and mutate scheduled events |
| Log | `/log` | Submit daily free-form logs and parse them |
| Simulate | `/simulate` | Run preset and custom what-if simulations |
| STT | `/stt` | Transcribe audio to text |
| Recovery | `/recovery` | Submit recovery messages and adapt the plan |

## Agent workflow

1. A request enters the coordinator graph with the user's profile, context, and event type.
2. The graph invokes the relevant specialist agents in parallel.
3. Each specialist emits a `SpecialistOutput` with recommendations, confidence, evidence, and rationale.
4. The coordinator agent reviews the outputs, identifies conflicts, resolves them in favor of safety and sustainability, and emits a final decision.
5. The API layer writes the decision to the database, updates the calendar, and returns a response to the frontend.

For recovery flows, the fact extractor first pulls durable facts from the user's message; the coordinator then uses those facts plus upcoming calendar events to produce targeted `CalendarMutation` objects.

## RAG guidelines

The `backend/data/guidelines/` directory contains markdown guidelines for:

- `behavior.md` — behavioral psychology and adherence strategies
- `diabetes.md` — diabetes-specific nutrition and exercise guidance
- `exercise.md` — general exercise safety and progression
- `hypertension.md` — hypertension-specific nutrition and activity guidance

Run `python scripts/load_guidelines.py` to embed these into ChromaDB so the agents can retrieve them during plan generation.

## Deployment

The backend includes a `Dockerfile`, `railway.toml`, and `Procfile` for Railway deployment. The frontend can be deployed to any Next.js-compatible host (Vercel, Netlify, self-hosted, etc.).

Set production environment variables on both services and run `alembic upgrade head` before starting the backend.

## Testing

Run backend tests with:

```bash
cd backend
pytest
```

The frontend uses `npm run lint` for linting and `npm run build` for build verification.

## License

MIT
