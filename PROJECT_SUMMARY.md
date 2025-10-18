# Questify Collab - Full Stack App

AI-powered personalized course generator + Reddit-style community hub.

- Backend: FastAPI (Python)
- Database/Auth: Supabase (PostgreSQL + Auth)
- AI: Groq (Llama 3)
- Frontend: Vite + React + Chakra UI

This document explains setup, configuration, running locally, and the main flows.

---

## 1) Prerequisites

- Python 3.10+ (3.11 recommended)
- Node.js 18+ and npm
- Supabase project (URL, anon key, service role key, JWT secret)
- Groq account/API key

---

## 2) Environment Variables

### Backend (server-only secrets)

File: backend/.env (copy from backend/.env.example)

Required:
- SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
- SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
- SUPABASE_JWT_SECRET=YOUR_SUPABASE_JWT_SECRET
- GROQ_API_KEY=YOUR_GROQ_API_KEY
- CORS_ORIGINS=http://localhost:5173

Notes:
- SUPABASE_JWT_SECRET is found in Supabase Dashboard > Settings > API.
- Service Role Key is also on that page; handle with care (server-side only).

### Frontend (public, safe to expose)

File: frontend/.env (copy from frontend/.env.example)

Recommended:
- VITE_API_BASE_URL=http://localhost:8000
- VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
- VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
- VITE_APP_NAME=Questify Collab

---

## 3) Database Schema (Supabase)

Run SQL migration in your Supabase project's SQL editor:

- backend/db/001_init.sql

It creates:
- public.users (profile + reputation_score)
- public.posts
- public.answers
- indexes for performance

We do not set triggers here; the backend inserts a row into public.users after signup.

---

## 4) Backend Setup (FastAPI)

Within a terminal:

1) Create .env from example:
- copy backend/.env.example backend/.env
- fill all placeholders

2) Install and run:

Windows PowerShell (recommended):

- python -m venv backend/.venv
- backend/.venv/Scripts/Activate.ps1
- pip install -r backend/requirements.txt
- uvicorn app.main:app --app-dir backend --reload --port 8000

cmd.exe alternative:

- python -m venv backend\\.venv
- backend\\.venv\\Scripts\\activate.bat
- pip install -r backend\\requirements.txt
- uvicorn app.main:app --app-dir backend --reload --port 8000

The server runs at:
- http://localhost:8000

Open API docs:
- http://localhost:8000/docs

CORS is configured to allow http://localhost:5173 by default.

### Backend source map

- backend/app/main.py
  - FastAPI app, CORS, router includes (auth, ai, community)

- backend/core/config.py
  - Loads settings from env, provides CORS origins and AI model name

- backend/core/database.py
  - Supabase client initialization (service role key)

- backend/core/security.py
  - JWT verification using SUPABASE_JWT_SECRET; dependency get_current_user

- backend/core/groq_client.py
  - GroqService wrapper; structured prompts for blueprint, lesson, quiz

- backend/routes/auth.py
  - POST /auth/signup (Supabase Auth sign_up + insert into public.users)
  - POST /auth/login (Sign-in; returns access_token + user profile)

- backend/routes/ai.py
  - POST /ai/generate-blueprint (protected)
  - POST /ai/generate-lesson (protected)
  - POST /ai/generate-quiz (protected)

- backend/routes/community.py
  - POST /community/posts (protected)
  - GET /community/posts/{topic}
  - GET /community/post/{post_id}
  - POST /community/answers (protected)
  - PUT /community/answers/{answer_id}/mark-solution (protected; increments answer author reputation by +10)

---

## 5) Frontend Setup (Vite + React + Chakra UI)

1) Create .env from example:
- copy frontend/.env.example frontend/.env
- set VITE_API_BASE_URL=http://localhost:8000
- set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY

2) Install and run:

- cd frontend
- npm install   (already executed by scaffolding; safe to run again)
- npm run dev

The app runs at:
- http://localhost:5173

---

## 6) Authentication Flow

We use Supabase-issued JWTs:
- /auth/signup: registers new user via Supabase; backend also inserts into public.users
- /auth/login: returns access_token; frontend stores it and sends Bearer token for protected endpoints

Protected endpoints require header:
- Authorization: Bearer YOUR_ACCESS_TOKEN

---

## 7) AI Endpoints (Groq, JSON responses)

All return JSON as specified by the prompts.

- POST /ai/generate-blueprint
  Body:
  {
    "goal_type": "Course",
    "topic": "Python",
    "level": "Beginner",
    "objective": "Learn basics and build a small project"
  }

- POST /ai/generate-lesson
  Body:
  {
    "course_title": "Intro to Python",
    "module_title": "Variables and Types",
    "level": "Beginner"
  }

- POST /ai/generate-quiz
  Body:
  {
    "lesson_content": { ... } // the JSON object from /generate-lesson
  }

If GROQ_API_KEY is missing, requests will fail; ensure backend/.env is set.

---

## 8) Community Endpoints

- POST /community/posts
  Body:
  {
    "topic": "Python",
    "title": "How do list comprehensions work?",
    "content": "I am confused by the syntax. Examples?"
  }

- GET /community/posts/{topic}
  Returns array of posts for a topic

- GET /community/post/{post_id}
  Returns:
  {
    "post": { ... },
    "answers": [ ... ]
  }

- POST /community/answers
  Body:
  {
    "post_id": 123,
    "content": "Use [expr for x in arr if cond] ..."
  }

- PUT /community/answers/{answer_id}/mark-solution
  Only the post author can mark. This:
  - sets is_helpful_solution: true
  - increments answer author's reputation_score by +10 in public.users

---

## 9) Frontend Pages and Flow

- /signup: Create account (if Supabase email confirmation enabled, token may not return; user prompted to check email)

- /login: Obtain access token, redirects to /planner

- /planner (GoalPlannerPage):
  Form to input Goal Type, Topic, Level, Objective
  On submit calls /ai/generate-blueprint; navigates to Blueprint

- /blueprint (CourseBlueprintPage):
  Displays course_title and modules; click a module to navigate to Lesson

- /lesson (LessonPage):
  Calls /ai/generate-lesson; renders explanation + code examples + summary
  Buttons: Start Quiz; "Collaborate on this Topic" → /community/{topic}

- /quiz (QuizPage):
  Calls /ai/generate-quiz; shows questions; after submit, shows results and explanations
  For incorrect answers, shows "See Related Discussions" link

- /community/{topic} (CommunityHubPage):
  Lists posts for topic; form to create post; click post to view details

- /post/{post_id} (PostDetailPage):
  Shows post and answers; form to add answer
  If current user is post author, show "Mark as Helpful Solution" per answer
  Helpful solution styled with green border

Header:
- Displays app name; auth links or logout; Planner and Community shortcuts

Auth Guard:
- Protected routes redirect to /login if no token present

---

## 10) Running Locally

1) Database
- In Supabase SQL editor, run backend/db/001_init.sql

2) Backend
- Activate venv
- pip install -r backend/requirements.txt
- uvicorn app.main:app --app-dir backend --reload --port 8000

3) Frontend
- cd frontend
- npm install
- npm run dev

Open:
- Frontend: http://localhost:5173
- Backend Docs: http://localhost:8000/docs

---

## 11) Common Issues

- 401 Unauthorized on AI/Community endpoints
  - Ensure you logged in; frontend must send Authorization: Bearer token
  - Verify SUPABASE_JWT_SECRET in backend/.env matches Supabase > Settings > API

- 500 on AI endpoints
  - Ensure GROQ_API_KEY is set and valid
  - Rate limits: consider retrying or lowering calls in dev

- CORS errors
  - Ensure CORS_ORIGINS includes http://localhost:5173 in backend/.env

- Supabase profiles not created
  - Backend inserts into public.users during /auth/signup; if using out-of-band signup, add rows manually or create a trigger.

---

## 12) Production Notes (Future)

- Use environment variables and secrets management (no service role in client)
- Add RLS policies if client-side DB access is introduced
- Add validations, rate limiting, request logging, and observability
- Consider adding pagination for posts and answers
- Add unit/integration tests under backend/tests

---

## 13) Scripts and Commands

Backend:
- uvicorn app.main:app --app-dir backend --reload --port 8000

Frontend:
- cd frontend && npm run dev

---

All components are scaffolded. Provide your Supabase and Groq keys in the .env files to run the full flow locally.