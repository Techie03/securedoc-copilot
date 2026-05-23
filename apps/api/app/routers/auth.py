from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
import httpx
import smtplib
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings
from app.database import get_db
from app.crud import crud
from datetime import timedelta
from app.schemas.schemas import UserCreate, UserLogin, UserResponse, Token, GitHubOAuthLogin, GoogleOAuthLogin, ForgotPasswordRequest, ResetPasswordRequest, VerifyOTPRequest
from app.utils.security import verify_password, create_access_token, decode_access_token, hash_password
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

def send_smtp_email(to_email: str, subject: str, body_text: str):
    """
    Helper function to send a real email via SMTP.
    """
    if not settings.SMTP_HOST:
        print("[SMTP] SMTP_HOST not configured. Skipping real email delivery.")
        return

    print(f"[SMTP] Preparing to send email to {to_email} via {settings.SMTP_HOST}:{settings.SMTP_PORT}")
    try:
        # Create message container
        msg = MIMEMultipart()
        msg['From'] = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
        msg['To'] = to_email
        msg['Subject'] = subject

        # Attach text body
        msg.attach(MIMEText(body_text, 'plain'))

        # Connect and send
        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10)
        
        # Start TLS if enabled
        if settings.SMTP_TLS:
            server.starttls()
            
        # Login if user credentials provided
        if settings.SMTP_USER and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            
        server.sendmail(msg['From'], to_email, msg.as_string())
        server.quit()
        print(f"[SMTP] Email successfully sent to {to_email}")
    except Exception as e:
        print(f"[SMTP] Error sending email to {to_email}: {e}")

async def send_resend_email(to_email: str, subject: str, body_text: str):
    """
    Helper function to send a real email via Resend API (HTTPS).
    """
    if not settings.RESEND_API_KEY:
        print("[Resend] RESEND_API_KEY not configured. Skipping Resend email delivery.")
        return

    print(f"[Resend] Preparing to send email to {to_email} via Resend HTTP API")
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": settings.SMTP_FROM_EMAIL or "onboarding@resend.dev",
        "to": [to_email],
        "subject": subject,
        "text": body_text
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code >= 200 and response.status_code < 300:
                print(f"[Resend] Email successfully sent to {to_email}. Response: {response.json()}")
            else:
                print(f"[Resend] Failed to send email to {to_email}. Status code: {response.status_code}. Detail: {response.text}")
    except Exception as e:
        print(f"[Resend] Error sending email to {to_email}: {e}")

async def send_brevo_email(to_email: str, subject: str, body_text: str):
    """
    Helper function to send a real email via Brevo API (HTTPS).
    """
    if not settings.BREVO_API_KEY:
        print("[Brevo] BREVO_API_KEY not configured. Skipping Brevo email delivery.")
        return

    print(f"[Brevo] Preparing to send email to {to_email} via Brevo HTTP API")
    url = "https://api.brevo.com/v3/smtp/email"
    headers = {
        "api-key": settings.BREVO_API_KEY,
        "Content-Type": "application/json",
        "Accept": "application/json"
    }
    
    sender_email = settings.BREVO_SENDER_EMAIL or settings.SMTP_FROM_EMAIL or "onboarding@brevo.com"
    payload = {
        "sender": {
            "name": "SecureDoc Copilot",
            "email": sender_email
        },
        "to": [
            {
                "email": to_email
            }
        ],
        "subject": subject,
        "textContent": body_text
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=payload, timeout=10.0)
            if response.status_code >= 200 and response.status_code < 300:
                print(f"[Brevo] Email successfully sent to {to_email}. Response: {response.json()}")
            else:
                print(f"[Brevo] Failed to send email to {to_email}. Status code: {response.status_code}. Detail: {response.text}")
    except Exception as e:
        print(f"[Brevo] Error sending email to {to_email}: {e}")

@router.post("/forgot-password")
def forgot_password(
    forgot_in: ForgotPasswordRequest, 
    request: Request,
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db)
):
    """
    Generate OTP code and send it via Resend or SMTP, returning a verification token.
    """
    user = crud.get_user_by_email(db, email=forgot_in.email)
    otp_verify_token = None
    otp_code = None
    if user:
        # Generate random 6-digit OTP
        otp_code = f"{random.randint(100000, 999999)}"
        otp_hash = hash_password(otp_code)
        
        # Create OTP verify token (expires in 10 minutes)
        otp_verify_token = create_access_token(
            data={"sub": user.id, "email": user.email, "otp_hash": otp_hash, "type": "otp_verify"},
            expires_delta=timedelta(minutes=10)
        )
        
        email_body = f"Hello {user.full_name or 'User'},\n\nYour one-time password (OTP) to reset your password is:\n\n{otp_code}\n\nThis code will expire in 10 minutes.\nIf you did not request this, you can ignore this email."
        
        # Trigger real email in background if Brevo, Resend, or SMTP is configured
        if settings.BREVO_API_KEY:
            background_tasks.add_task(
                send_brevo_email,
                user.email,
                "SecureDoc Copilot - Password Reset OTP",
                email_body
            )
        elif settings.RESEND_API_KEY:
            background_tasks.add_task(
                send_resend_email,
                user.email,
                "SecureDoc Copilot - Password Reset OTP",
                email_body
            )
        elif settings.SMTP_HOST:
            background_tasks.add_task(
                send_smtp_email,
                user.email,
                "SecureDoc Copilot - Password Reset OTP",
                email_body
            )
        
        print("\n" + "="*60)
        print("SIMULATED PASSWORD RESET OTP SENDER")
        print(f"TO:      {user.email}")
        print(f"SUBJECT: SecureDoc Copilot - Password Reset OTP")
        print(f"OTP:     {otp_code}")
        print("="*60 + "\n")
        
    # Only return sandbox OTP to client if no real email sending credentials are configured
    is_email_sending_enabled = bool(settings.BREVO_API_KEY or settings.RESEND_API_KEY or settings.SMTP_HOST)
    return {
        "detail": "If the email is associated with a secure account, an OTP code will be sent shortly.",
        "otp_verify_token": otp_verify_token,
        "sandbox_otp": None if is_email_sending_enabled else otp_code
    }

@router.post("/verify-otp")
def verify_otp(verify_in: VerifyOTPRequest, db: Session = Depends(get_db)):
    """
    Verify the user-provided 6-digit OTP and return a reset token.
    """
    payload = decode_access_token(verify_in.token)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP verification token.")
    
    user_id = payload.get("sub")
    otp_hash = payload.get("otp_hash")
    token_type = payload.get("type")
    
    if not user_id or token_type != "otp_verify" or not otp_hash:
        raise HTTPException(status_code=400, detail="Invalid token type.")
        
    # Verify the user-provided OTP matches the hashed OTP in the token
    if not verify_password(verify_in.otp, otp_hash):
        raise HTTPException(status_code=400, detail="Incorrect OTP code. Please try again.")
        
    user = crud.get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    # Generate the final short-lived reset token (expires in 5 minutes)
    reset_token = create_access_token(
        data={"sub": user.id, "email": user.email, "type": "reset"},
        expires_delta=timedelta(minutes=5)
    )
    
    return {
        "detail": "OTP verified successfully.",
        "reset_token": reset_token
    }

@router.post("/reset-password")
def reset_password(reset_in: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Reset user password using the reset token.
    """
    payload = decode_access_token(reset_in.token)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    
    user_id = payload.get("sub")
    token_type = payload.get("type")
    if not user_id or token_type != "reset":
        raise HTTPException(status_code=400, detail="Invalid token type.")
        
    user = crud.get_user_by_id(db, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    # Update password using new hashed password
    user.hashed_password = hash_password(reset_in.new_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {"detail": "Your password has been successfully reset. Please log in with your new credentials."}
