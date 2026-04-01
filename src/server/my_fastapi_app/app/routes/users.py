from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Users
from my_fastapi_app.app.db.session import get_db

router = APIRouter(prefix="/users", tags=["Users"])


class CreateUserDTO(BaseModel):
    fullName: str
    username: str
    email: str


@router.post("/create")
async def post_create_user(
    data: CreateUserDTO,
    db: AsyncSession = Depends(get_db),
):
    """
    Create a new user account.

    - **fullName**: User's full name
    - **username**: Unique username identifier
    - **email**: User's email address

    Returns the created user details.
    """
    result = await db.execute(select(Users).where(Users.username == data.username))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    new_user = Users(
        fullname=data.fullName,
        username=data.username,
        email=data.email,
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return new_user
