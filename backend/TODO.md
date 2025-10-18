# Questify Collab Refactor & Migration Plan

## Task Progress

- [x] Analyze requirements
- [ ] Set up FastAPI backend structure (`backend/`)
- [ ] Implement `/auth` routes (register, login, JWT)
- [ ] Implement `/ai` routes (checklist, quiz, suggestions, drafts)
- [ ] Implement `/boards` routes (research, projects, study groups)
- [ ] Migrate database logic from `questify_collab/core/db.py` to backend models
- [ ] Add role-based access control (admin, researcher, student)
- [ ] Connect React/Vite frontend (`react-app/`) to backend API
- [ ] Ensure AI-generated suggestions display correctly in frontend
- [ ] Deploy backend on Render (free tier)
- [ ] Deploy frontend on Netlify (free tier)
- [ ] Test end-to-end functionality (AI, access control, persistence, UI)

## Notes

- Backend: FastAPI with modular routes and JWT authentication
- Database: Supabase (PostgreSQL, free tier)
- Frontend: React/Vite (Netlify)
- AI Integration: Groq API + YouTube API
- Deployment: Render (backend) + Netlify (frontend)
