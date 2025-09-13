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

# Rate limiting imports
from upstash_ratelimit import Ratelimit, FixedWindow
from upstash_redis import Redis

logger = logging.getLogger("minNow")

# Initialize Rate Limiter for JWT authentication
try:
    logger.debug("Initializing Upstash rate limiter for JWT auth...")
    redis = Redis.from_env()
    jwt_rate_limiter = Ratelimit(
        redis=redis,
        limiter=FixedWindow(max_requests=100, window=60),
        prefix="jwt_rate_limit",
    )
    logger.info("JWT rate limiter initialized successfully")
except Exception as e:
    logger.warning(
        f"Failed to initialize JWT rate limiter: {e}. Rate limiting will be disabled."
    )
    jwt_rate_limiter = None


def check_jwt_rate_limit(request):
    """
    Helper function to check rate limit for JWT authenticated requests.
    Returns tuple: (is_allowed: bool, error_response: dict or None)
    """
    if jwt_rate_limiter is None:
        return True, None

    # Get user ID from request
    user_id = None
    if hasattr(request, "user") and request.user and hasattr(request.user, "clerk_id"):
        user_id = str(request.user.clerk_id)

    # Fallback to IP address if no user ID available
    if not user_id:
        user_id = request.META.get(
            "HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown")
        )
        if "," in user_id:
            user_id = user_id.split(",")[0].strip()

    try:
        response = jwt_rate_limiter.limit(user_id)
        print("API requests remaining", response.remaining)
        if not response.allowed:
            reset_time = response.reset
            return False, {
                "detail": f"Rate limit exceeded. Try again after {reset_time} seconds.",
                "reset_time": reset_time,
            }
        return True, None
    except Exception as e:
        logger.warning(
            f"JWT rate limiting check failed: {e}. Allowing request to proceed."
        )
        return True, None


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
    Decorator for Django views that require JWT authentication and rate limiting.
    Alternative to ninja-based authentication for regular Django views.

    Rate limiting: 20 requests per 50 seconds per user/IP.
    """

    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        # First check authentication
        user = authenticate(request)
        if not user:
            error = getattr(request, "error_message", "User not authenticated")
            return JsonResponse({"detail": error}, status=401)
        request.user = user

        # Then check rate limiting
        is_allowed, error_response = check_jwt_rate_limit(request)
        if not is_allowed:
            return JsonResponse(error_response, status=429)

        return view_func(request, *args, **kwargs)

    return _wrapped_view
