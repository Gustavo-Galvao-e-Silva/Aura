from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

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
    db: Session = Depends(get_db),
):
    """
    Create a new user account.

    - **fullName**: User's full name
    - **username**: Unique username identifier
    - **email**: User's email address

    Returns the created user details.
    """
    new_user = Users(
        fullname=data.fullName,
        username=data.username,
        email=data.email,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user
