"""
MinNow API - Items and Checkups Management

This module implements the Django-Ninja API for the MinNow application.
All endpoints are protected with Upstash rate limiting.

"""

from ninja import Router, Schema
from ninja.errors import HttpError
from typing import List, Optional, Dict
from pydantic import RootModel, BaseModel
from .models import ItemType, ItemStatus, TimeSpan, OwnedItem
from .services import ItemService, CheckupService
from datetime import datetime
from uuid import UUID
from dotenv import load_dotenv
import os
import logging
from .addItemAgent import run_agent
from django.contrib.auth import authenticate
import jwt
from django.conf import settings
from datetime import datetime, timedelta
from django.middleware.csrf import get_token
from upstash_ratelimit import Ratelimit, FixedWindow
from upstash_redis import Redis

log = logging.getLogger(__name__)
load_dotenv()
prod = os.getenv("PROD") == "True"
log.info(f"API Environment: {'Production' if prod else 'Development'}")

# Initialize Upstash Rate Limiter
try:
    print("Initializing Upstash rate limiter...")
    redis = Redis.from_env()
    rate_limiter = Ratelimit(
        redis=redis,
        limiter=FixedWindow(max_requests=10, window=10),
        prefix="api_rate_limit",
    )
    log.info("Upstash rate limiter initialized successfully")
except Exception as e:
    log.warning(
        f"Failed to initialize Upstash rate limiter: {e}. Rate limiting will be disabled."
    )
    rate_limiter = None

# Use when testing swagger docs in dev. Testing frontend dev with this running will result in invalid alg for dev tokens
# if prod:
#     from backend.minNow.auth import ClerkAuth
# else:
#     from minNow.auth import DevClerkAuth as ClerkAuth
if prod:
    from backend.minNow.auth import ClerkAuth
else:
    from minNow.auth import ClerkAuth


# Main router for production routes
router = Router()

# Development-only router (will be conditionally added)
dev_router = Router()


# Rate limiting helper function
def check_rate_limit(request):
    """
    Helper function to check rate limit for a request.
    Returns tuple: (is_allowed: bool, error_response: dict or None)
    """
    if rate_limiter is None:
        return True, None

    # Get user ID from request
    user_id = None
    if hasattr(request, "user") and request.user:
        if hasattr(request.user, "id"):
            user_id = str(request.user.id)
        elif hasattr(request.user, "clerk_user_id"):
            user_id = str(request.user.clerk_user_id)

    # Fallback to IP address if no user ID available
    if not user_id:
        user_id = request.META.get(
            "HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "unknown")
        )
        if "," in user_id:
            user_id = user_id.split(",")[0].strip()

    try:
        response = rate_limiter.limit(user_id)
        if not response.allowed:
            reset_time = response.reset
            return False, {
                "detail": f"Rate limit exceeded. Try again after {reset_time} seconds."
            }
        return True, None
    except Exception as e:
        log.warning(f"Rate limiting check failed: {e}. Allowing request to proceed.")
        return True, None


# convert django models to pydantic schemas


class TimeSpanSchema(Schema):
    years: int
    months: int
    days: int
    description: str

    @staticmethod
    def from_orm(obj: TimeSpan) -> "TimeSpanSchema":
        return TimeSpanSchema(
            years=obj.years,
            months=obj.months,
            days=obj.days,
            description=obj.description,
        )


class CheckupSchema(Schema):
    id: int
    last_checkup_date: datetime
    checkup_interval_months: int
    is_checkup_due: bool


class BadgeProgressSchema(Schema):
    tier: str
    name: str
    description: str
    min: int
    unit: Optional[str] = None
    progress: float
    achieved: bool


class OwnedItemSchema(Schema):
    id: UUID
    name: str
    picture_url: str
    item_type: str
    status: str
    item_received_date: datetime
    last_used: datetime
    ownership_duration: TimeSpanSchema
    last_used_duration: TimeSpanSchema
    keep_badge_progress: List[BadgeProgressSchema]
    ownership_duration_goal_months: int
    ownership_duration_goal_progress: float

    @staticmethod
    def from_orm(obj) -> "OwnedItemSchema":
        return OwnedItemSchema(
            id=obj.id,
            name=obj.name,
            picture_url=obj.picture_url,
            item_type=obj.item_type,
            status=obj.status,
            item_received_date=obj.item_received_date,
            last_used=obj.last_used,
            ownership_duration=TimeSpanSchema.from_orm(obj.ownership_duration),
            last_used_duration=TimeSpanSchema.from_orm(obj.last_used_duration),
            keep_badge_progress=obj.keep_badge_progress,
            ownership_duration_goal_months=obj.ownership_duration_goal_months,
            ownership_duration_goal_progress=obj.ownership_duration_goal_progress,
        )


class OwnedItemCreateSchema(Schema):
    name: str
    picture_url: str
    item_type: ItemType
    status: ItemStatus = ItemStatus.KEEP
    item_received_date: datetime
    last_used: datetime
    ownership_duration_goal_months: int = 12


class OwnedItemUpdateSchema(Schema):
    name: Optional[str] = None
    picture_url: Optional[str] = None
    item_type: Optional[ItemType] = None
    item_received_date: Optional[datetime] = None
    last_used: Optional[datetime] = None
    status: Optional[ItemStatus] = None
    ownership_duration_goal_months: Optional[int] = None


class CheckupCreateSchema(Schema):
    interval_months: int = 1
    checkup_type: str


class CheckupUpdateSchema(Schema):
    interval_months: int


class DonatedBadgesResponseSchema(RootModel[Dict[str, List[BadgeProgressSchema]]]):
    pass


@router.get("/csrf-token", response={200: dict, 429: dict})
def get_csrf_token(request):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    token = get_token(request)
    return 200, {"token": token}


@router.post("/items", response={201: OwnedItemSchema, 429: dict}, auth=ClerkAuth())
def create_item(request, payload: OwnedItemCreateSchema):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    user = request.user
    item = ItemService.create_item(
        user=user,
        name=payload.name,
        picture_url=payload.picture_url,
        item_type=payload.item_type,
        status=payload.status,
        item_received_date=payload.item_received_date,
        last_used=payload.last_used,
    )
    return 201, OwnedItemSchema.from_orm(item)


@router.get(
    "/items/{item_id}",
    response={200: OwnedItemSchema, 404: dict, 429: dict},
    auth=ClerkAuth(),
)
def get_item(request, item_id: UUID):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    item = ItemService.get_item(item_id)
    if not item:
        return 404, {"detail": "Item not found"}
    return 200, OwnedItemSchema.from_orm(item)


@router.put(
    "/items/{item_id}",
    response={200: OwnedItemSchema, 404: dict, 429: dict},
    auth=ClerkAuth(),
)
def update_item(request, item_id: UUID, payload: OwnedItemUpdateSchema):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    update_data = payload.dict(exclude_unset=True)
    item = ItemService.update_item(item_id, **update_data)
    if not item:
        return 404, {"detail": "Item not found"}
    return 200, OwnedItemSchema.from_orm(item)


@router.delete(
    "/items/{item_id}", response={200: dict, 404: dict, 429: dict}, auth=ClerkAuth()
)
def delete_item(request, item_id: UUID):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    success = ItemService.delete_item(item_id)
    if not success:
        return 404, {"detail": "Item not found"}
    return 200, {"detail": "Item deleted successfully"}


@router.get(
    "/items", response={200: List[OwnedItemSchema], 429: dict}, auth=ClerkAuth()
)
def list_items(
    request, status: Optional[ItemStatus] = None, item_type: Optional[ItemType] = None
):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    user = request.user  # This should be set by ClerkAuth

    # Filter items by the authenticated user
    items = ItemService.get_items_for_user(user, status=status, item_type=item_type)
    return [OwnedItemSchema.from_orm(item) for item in items]


@router.get(
    "/badges/donated",
    response={200: DonatedBadgesResponseSchema, 429: dict},
    auth=ClerkAuth(),
)
def get_donated_badges(request):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    user = request.user
    donated_badges = OwnedItem.donated_badge_progress(user)
    return donated_badges


@router.post(
    "/checkups", response={201: CheckupSchema, 400: dict, 429: dict}, auth=ClerkAuth()
)
def create_checkup(request, payload: CheckupCreateSchema):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    # Check if user already has a checkup of this type
    existing_checkup = CheckupService.get_checkups_by_type(
        request.user, payload.checkup_type
    ).first()
    if existing_checkup:
        return 400, {"detail": f"User already has a {payload.checkup_type} checkup"}

    checkup = CheckupService.create_checkup(
        user=request.user,
        interval_months=payload.interval_months,
        checkup_type=payload.checkup_type,
    )
    return 201, checkup


@router.get(
    "/checkups/{checkup_id}",
    response={200: CheckupSchema, 404: dict, 429: dict},
    auth=ClerkAuth(),
)
def get_checkup(request, checkup_id: int):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    checkup = CheckupService.get_checkup(checkup_id)
    if not checkup or checkup.user != request.user:
        return 404, {"detail": "Checkup not found"}
    return 200, checkup


@router.put(
    "/checkups/{checkup_id}/interval",
    response={200: CheckupSchema, 404: dict, 429: dict},
    auth=ClerkAuth(),
)
def update_checkup_interval(request, checkup_id: int, payload: CheckupUpdateSchema):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    checkup = CheckupService.get_checkup(checkup_id)
    if not checkup or checkup.user != request.user:
        return 404, {"detail": "Checkup not found"}
    checkup = CheckupService.update_checkup_interval(
        checkup_id, payload.interval_months
    )
    return 200, checkup


@router.post(
    "/checkups/{checkup_id}/complete",
    response={200: CheckupSchema, 404: dict, 429: dict},
    auth=ClerkAuth(),
)
def complete_checkup(request, checkup_id: int):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    checkup = CheckupService.get_checkup(checkup_id)
    if not checkup or checkup.user != request.user:
        return 404, {"detail": "Checkup not found"}
    checkup = CheckupService.complete_checkup(checkup_id)
    return 200, checkup


# Add this new schema
class CheckupTypeSchema(Schema):
    type: str


@router.get(
    "/checkups", response={200: List[CheckupSchema], 429: dict}, auth=ClerkAuth()
)
def list_checkups(request, type: Optional[str] = None):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    if type:
        checkups = CheckupService.get_checkups_by_type(
            user=request.user, checkup_type=type
        )
    else:
        checkups = CheckupService.get_all_checkups(user=request.user)
    return checkups


class EmailResponseSchema(Schema):
    checkup_type: str
    status: str
    recipient_email: str
    recipient_username: str


## can't add /checkups to url route bc of url matches for django url resolver stuff idk about
# This endpoint uses AnyMail with MailerSend to send checkup reminder emails in both development and production.
# This is a development-only endpoint for testing email functionality
@dev_router.post(
    "/send-test-email",
    response={200: List[EmailResponseSchema], 429: dict},
    auth=ClerkAuth(),
)
def send_test_checkup_email(request):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    user = request.user

    results = CheckupService.check_and_send_due_emails(user)
    return [EmailResponseSchema(**result) for result in results]


class AgentPromptSchema(Schema):
    prompt: str


@dev_router.post("/agent-add-item", response={200: dict, 429: dict}, auth=ClerkAuth())
def agent_add_item(request, payload: AgentPromptSchema):
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    auth_header = request.headers.get("Authorization")
    jwt_token = None
    if auth_header and auth_header.startswith("Bearer "):
        jwt_token = auth_header.split(" ")[1]
    result = run_agent(payload.prompt, jwt_token)
    return result


# Schema for batch agent add item
class AgentBatchPromptsSchema(Schema):
    prompts: Dict[str, str]


@router.post("/agent-add-item-batch", response={200: dict, 429: dict}, auth=ClerkAuth())
def agent_add_item_batch(request, payload: AgentBatchPromptsSchema):
    """
    Accepts a dict of prompts, runs the agent for each, and returns a dict of results.
    """
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        return 429, error_response

    auth_header = request.headers.get("Authorization")
    jwt_token = None
    if auth_header and auth_header.startswith("Bearer "):
        jwt_token = auth_header.split(" ")[1]
    results = {}
    run_agent(payload.prompts, jwt_token)
    return results


# Development-only route to get Clerk JWT token for testing
# extra security check to ensure this is only used in development, in case debug is set to True in production
if not prod:

    class ClerkLoginRequest(Schema):
        # clerk doesn't have api to handle pass auth
        # password: str
        email: str

    class ClerkLoginResponse(Schema):
        jwt_token: str
        user_id: str
        email: str
        message: str = "Use this JWT token in Swagger Authorize button"

    @dev_router.post(
        "/auth/clerk-login", response={200: ClerkLoginResponse, 401: dict, 429: dict}
    )
    def clerk_login(request, data: ClerkLoginRequest):
        """
        Development-only endpoint to get a Clerk JWT token for testing.
        This creates a session and then gets a JWT token for the user.
        """
        is_allowed, error_response = check_rate_limit(request)
        if not is_allowed:
            return 429, error_response

        try:
            # Initialize Clerk SDK
            import os
            from clerk_backend_api import Clerk

            sdk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))

            # Find user by email
            with sdk as clerk:
                # Get all users and find by email
                users = clerk.users.list()
                target_user = None

                for user in users:
                    if user.email_addresses:
                        for email_obj in user.email_addresses:
                            if email_obj.email_address.lower() == data.email.lower():
                                target_user = user
                                break
                        if target_user:
                            break

                if not target_user:
                    return 401, {"detail": "User not found with this email"}

                # Create a session for the user
                session = clerk.sessions.create(
                    request={
                        "user_id": target_user.id,
                    }
                )

                # Try different token generation methods
                print("Testing different token generation methods...")

                # Method 1: Regular session token
                session_token = clerk.sessions.create_token(
                    session_id=session.id,
                    expires_in_seconds=None,
                )
                print(f"Session token: {session_token.jwt}")

                # Method 2: Testing token
                testing_token = clerk.testing_tokens.create()
                print(f"Testing token: {testing_token.token}")

                # Method 3: Template token with different template names
                template_names = [
                    "mn-template",
                    "min-now-frontend.vercel.app",
                    "http://localhost:3000",
                    "http://localhost:8000",
                ]
                template_token = None

                for template_name in template_names:
                    try:
                        template_token = clerk.sessions.create_token_from_template(
                            session_id=session.id,
                            template_name=template_name,
                            expires_in_seconds=None,
                        )
                        print(
                            f"Template token with '{template_name}': {template_token.jwt}"
                        )
                        break
                    except Exception as e:
                        print(f"Failed with template '{template_name}': {e}")

                # Test all tokens with ClerkAuth
                from minNow.auth import ClerkAuth
                from django.test import RequestFactory
                import httpx

                tokens_to_test = [
                    ("session_token", session_token.jwt),
                    ("testing_token", testing_token.token),
                    ("template_token", template_token.jwt if template_token else None),
                ]

                working_token = None

                for token_name, token in tokens_to_test:
                    if not token:
                        continue

                    print(f"\nTesting {token_name}...")

                    # Create a mock request with the token
                    factory = RequestFactory()
                    mock_request = factory.get("/api/items")
                    mock_request.headers = {"Authorization": f"Bearer {token}"}

                    # Convert Django request to httpx request for ClerkAuth
                    httpx_request = httpx.Request(
                        method=mock_request.method,
                        url=str(mock_request.build_absolute_uri()),
                        headers=mock_request.headers,
                    )

                    # Test authentication with detailed debugging
                    auth = ClerkAuth()

                    # Add detailed debugging to see what's happening
                    try:
                        from clerk_backend_api import Clerk
                        from clerk_backend_api.jwks_helpers import (
                            authenticate_request,
                            AuthenticateRequestOptions,
                        )
                        import os

                        sdk = Clerk(bearer_auth=os.getenv("CLERK_SECRET_KEY"))
                        request_state = sdk.authenticate_request(
                            httpx_request,
                            AuthenticateRequestOptions(
                                authorized_parties=[
                                    "http://localhost:3000",
                                    "https://min-now.store",
                                    "https://www.min-now.store",
                                    "https://min-now-web-app.vercel.app",
                                ]
                            ),
                        )

                        print(
                            f"Request state is_signed_in: {request_state.is_signed_in}"
                        )
                        print(f"Request state reason: {request_state.reason}")
                        print(f"Request state payload: {request_state.payload}")

                        result = auth.authenticate(httpx_request, token)

                        print(f"Auth result for {token_name}: {result}")
                        if result:
                            print(f"✅ {token_name} is valid!")
                            working_token = token
                            break
                        else:
                            print(f"❌ {token_name} failed")

                    except Exception as e:
                        print(f"Error testing {token_name}: {str(e)}")
                        continue

                if working_token:
                    return 200, ClerkLoginResponse(
                        jwt_token=working_token,
                        user_id=target_user.id,
                        email=data.email,
                        message=f"Use this JWT token in Swagger Authorize button (working token found)",
                    )
                else:
                    # Development-only bypass: Create a token that works with a modified auth approach
                    print("\nCreating development bypass token...")
                    try:
                        import jwt
                        from datetime import datetime, timedelta

                        # Create a JWT that will work with a development auth class
                        # No timing claims needed since we disable time validation in dev
                        payload = {
                            "sub": target_user.id,
                            "aud": "http://localhost:8000",
                            "iss": "https://teaching-sturgeon-25.clerk.accounts.dev",
                        }

                        # Use Django's SECRET_KEY to sign the JWT
                        dev_jwt = jwt.encode(
                            payload, settings.SECRET_KEY, algorithm="HS256"
                        )

                        print(f"Development JWT created: {dev_jwt}")

                        return 200, ClerkLoginResponse(
                            jwt_token=dev_jwt,
                            user_id=target_user.id,
                            email=data.email,
                            message="Use this development JWT token in Swagger Authorize button (requires dev auth class)",
                        )

                    except Exception as e:
                        print(f"Error creating development JWT: {str(e)}")
                        return 401, {"detail": "Failed to create development token"}

        except Exception as e:
            log.error(f"Error creating Clerk JWT: {str(e)}")
            return 401, {"detail": f"JWT creation failed: {str(e)}"}
