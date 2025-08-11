import os
from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import (
    authenticate_request,
    AuthenticateRequestOptions,
)
from ninja.security import HttpBearer
from ninja import Router
from django.contrib.auth import get_user_model, authenticate
from django.contrib.auth.backends import BaseBackend
from django.http import JsonResponse
import httpx
import logging
import jwt
from django.conf import settings
from functools import wraps

logger = logging.getLogger("minNow")


class ClerkAuth(HttpBearer):
    def __init__(self):
        super().__init__()
        self.clerk_user_id = None  # Store the authenticated Clerk user id

    def authenticate(self, request: httpx.Request, token):
        # print("Token:", token)

        # Verify the token with Clerk
        sdk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
        try:
            # authenticate request from frontend
            request_state = sdk.authenticate_request(
                request,
                AuthenticateRequestOptions(
                    authorized_parties=[
                        "http://localhost:3000",
                        "https://min-now.store",
                        "https://www.min-now.store",
                        "https://min-now-web-app.vercel.app",
                    ]
                ),
            )

            # logger.debug(f"Request state payload: {request_state.payload}")
            # logger.debug(f"Request state reason: {request_state.reason}")

            # If we get here, the token is valid
            if request_state.is_signed_in:
                # Get the Clerk user ID from the token payload
                clerk_user_id = request_state.payload.get("sub")
                if not clerk_user_id:
                    return None

                self.clerk_user_id = clerk_user_id  # Save user id as a field

                with Clerk(
                    bearer_auth=os.getenv("CLERK_SECRET_KEY"),
                ) as clerk:

                    user_obj = clerk.users.get(user_id=clerk_user_id)
                    if user_obj.email_addresses and len(user_obj.email_addresses) > 0:
                        user_email = user_obj.email_addresses[0].email_address
                    else:
                        user_email = None  # or handle error

                    assert user_email is not None

                    # Handle response
                    # print(f"user email: {user_email}")
                    # print(f"user obj: {user_obj}")
                # Get or create a Django user for this Clerk user
                User = get_user_model()

                try:
                    # Try to get existing user
                    user = User.objects.get(clerk_id=clerk_user_id)
                except User.DoesNotExist:
                    # Create new user if doesn't exist
                    user = User.objects.create_user(
                        username=clerk_user_id,
                        clerk_id=clerk_user_id,
                        email=user_obj.email_addresses[
                            0
                        ].email_address,  # Use the first email address
                    )

                # Set the user on the request
                request.user = user
                return token

        except Exception as e:
            logger.debug(f"Authentication error: {str(e)}", exc_info=True)
            logger.debug(f"token verification failed:  {request_state.reason}")

            return None

        return None


# Development-only authentication class for testing
class DevClerkAuth(HttpBearer):
    def __init__(self):
        super().__init__()
        self.clerk_user_id = None

    def authenticate(self, request: httpx.Request, token):
        # Only use in development
        if os.getenv("PROD") == "True":
            return None

        try:
            # Decode the JWT token using Django's SECRET_KEY, disable time validation for dev
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=["HS256"],
                options={
                    "verify_signature": True,
                    "verify_exp": False,
                    "verify_iat": False,
                    "verify_nbf": False,
                    "verify_aud": False,
                },
            )

            # Verify the token has the expected claims
            if not payload.get("sub"):
                return None

            clerk_user_id = payload.get("sub")
            self.clerk_user_id = clerk_user_id

            # Get or create Django user
            User = get_user_model()

            try:
                # Try to get existing user
                user = User.objects.get(clerk_id=clerk_user_id)
            except User.DoesNotExist:
                # Create new user if doesn't exist
                user = User.objects.create_user(
                    username=clerk_user_id,
                    clerk_id=clerk_user_id,
                    email=f"{clerk_user_id}@dev.local",  # Placeholder email
                )

            # Set the user on the request
            request.user = user
            return token

        except jwt.InvalidTokenError as e:
            logger.debug(f"Development token validation failed: {str(e)}")
            return None
        except Exception as e:
            logger.debug(f"Development authentication error: {str(e)}")
            return None


# New JWT Authentication Backend for Django views (alternative approach)
class JwtAuthBackend(BaseBackend):
    """
    Django authentication backend for JWT tokens from Clerk.
    This provides an alternative approach to the ninja-based authentication.

    USAGE:
    1. Add this backend to AUTHENTICATION_BACKENDS in settings.py
    2. Use the @jwt_required decorator on Django views
    3. Frontend can call these endpoints with Authorization: Bearer <token>
    4. No CSRF tokens required with this approach

    COMPARISON WITH EXISTING APPROACH:
    - Current: Django Ninja + ClerkAuth + CSRF tokens
    - New: Django views + JwtAuthBackend + JWT tokens only
    """

    def authenticate(self, request, **kwargs):
        if "Authorization" not in request.headers:
            return None

        try:
            # Use the same authenticate_request from clerk_backend_api
            request_state = authenticate_request(
                request,
                AuthenticateRequestOptions(
                    secret_key=os.getenv("CLERK_SECRET_KEY"),
                    authorized_parties=[
                        "http://localhost:3000",
                        "https://min-now.store",
                        "https://www.min-now.store",
                        "https://min-now-web-app.vercel.app",
                    ],
                ),
            )

            if not request_state.is_signed_in:
                request.error_message = request_state.message
                return None

            # Get the Clerk user ID from the token payload
            clerk_user_id = request_state.payload.get("sub")
            if not clerk_user_id:
                return None

            # Get or create Django user for this Clerk user
            User = get_user_model()
            try:
                user = User.objects.get(clerk_id=clerk_user_id)
            except User.DoesNotExist:
                # Get user info from Clerk to create Django user
                sdk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
                try:
                    user_obj = sdk.users.get(user_id=clerk_user_id)
                    if user_obj.email_addresses and len(user_obj.email_addresses) > 0:
                        user_email = user_obj.email_addresses[0].email_address
                    else:
                        user_email = f"{clerk_user_id}@clerk.local"

                    user = User.objects.create_user(
                        username=clerk_user_id,
                        clerk_id=clerk_user_id,
                        email=user_email,
                    )
                except Exception as e:
                    logger.debug(f"Error creating user from Clerk data: {str(e)}")
                    # Create user with minimal info
                    user = User.objects.create_user(
                        username=clerk_user_id,
                        clerk_id=clerk_user_id,
                        email=f"{clerk_user_id}@clerk.local",
                    )

            return user

        except Exception as e:
            request.error_message = "Unable to authenticate user"
            logger.debug(f"JWT authentication error: {str(e)}")
            return None

    def get_user(self, user_id):
        """Get user by ID - required by Django authentication backend interface"""
        User = get_user_model()
        try:
            return User.objects.get(clerk_id=user_id)
        except User.DoesNotExist:
            return None


def jwt_required(view_func):
    """
    Decorator for Django views that require JWT authentication.
    Alternative to ninja-based authentication for regular Django views.
    """

    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        user = authenticate(request)
        if not user:
            error = getattr(request, "error_message", "User not authenticated")
            return JsonResponse({"detail": error}, status=401)
        request.user = user
        return view_func(request, *args, **kwargs)

    return _wrapped_view
