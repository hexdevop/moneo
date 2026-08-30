import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.security import (
    ACCESS_TOKEN_COOKIE,
    create_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    UserLogin,
    UserOut,
    UserRegister,
    UserUpdate,
)
from app.services.email import send_password_reset_email

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()

RESET_TOKEN_EXPIRE_MINUTES = 30
COOKIE_MAX_AGE = 60 * 60 * 24 * 7
MAX_AVATAR_SIZE = 2 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}


def _set_auth_cookie(response: Response, user_id: int) -> None:
    token = create_access_token(user_id)
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=token,
        httponly=True,
        samesite="lax",
        secure=settings.cookie_secure,
        max_age=COOKIE_MAX_AGE,
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, response: Response, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(User).where(or_(User.email == data.email, User.username == data.username))
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь с таким email или username уже существует")

    user = User(
        email=data.email,
        username=data.username,
        password_hash=hash_password(data.password),
        name=data.name,
        base_currency=data.base_currency.upper(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    _set_auth_cookie(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
async def login(data: UserLogin, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(or_(User.email == data.login, User.username == data.login))
    )
    user = result.scalar_one_or_none()
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный логин или пароль")

    _set_auth_cookie(response, user.id)
    return user


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(ACCESS_TOKEN_COOKIE)
    return {"detail": "Вы вышли из системы"}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(
    data: UserUpdate, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "Поддерживаются только изображения JPEG, PNG или WebP"
        )
    data = await file.read()
    if len(data) > MAX_AVATAR_SIZE:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Файл слишком большой (максимум 2 МБ)")

    user.avatar_data = data
    user.avatar_content_type = file.content_type
    await db.commit()
    await db.refresh(user)
    return user


@router.delete("/me/avatar", response_model=UserOut)
async def delete_avatar(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    user.avatar_data = None
    user.avatar_content_type = None
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/change-password")
async def change_password(
    data: PasswordChange, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Текущий пароль неверен")
    user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"detail": "Пароль изменён"}


@router.post("/forgot-password")
async def forgot_password(data: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()
    if user is not None:
        user.reset_token = secrets.token_urlsafe(32)
        user.reset_token_expires = datetime.now(timezone.utc) + timedelta(
            minutes=RESET_TOKEN_EXPIRE_MINUTES
        )
        await db.commit()
        send_password_reset_email(user.email, user.reset_token)
    # Always return the same response so we don't leak which emails are registered.
    return {"detail": "Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля"}


@router.post("/reset-password")
async def reset_password(data: PasswordResetConfirm, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.reset_token == data.token))
    user = result.scalar_one_or_none()
    now = datetime.now(timezone.utc)
    if (
        user is None
        or user.reset_token_expires is None
        or user.reset_token_expires.replace(tzinfo=timezone.utc) < now
    ):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ссылка недействительна или истекла")

    user.password_hash = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    await db.commit()
    return {"detail": "Пароль успешно изменён"}
