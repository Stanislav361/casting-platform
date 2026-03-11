from pydantic import BaseModel, Field, EmailStr
from typing import Optional


class SEmailPasswordLogin(BaseModel):
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password")


class SEmailPasswordRegister(BaseModel):
    email: EmailStr = Field(..., description="Email address")
    password: str = Field(..., min_length=8, max_length=128, description="Password")
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)


class SOTPSend(BaseModel):
    destination: str = Field(..., description="Email or phone number")
    destination_type: str = Field("email", description="'email' or 'sms'")


class SOTPVerify(BaseModel):
    destination: str = Field(..., description="Email or phone number")
    code: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")


class SOTPSendResponse(BaseModel):
    message: str
    destination: str
    code: Optional[str] = None  # only in DEV mode


class SAuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"


class SProfileSwitch(BaseModel):
    profile_id: int = Field(..., description="ID профиля для переключения")


class SCurrentUserData(BaseModel):
    id: int
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone_number: Optional[str] = None
    photo_url: Optional[str] = None
    role: str


class SCurrentUserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)

