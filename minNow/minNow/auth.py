import os
from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import verify_token
from ninja.security import HttpBearer
from ninja import Router
from django.contrib.auth import get_user_model


class ClerkAuth(HttpBearer):
    def authenticate(self, request, token):
        # Verify the token with Clerk
        sdk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
        try:
            # Verify the token instead of using authenticate_request
            payload = verify_token(token, sdk.jwks_client)

            # If we get here, the token is valid
            if payload:
                # Get the Clerk user ID from the token payload
                clerk_user_id = payload.get("sub")
                if not clerk_user_id:
                    return None

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
                        email=payload.get("email", ""),
                    )

                # Set the user on the request
                request.user = user
                return token

        except Exception as e:
            print(f"Authentication error: {e}")
            return None

        return None
