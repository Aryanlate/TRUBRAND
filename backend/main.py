import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

import db
import llm
from auth import verify_password, create_token, get_user
from seed import seed_if_empty

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    seed_if_empty()
    yield

app = FastAPI(title="TruBrand API", lifespan=lifespan)

origins = list({
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    os.getenv("FRONTEND_URL", "http://localhost:3000")
})

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/login")
def login(req: LoginRequest):
    users = db.query("SELECT * FROM users WHERE email = ?", (req.email,))
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
