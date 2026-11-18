@echo off
start "TruBrand backend" cmd /k "cd backend && .venv\Scripts\activate && uvicorn main:app --reload --port 8000"
start "TruBrand frontend" cmd /k "cd frontend && npm run dev"