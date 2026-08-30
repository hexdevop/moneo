from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{user_id}/avatar")
async def get_avatar(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if user is None or user.avatar_data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Аватар не найден")
    return Response(content=user.avatar_data, media_type=user.avatar_content_type)
