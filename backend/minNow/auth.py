import os
from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import (
    authenticate_request,
    AuthenticateRequestOptions,
)
from ninja.security import HttpBearer
from ninja import Router
from django.contrib.auth import get_user_model
import httpx
import logging

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
                        "https://min-now-frontend.vercel.app",
                        "http://localhost:3000",
                        "https://min-now.store",
                        "https://www.min-now.store",
                        "https://min-now-web-app.vercel.app",
                        "https://magnificent-optimism-production.up.railway.app",
                        "https://min-nowweb-app-production.up.railway.app",
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
                        email=user_obj.email_address,
                    )

                # Set the user on the request
                request.user = user
                return token

        except Exception as e:
            logger.debug(f"Authentication error: {str(e)}", exc_info=True)
            logger.debug(f"token verification failed:  {request_state.reason}")

            return None

        return None
