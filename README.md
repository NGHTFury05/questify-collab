# Questify Collab

AI-powered personalized course generator with a collaborative, Reddit-style community hub.

- Backend: FastAPI (Python)
- Database/Auth: Supabase (PostgreSQL + Auth)
- AI: Groq (Llama 3)
- Frontend: Vite + React + Chakra UI

---

## Table of Contents
- Quickstart (Local)
- Prerequisites
- Repository Structure
- Environment Variables
- Database Setup (Supabase)
- Backend Setup (FastAPI)
- Frontend Setup (Vite + React)
- Features
- API Endpoints
- Frontend Routes
- Docker (optional)
- Testing
- Troubleshooting
- Contributing
- License

---

## Quickstart (Local)

1) Supabase: create a project and run the SQL in backend/db/001_init.sql
2) Backend:
   - python -m venv backend/.venv
   - backend/.venv/Scripts/Activate.ps1  (Windows PowerShell)
   - pip install -r backend/requirements.txt
   - copy backend/.env.example backend/.env and fill values
   - uvicorn app.main:app --app-dir backend --reload --port 8000
3) Frontend:
   - cd frontend
   - cp .env.example .env  (or create .env from README section below)
   - npm install
   - npm run dev

Open:
- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

---

## Prerequisites

- Python 3.10+ (3.11 recommended)
- Node.js 18+ and npm
- Supabase project (URL, anon key, service role key, JWT secret)
- Groq account/API key

---

## Repository Structure

questify-collab/
├─ backend/
│  ├─ app/ (FastAPI app entry) → backend/app/main.py
│  ├─ core/ (config, db, security, ai client)
│  ├─ db/ (SQL migrations)
│  ├─ models/ (pydantic models)
│  ├─ routes/ (auth, ai, community)
│  ├─ scripts/ (utility scripts)
│  └─ tests/ (backend tests)
└─ frontend/ (Vite + React + Chakra UI)

Key files:
- backend app: backend/app/main.py
- settings: backend/core/config.py
- routes: backend/routes/{auth,ai,community}.py
- migration: backend/db/001_init.sql
- frontend entry: frontend/src/main.jsx

---

## Environment Variables

Create these files by copying the provided .env.example files and filling values.

Backend: backend/.env
- SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
- SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
- SUPABASE_JWT_SECRET=YOUR_SUPABASE_JWT_SECRET
- GROQ_API_KEY=YOUR_GROQ_API_KEY
- CORS_ORIGINS=http://localhost:5173
- API_NAME=Questify Collab API
- API_VERSION=1.0.0
- AI_MODEL=llama-3.1-8b-instant
- JWT_LEEWAY=60

Frontend: frontend/.env
- VITE_API_BASE_URL=http://localhost:8000
- VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
- VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
- VITE_APP_NAME=Questify Collab

Notes:
- Do not expose Service Role key on the client. Keep backend/.env server-only.
- SUPABASE_JWT_SECRET: Supabase Dashboard → Settings → API.
- If you use a non-default frontend port, add it to CORS_ORIGINS in backend/.env.

---

## Database Setup (Supabase)

1) In your Supabase project's SQL editor, run:
   - backend/db/001_init.sql
   - (optional) backend/db/002_community_quality.sql if present for quality tweaks
2) We rely on the backend to insert profile rows into public.users during signup.

---

## Backend Setup (FastAPI)

Windows PowerShell:
- python -m venv backend/.venv
- backend/.venv/Scripts/Activate.ps1
- pip install -r backend/requirements.txt
- copy backend/.env.example backend/.env
- uvicorn app.main:app --app-dir backend --reload --port 8000

Windows cmd.exe:
- python -m venv backend\.venv
- backend\.venv\Scripts\activate.bat
- pip install -r backend\requirements.txt
- copy backend\.env.example backend\.env
- uvicorn app.main:app --app-dir backend --reload --port 8000

API docs: http://localhost:8000/docs
Health check: http://localhost:8000/health

---

## Frontend Setup (Vite + React)

- cd frontend
- cp .env.example .env  (or create one with values above)
- npm install
- npm run dev

The app will be available at http://localhost:5173

---

## Features

AI-assisted learning:
- Generate structured course blueprints by goal type, topic, level, and objective.
- Generate focused lessons per module with explanations and examples.
- Generate quizzes from lesson content with instant feedback.

Community hub:
- Topic-based posts, answers, and solution marking.
- Helpful solutions award reputation to authors.
- Post detail view with threaded answers.

Collaboration UI:
- Planner, Blueprint, Lesson, Quiz flows.
- Community pages per topic and post detail.
- Prototype chat and friends panes (UI present; server integration may be WIP).

Auth:
- Sign up and log in via Supabase; backend returns access_token (JWT).
- Protected routes in the frontend redirect to /login when unauthenticated.

---

## API Endpoints (selected)

Auth:
- POST /auth/signup
- POST /auth/login

AI (requires Authorization: Bearer <token>):
- POST /ai/generate-blueprint
- POST /ai/generate-lesson
- POST /ai/generate-quiz

Community:
- POST /community/posts  (protected)
- GET /community/posts/{topic}
- GET /community/post/{post_id}
- POST /community/answers  (protected)
- PUT /community/answers/{answer_id}/mark-solution  (protected)

Open API spec: http://localhost:8000/docs

---

## Frontend Routes

- /signup
- /login
- /planner
- /blueprint
- /lesson
- /quiz
- /community/{topic}
- /post/{post_id}
- /friends (prototype)
- /chat (prototype)

---

## Docker (optional)

Backend:
- docker build -t questify-backend ./backend
- docker run --env-file ./backend/.env -p 8000:8000 questify-backend

Frontend:
- docker build -t questify-frontend ./frontend
- docker run --env-file ./frontend/.env -p 5173:5173 questify-frontend

Ensure CORS_ORIGINS in backend/.env matches your frontend URL.

---

## Testing

Backend tests (if pytest installed):
- pytest backend/tests -q

---

## Troubleshooting

401 Unauthorized (AI/Community):
- Ensure you are logged in and sending Authorization: Bearer <token>.
- SUPABASE_JWT_SECRET in backend/.env must match Supabase Settings → API.

500 on AI endpoints:
- Ensure GROQ_API_KEY is set and valid.
- Watch rate limits in development.

CORS errors:
- Include http://localhost:5173 in CORS_ORIGINS (backend/.env).

Profiles not created:
- Backend inserts into public.users during /auth/signup. If signing up out-of-band, insert rows manually or add a trigger.

---

## Contributing

- Fork, branch, implement, test, open PR.
- See backend/tests for patterns. Linting and formatting are recommended.

## License

MIT License. See LICENSE file at repository root.
