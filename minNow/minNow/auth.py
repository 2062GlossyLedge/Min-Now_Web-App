from ninja import Router, Schema
from ninja.security import HttpBearer
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from typing import Optional
from ninja.errors import HttpError

User = get_user_model()


# Secure for this token?
class AuthBearer(HttpBearer):
    def authenticate(self, request, token):
        if token == "supersecret":
            return token


class UserSchema(Schema):
    email: str
    password: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: str


class LoginSchema(Schema):
    username: str
    password: str


class TokenSchema(Schema):
    access_token: str
    token_type: str = "bearer"


class ErrorSchema(Schema):
    detail: str


class PasswordResetSchema(Schema):
    email: str


class PasswordResetConfirmSchema(Schema):
    token: str
    new_password: str


auth = Router()


@auth.post("/register", response={201: TokenSchema, 400: ErrorSchema})
def register(request, payload: UserSchema):
    if User.objects.filter(email=payload.email).exists():
        raise HttpError(400, "Email already exists")

    user = User.objects.create_user(
        email=payload.email,
        password=payload.password,
        first_name=payload.first_name,
        last_name=payload.last_name,
        username=payload.username,
    )

    return 201, {"access_token": "supersecret", "token_type": "bearer"}


@auth.post("/login", response={200: TokenSchema, 401: ErrorSchema})
def login(request, payload: LoginSchema):
    user = authenticate(request, username=payload.username, password=payload.password)
    if not user:
        raise HttpError(401, "Invalid credentials")

    return {"access_token": "supersecret", "token_type": "bearer"}


@auth.post("/password-reset", response={200: dict, 400: ErrorSchema})
def password_reset(request, payload: PasswordResetSchema):
    try:
        user = User.objects.get(email=payload.email)
        token = default_token_generator.make_token(user)

        # In a real application, you would send an email with the reset link
        reset_link = f"{settings.FRONTEND_URL}/reset-password/{token}"
        send_mail(
            "Password Reset Request",
            f"Click the link to reset your password: {reset_link}",
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
        return {"message": "Password reset email sent"}
    except User.DoesNotExist:
        raise HttpError(400, "User not found")


@auth.post("/password-reset/confirm", response={200: dict, 400: ErrorSchema})
def password_reset_confirm(request, payload: PasswordResetConfirmSchema):
    try:
        user = User.objects.get(email=payload.email)
        if not default_token_generator.check_token(user, payload.token):
            raise HttpError(400, "Invalid token")

        user.set_password(payload.new_password)
        user.save()
        return {"message": "Password has been reset successfully"}
    except User.DoesNotExist:
        raise HttpError(400, "User not found")


@auth.get("/me", response={200: UserSchema, 401: ErrorSchema}, auth=AuthBearer())
def get_current_user(request):
    if not request.auth:
        raise HttpError(401, "Unauthorized")

    user = request.user
    return {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }
