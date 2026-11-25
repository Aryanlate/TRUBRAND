import os
import hashlib
import datetime
import jwt
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import db

def get_secret():
    return os.getenv("JWT_SECRET", "default_jwt_secret_change_in_env_file_40chars")

def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100000)
    return f"{salt}${dk.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    try:
        salt, dk_hex = hashed.split("$", 1)
        test_dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), 100000)
        return test_dk.hex() == dk_hex
    except Exception:
        return False

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=12)
    }
    return jwt.encode(payload, get_secret(), algorithm="HS256")

def decode_token(token: str) -> dict:
    return jwt.decode(token, get_secret(), algorithms=["HS256"])

security = HTTPBearer()

def get_user(credentials: HTTPAuthorizationCredentials = Security(security)):
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user_id = payload.get("sub")
    users = db.query("SELECT id, name, email, role FROM users WHERE id = ?", (user_id,))
    if not users:
        raise HTTPException(status_code=401, detail="User not found")
    return users[0]

def require_role(*roles):
    def checker(user: dict = Depends(get_user)):
        if user["role"] not in roles:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: Action requires one of the following roles: {', '.join(roles)}. Your current role is '{user['role']}'."
            )
        return user
    return checker
