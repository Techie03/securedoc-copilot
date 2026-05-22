from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import httpx
import os
from datetime import timedelta
from app.config import settings
from app.database import get_db
from app.crud import crud
from app.schemas.schemas import UserCreate, UserLogin, UserResponse, Token, GitHubOAuthLogin, GoogleOAuthLogin
from app.utils.security import verify_password, create_access_token
from app.dependencies import get_current_user
from app.models.models import User

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_in: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user account.
    """
    existing_user = crud.get_user_by_email(db, email=user_in.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )
    return crud.create_user(db=db, user_in=user_in)

@router.post("/login", response_model=Token)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    """
    Authenticate user and generate access token.
    """
    user = crud.get_user_by_email(db, email=login_in.email)
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.id, "email": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current logged in user details.
    """
    return current_user

@router.post("/github", response_model=Token)
async def github_login(login_data: GitHubOAuthLogin, db: Session = Depends(get_db)):
    """
    Authenticate user via GitHub OAuth.
    """
    client_id = settings.GITHUB_CLIENT_ID
    client_secret = settings.GITHUB_CLIENT_SECRET
    
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="GitHub OAuth is not configured on the server.")

    # 1. Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": login_data.code,
        }
        if login_data.redirect_uri:
            token_payload["redirect_uri"] = login_data.redirect_uri

        token_response = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data=token_payload
        )
        token_data = token_response.json()
        print(f"GitHub OAuth Debug - Token Request Data: {token_payload}")
        print(f"GitHub OAuth Debug - Token Response ({token_response.status_code}): {token_data}")

        if "error" in token_data:
            err_desc = token_data.get('error_description') or token_data.get('error')
            raise HTTPException(status_code=400, detail=f"GitHub OAuth error: {err_desc}")

        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to retrieve access token from GitHub.")

        # 2. Fetch user profile from GitHub
        user_response = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {access_token}"}
        )
        user_data = user_response.json()
        
        # 3. Fetch user email (since email might be private in the user profile)
        email = user_data.get("email")
        if not email:
            emails_response = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"token {access_token}"}
            )
            emails_data = emails_response.json()
            primary_email = next((e["email"] for e in emails_data if e["primary"]), None)
            if not primary_email and len(emails_data) > 0:
                primary_email = emails_data[0]["email"]
            
            email = primary_email

        if not email:
            raise HTTPException(status_code=400, detail="Failed to retrieve an email address from GitHub.")

    # 4. Find or create user
    user = crud.get_user_by_email(db, email=email)
    if not user:
        # Create a new user with a dummy password since they are using SSO
        import secrets
        dummy_password = secrets.token_urlsafe(32)
        user_in = UserCreate(email=email, password=dummy_password, full_name=user_data.get("name", user_data.get("login", "GitHub User")))
        user = crud.create_user(db=db, user_in=user_in)

    # 5. Issue our own JWT
    jwt_token = create_access_token(data={"sub": user.id, "email": user.email})
    return {
        "access_token": jwt_token,
        "token_type": "bearer"
    }

@router.post("/google", response_model=Token)
async def google_login(login_data: GoogleOAuthLogin, db: Session = Depends(get_db)):
    """
    Authenticate user via Google OAuth.
    """
    client_id = settings.GOOGLE_CLIENT_ID
    client_secret = settings.GOOGLE_CLIENT_SECRET
    
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Google OAuth is not configured on the server.")

    # 1. Exchange code for access token
    async with httpx.AsyncClient() as client:
        token_payload = {
            "client_id": client_id,
            "client_secret": client_secret,
            "code": login_data.code,
            "grant_type": "authorization_code",
            "redirect_uri": login_data.redirect_uri
        }
        token_response = await client.post(
            "https://oauth2.googleapis.com/token",
            data=token_payload
        )
        token_data = token_response.json()
        print(f"Google OAuth Debug - Token Request Data: {token_payload}")
        print(f"Google OAuth Debug - Token Response ({token_response.status_code}): {token_data}")

        if "error" in token_data:
            err_desc = token_data.get('error_description') or token_data.get('error')
            raise HTTPException(status_code=400, detail=f"Google OAuth error: {err_desc}")

        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to retrieve access token from Google.")

        # 2. Fetch user profile from Google
        user_response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"}
        )
        user_data = user_response.json()
        
        email = user_data.get("email")

        if not email:
            raise HTTPException(status_code=400, detail="Failed to retrieve an email address from Google.")

    # 3. Find or create user
    user = crud.get_user_by_email(db, email=email)
    if not user:
        # Create a new user with a dummy password since they are using SSO
        import secrets
        dummy_password = secrets.token_urlsafe(32)
        user_in = UserCreate(email=email, password=dummy_password, full_name=user_data.get("name", "Google User"))
        user = crud.create_user(db=db, user_in=user_in)

    # 4. Issue our own JWT
    jwt_token = create_access_token(data={"sub": user.id, "email": user.email})
    return {
        "access_token": jwt_token,
        "token_type": "bearer"
    }
