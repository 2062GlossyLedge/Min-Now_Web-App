import os
from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import (
    AuthenticateRequestOptions,
)
from ninja.security import HttpBearer
from django.contrib.auth import get_user_model

import httpx
import logging
import jwt
from django.conf import settings

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
