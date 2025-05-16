import os
import httpx
from clerk_backend_api import Clerk
from clerk_backend_api.jwks_helpers import (
    authenticate_request,
    AuthenticateRequestOptions,
)


class ClerkAuth:
    def authenticate(self, request: httpx.Request) -> bool:
        return is_signed_in(request)


def is_signed_in(request: httpx.Request):
    sdk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
    request_state = sdk.authenticate_request(
        request,
        AuthenticateRequestOptions(
            authorized_parties=[
                "https://min-now-frontend.vercel.app",
                "http://localhost:3000",
            ]
        ),
    )
    return request_state.is_signed_in
