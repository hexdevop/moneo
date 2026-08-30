from pydantic import BaseModel, EmailStr, Field

from app.models.enums import ThemePreference


class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)
    base_currency: str = Field(default="USD", min_length=3, max_length=3)


class UserLogin(BaseModel):
    login: str  # email or username
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    name: str
    base_currency: str
    theme_preference: ThemePreference
    has_avatar: bool

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    base_currency: str | None = Field(default=None, min_length=3, max_length=3)
    theme_preference: ThemePreference | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)
