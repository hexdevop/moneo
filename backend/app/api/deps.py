from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import ACCESS_TOKEN_COOKIE, decode_access_token
from app.db.session import get_db
from app.models.user import User

DbSession = AsyncSession


async def get_current_user(
    request: Request, db: AsyncSession = Depends(get_db)
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED, detail="Не авторизован"
    )
    token = request.cookies.get(ACCESS_TOKEN_COOKIE)
    if not token:
        raise credentials_error
    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_error
    user = await db.get(User, user_id)
    if user is None:
        raise credentials_error
    return user
