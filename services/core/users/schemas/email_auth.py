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
    middle_name: Optional[str] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)
    telegram_nick: Optional[str] = Field(None, max_length=100)
    vk_nick: Optional[str] = Field(None, max_length=100)
    max_nick: Optional[str] = Field(None, max_length=100)


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


class SPhoneOTPSend(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20, description="Phone number with country code, e.g. +79001234567")


class SPhoneOTPVerify(BaseModel):
    phone: str = Field(..., min_length=10, max_length=20, description="Phone number")
    code: str = Field(..., min_length=6, max_length=6, description="6-digit OTP code")


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
    middle_name: Optional[str] = None
    phone_number: Optional[str] = None
    photo_url: Optional[str] = None
    telegram_nick: Optional[str] = None
    vk_nick: Optional[str] = None
    max_nick: Optional[str] = None
    telegram_connected: bool = False
    casting_notification_channel: str = "in_app"
    available_casting_notification_channels: list[str] = ["in_app"]
    role: str


class SCurrentUserUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20)
    telegram_nick: Optional[str] = Field(None, max_length=100)
    vk_nick: Optional[str] = Field(None, max_length=100)
    max_nick: Optional[str] = Field(None, max_length=100)
    casting_notification_channel: Optional[str] = Field(None, max_length=20)

