"""
MinNow API - Items and Checkups Management

This module implements the Django-Ninja API for the MinNow application.
All endpoints are protected with Upstash rate limiting and Clerk JWT authentication.

API Routes (accessible at /api/):
=================================
Items:
  GET    /items                      - List items with optional status/item_type filters
  POST   /items                      - Create a new item
  GET    /items/stats                - Get user item statistics (count, limit, remaining)
  GET    /items/{item_id}            - Get specific item by UUID
  PUT    /items/{item_id}            - Update specific item
  DELETE /items/{item_id}            - Delete specific item

Badges:
  GET    /badges/donated             - Get donated badge progress

Checkups:
  GET    /checkups                   - List checkups with optional type filter
  POST   /checkups                   - Create a new checkup
  GET    /checkups/{checkup_id}      - Get specific checkup
  PUT    /checkups/{checkup_id}/interval - Update checkup interval
  POST   /checkups/{checkup_id}/complete - Mark checkup as complete

Email & Notifications:
  POST   /send-test-email            - Send test checkup email

AI Agent:
  POST   /agent-add-item             - AI agent item creation
  POST   /agent-add-item-batch       - Batch AI agent item creation

User Preferences:
  POST   /sync-preferences           - Sync user email preferences and checkup intervals

Authentication:
  GET    /clerk-jwt                  - Test JWT authentication and get user info with CSRF token

  All endpoints require JWT authentication via Authorization header:
  Authorization: Bearer <clerk_jwt_token>

Rate Limiting:
  100 requests per 60 seconds per user/IP

"""

from ninja import Router, Schema
from ninja.errors import HttpError
from typing import List, Optional, Dict
from pydantic import RootModel
from .models import ItemType, ItemStatus, TimeSpan, OwnedItem
from .services import ItemService, CheckupService
from datetime import datetime
from uuid import UUID
from dotenv import load_dotenv
import os
import logging
from .addItemAgent import run_agent
from django.core.exceptions import ValidationError
import jwt
from django.conf import settings
from datetime import datetime
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
        limiter=FixedWindow(max_requests=100, window=60),
        prefix="api_rate_limit",
    )
    log.info("Upstash rate limiter initialized successfully")
except Exception as e:
    log.warning(
        f"Failed to initialize Upstash rate limiter: {e}. Rate limiting will be disabled."
    )
    rate_limiter = None

# Use when testing swagger docs in dev. Allows authenticating in swagger
# Uses HS256 dev token
from minNow.auth import DevClerkAuth as ClerkAuth

# Use this for production with real Clerk JWTs
# Uses RS256 Clerk tokens
# if prod:
#     from backend.minNow.auth import ClerkAuth
# else:
#     from minNow.auth import ClerkAuth


# ============================================================================
# API Routers
# ============================================================================
# Main router for production routes - accessible at /api/
# These routes use Django Ninja with ClerkAuth() for JWT authentication
router = Router()

# Development-only router (will be conditionally added) - accessible at /api/dev/
dev_router = Router()


# Rate limiting helper function
def check_rate_limit(request):
    """
    Helper function to check rate limit for a request.
    Rate limiting: 20 requests per 50 seconds per user/IP.
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
    current_location_id: Optional[UUID] = None
    location_path: Optional[str] = None
    location_updated_at: Optional[datetime] = None

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
            current_location_id=obj.current_location_id,
            location_path=obj.current_location.full_path if obj.current_location else None,
            location_updated_at=obj.location_updated_at,
        )


class OwnedItemCreateSchema(Schema):
    name: str
    picture_url: str
    item_type: ItemType
    status: ItemStatus = ItemStatus.KEEP
    item_received_date: datetime
    last_used: datetime
    ownership_duration_goal_months: int = 12
    current_location_id: Optional[UUID] = None


class OwnedItemUpdateSchema(Schema):
    name: Optional[str] = None
    picture_url: Optional[str] = None
    item_type: Optional[ItemType] = None
    item_received_date: Optional[datetime] = None
    last_used: Optional[datetime] = None
    status: Optional[ItemStatus] = None
    ownership_duration_goal_months: Optional[int] = None
    current_location_id: Optional[UUID] = None


class CheckupCreateSchema(Schema):
    interval_months: int = 1
    checkup_type: str


class CheckupUpdateSchema(Schema):
    interval_months: int


class DonatedBadgesResponseSchema(RootModel[Dict[str, List[BadgeProgressSchema]]]):
    pass


# Schema for batch agent add item
class AgentBatchPromptsSchema(Schema):
    prompts: Dict[str, str]


class EmailResponseSchema(Schema):
    checkup_type: str
    status: str
    recipient_email: str
    recipient_username: str


# Add this new schema
class CheckupTypeSchema(Schema):
    type: str


# Location Schemas
class LocationSchema(Schema):
    id: UUID
    slug: str
    display_name: str
    full_path: str
    parent_id: Optional[UUID] = None
    level: int
    item_count: int = 0
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_orm(obj) -> "LocationSchema":
        from .models import Location
        return LocationSchema(
            id=obj.id,
            slug=obj.slug,
            display_name=obj.display_name,
            full_path=obj.full_path,
            parent_id=obj.parent_id,
            level=obj.level,
            item_count=obj.items.count() if hasattr(obj, 'items') else 0,
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


class LocationCreateSchema(Schema):
    display_name: str
    parent_id: Optional[UUID] = None


class LocationUpdateSchema(Schema):
    display_name: str


class LocationMoveSchema(Schema):
    parent_id: Optional[UUID] = None


class LocationTreeNode(Schema):
    id: str
    slug: str
    display_name: str
    full_path: str
    level: int
    parent_id: Optional[str] = None
    children: List['LocationTreeNode'] = []


class LocationSearchResultSchema(Schema):
    id: UUID
    slug: str
    display_name: str
    full_path: str
    level: int
    item_count: int = 0
    items: List[str] = []

    @staticmethod
    def from_orm(obj) -> "LocationSearchResultSchema":
        return LocationSearchResultSchema(
            id=obj.id,
            slug=obj.slug,
            display_name=obj.display_name,
            full_path=obj.full_path,
            level=obj.level,
            item_count=obj.items.count() if hasattr(obj, 'items') else 0,
            items=[item.name for item in obj.items.all()[:10]] if hasattr(obj, 'items') else [],
        )


# Location schemas
class LocationSchema(Schema):
    """Response schema for location with item count"""
    id: UUID
    slug: str
    display_name: str
    full_path: str
    parent_id: Optional[UUID] = None
    level: int
    item_count: int
    created_at: datetime
    updated_at: datetime

    @staticmethod
    def from_orm(obj) -> "LocationSchema":
        return LocationSchema(
            id=obj.id,
            slug=obj.slug,
            display_name=obj.display_name,
            full_path=obj.full_path,
            parent_id=obj.parent_id,
            level=obj.level,
            item_count=obj.items.count(),
            created_at=obj.created_at,
            updated_at=obj.updated_at,
        )


class LocationCreateSchema(Schema):
    """Schema for creating a new location"""
    display_name: str
    parent_id: Optional[UUID] = None


class LocationUpdateSchema(Schema):
    """Schema for updating location (only display_name can be updated)"""
    display_name: str


class LocationMoveSchema(Schema):
    """Schema for moving location to new parent"""
    parent_id: Optional[UUID] = None


class LocationTreeNode(Schema):
    """Recursive schema for location tree structure"""
    id: str
    slug: str
    display_name: str
    full_path: str
    level: int
    parent_id: Optional[str] = None
    children: List['LocationTreeNode'] = []


# Enable forward reference for recursive schema
LocationTreeNode.model_rebuild()


class LocationSearchResultSchema(Schema):
    """Schema for location search results with item names"""
    id: UUID
    slug: str
    display_name: str
    full_path: str
    level: int
    item_count: int
    item_names: List[str]

    @staticmethod
    def from_orm(obj) -> "LocationSearchResultSchema":
        items = obj.items.all()
        return LocationSearchResultSchema(
            id=obj.id,
            slug=obj.slug,
            display_name=obj.display_name,
            full_path=obj.full_path,
            level=obj.level,
            item_count=items.count(),
            item_names=[item.name for item in items[:10]],  # Limit to first 10
        )


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

    # auth dev get route to fetch an auth user's items
    @dev_router.get(
        "/auth/items",
        response=List[OwnedItemSchema],
        auth=ClerkAuth(),
        tags=["Development"],
    )
    def auth_items(
        request, status: Optional[str] = None, item_type: Optional[str] = None
    ):
        """
        Development-only endpoint to test JWT authentication and fetching items for the authenticated user.
        Requires a valid JWT token in the Authorization header.

        Query parameters:
        - status: Optional filter by item status (keep, give, donate)
        - item_type: Optional filter by item type (clothing, book, toy, etc.)
        """
        # Convert string parameters to enum values if provided
        status_enum = None
        if status:
            try:
                status_enum = ItemStatus(status)
            except ValueError:
                raise HttpError(400, "Invalid status value")

        item_type_enum = None
        if item_type:
            try:
                item_type_enum = ItemType(item_type)
            except ValueError:
                raise HttpError(400, "Invalid item_type value")

        # Get items for the authenticated user
        user = request.user
        items = ItemService.get_items_for_user(
            user, status=status_enum, item_type=item_type_enum
        )

        # Convert to OwnedItemSchema and return (Ninja handles serialization)
        return [OwnedItemSchema.from_orm(item) for item in items]

    @dev_router.post(
        "/auth/clerk-login",
        response={200: ClerkLoginResponse, 401: dict, 429: dict},
        auth=None,
        tags=["Development"],
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
                print(f" Users in Clerk: {[user.email_addresses[0].email_address for user in users if user.email_addresses]}")
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


# ============================================================================
# Django Ninja REST API Routes (Production)
# ============================================================================
# These routes replace the Django view functions with Django Ninja routes for
# cleaner API handling and automatic OpenAPI/Swagger documentation


# Items Endpoints
@router.get("/items", response=List[OwnedItemSchema], auth=ClerkAuth(), tags=["Items"])
def list_items(request, status: Optional[str] = None, item_type: Optional[str] = None):
    """
    Get all items for the authenticated user with optional filters.
    Rate limit: 100 requests per 60 seconds

    Query parameters:
    - status: Optional filter by item status (keep, give, donate)
    - item_type: Optional filter by item type (clothing, book, toy, etc.)
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    # Convert string parameters to enum values if provided
    status_enum = None
    if status:
        try:
            status_enum = ItemStatus(status)
        except ValueError:
            raise HttpError(400, "Invalid status value")

    item_type_enum = None
    if item_type:
        try:
            item_type_enum = ItemType(item_type)
        except ValueError:
            raise HttpError(400, "Invalid item_type value")

    # Get items for the authenticated user
    user = request.user
    items = ItemService.get_items_for_user(
        user, status=status_enum, item_type=item_type_enum
    )

    return [OwnedItemSchema.from_orm(item) for item in items]


@router.post("/items", response=OwnedItemSchema, auth=ClerkAuth(), tags=["Items"])
def create_item(request, data: OwnedItemCreateSchema):
    """
    Create a new item for the authenticated user.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    user = request.user
    try:
        item = ItemService.create_item(
            user=user,
            name=data.name,
            picture_url=data.picture_url,
            item_type=data.item_type,
            status=data.status,
            item_received_date=data.item_received_date,
            last_used=data.last_used,
            ownership_duration_goal_months=data.ownership_duration_goal_months,
        )
        return OwnedItemSchema.from_orm(item)
    except ValidationError as e:
        raise HttpError(400, str(e))


@router.get("/items/stats", auth=ClerkAuth(), tags=["Items"])
def get_user_item_stats(request):
    """
    Get user item statistics including count, limit, and remaining slots.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    user = request.user
    stats = ItemService.get_user_item_stats(user)
    return stats


@router.get(
    "/items/{item_id}", response=OwnedItemSchema, auth=ClerkAuth(), tags=["Items"]
)
def get_item(request, item_id: UUID):
    """
    Get a specific item by ID.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    item = ItemService.get_item(item_id)
    if not item:
        raise HttpError(404, "Item not found")

    return OwnedItemSchema.from_orm(item)


@router.put(
    "/items/{item_id}", response=OwnedItemSchema, auth=ClerkAuth(), tags=["Items"]
)
def update_item(request, item_id: UUID, data: OwnedItemUpdateSchema):
    """
    Update a specific item.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    # Prepare update data (filter out None values)
    update_data = {k: v for k, v in data.dict().items() if v is not None}

    item = ItemService.update_item(item_id, **update_data)
    if not item:
        raise HttpError(404, "Item not found")

    return OwnedItemSchema.from_orm(item)


@router.delete("/items/{item_id}", auth=ClerkAuth(), tags=["Items"])
def delete_item(request, item_id: UUID):
    """
    Delete a specific item.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    success = ItemService.delete_item(item_id)
    if not success:
        raise HttpError(404, "Item not found")

    return {"detail": "Item deleted successfully"}


# Badges Endpoints
@router.get(
    "/badges/donated",
    response=DonatedBadgesResponseSchema,
    auth=ClerkAuth(),
    tags=["Badges"],
)
def get_donated_badges(request):
    """
    Get donated badge progress for the authenticated user.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    user = request.user
    donated_badges = OwnedItem.donated_badge_progress(user)
    return donated_badges


# Checkups Endpoints
@router.get(
    "/checkups", response=List[CheckupSchema], auth=ClerkAuth(), tags=["Checkups"]
)
def list_checkups(request, type: Optional[str] = None):
    """
    Get checkups for the authenticated user with optional type filter.
    Rate limit: 100 requests per 60 seconds

    Query parameters:
    - type: Optional filter by checkup type (keep, give)
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    user = request.user

    if type:
        checkups = CheckupService.get_checkups_by_type(user=user, checkup_type=type)
    else:
        checkups = CheckupService.get_all_checkups(user=user)

    return [
        CheckupSchema(
            id=checkup.id,
            last_checkup_date=checkup.last_checkup_date,
            checkup_interval_months=checkup.checkup_interval_months,
            is_checkup_due=checkup.is_checkup_due,
        )
        for checkup in checkups
    ]


@router.post("/checkups", response=CheckupSchema, auth=ClerkAuth(), tags=["Checkups"])
def create_checkup(request, data: CheckupCreateSchema):
    """
    Create a new checkup for the authenticated user.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    user = request.user

    # Check if user already has a checkup of this type
    existing_checkup = CheckupService.get_checkups_by_type(
        user, data.checkup_type
    ).first()
    if existing_checkup:
        raise HttpError(400, f"User already has a {data.checkup_type} checkup")

    checkup = CheckupService.create_checkup(
        user=user,
        interval_months=data.interval_months,
        checkup_type=data.checkup_type,
    )

    return CheckupSchema(
        id=checkup.id,
        last_checkup_date=checkup.last_checkup_date,
        checkup_interval_months=checkup.checkup_interval_months,
        is_checkup_due=checkup.is_checkup_due,
    )


@router.get(
    "/checkups/{checkup_id}",
    response=CheckupSchema,
    auth=ClerkAuth(),
    tags=["Checkups"],
)
def get_checkup(request, checkup_id: int):
    """
    Get a specific checkup by ID.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    checkup = CheckupService.get_checkup(checkup_id)
    if not checkup or checkup.user != request.user:
        raise HttpError(404, "Checkup not found")

    return CheckupSchema(
        id=checkup.id,
        last_checkup_date=checkup.last_checkup_date,
        checkup_interval_months=checkup.checkup_interval_months,
        is_checkup_due=checkup.is_checkup_due,
    )


@router.put(
    "/checkups/{checkup_id}/interval",
    response=CheckupSchema,
    auth=ClerkAuth(),
    tags=["Checkups"],
)
def update_checkup_interval(request, checkup_id: int, data: CheckupUpdateSchema):
    """
    Update checkup interval for a specific checkup.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    # Get the checkup and verify ownership
    checkup = CheckupService.get_checkup(checkup_id)
    if not checkup or checkup.user != request.user:
        raise HttpError(404, "Checkup not found")

    # Update the checkup
    checkup = CheckupService.update_checkup_interval(checkup_id, data.interval_months)

    return CheckupSchema(
        id=checkup.id,
        last_checkup_date=checkup.last_checkup_date,
        checkup_interval_months=checkup.checkup_interval_months,
        is_checkup_due=checkup.is_checkup_due,
    )


@router.post(
    "/checkups/{checkup_id}/complete",
    response=CheckupSchema,
    auth=ClerkAuth(),
    tags=["Checkups"],
)
def complete_checkup(request, checkup_id: int):
    """
    Mark a checkup as complete.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    # Get the checkup and verify ownership
    checkup = CheckupService.get_checkup(checkup_id)
    if not checkup or checkup.user != request.user:
        raise HttpError(404, "Checkup not found")

    # Complete the checkup
    checkup = CheckupService.complete_checkup(checkup_id)

    return CheckupSchema(
        id=checkup.id,
        last_checkup_date=checkup.last_checkup_date,
        checkup_interval_months=checkup.checkup_interval_months,
        is_checkup_due=checkup.is_checkup_due,
    )


# Email Endpoints
@router.post(
    "/send-test-email",
    response=List[EmailResponseSchema],
    auth=ClerkAuth(),
    tags=["Email & Notifications"],
)
def send_test_checkup_email(request):
    """
    Send test checkup email to the authenticated user.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    user = request.user
    results = CheckupService.check_and_send_due_emails(user)

    return [
        EmailResponseSchema(
            checkup_type=result["checkup_type"],
            status=result["status"],
            recipient_email=result["recipient_email"],
            recipient_username=result["recipient_username"],
        )
        for result in results
    ]


# AI Agent Endpoints
class AgentAddItemRequest(Schema):
    prompt: str


@router.post("/agent-add-item", auth=ClerkAuth(), tags=["AI Agent"])
def agent_add_item(request, data: AgentAddItemRequest):
    """
    Add an item using AI agent.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    # Get JWT token from Authorization header
    auth_header = request.META.get("HTTP_AUTHORIZATION")
    jwt_token = None
    if auth_header and auth_header.startswith("Bearer "):
        jwt_token = auth_header.split(" ")[1]

    # Convert prompt to expected format
    prompt_data = {"prompt": data.prompt}

    # Run the agent
    result = run_agent(prompt_data, jwt_token)
    return result


@router.post("/agent-add-item-batch", auth=ClerkAuth(), tags=["AI Agent"])
def agent_add_item_batch(request, data: AgentBatchPromptsSchema):
    """
    Add multiple items in batch using AI agent.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    # Validate item limits before processing batch
    user = request.user
    num_items_to_add = len(data.prompts)

    try:
        OwnedItem.validate_item_limit(user, count=num_items_to_add)
    except ValidationError as e:
        raise HttpError(400, str(e))

    # Get JWT token from Authorization header
    auth_header = request.META.get("HTTP_AUTHORIZATION")
    jwt_token = None
    if auth_header and auth_header.startswith("Bearer "):
        jwt_token = auth_header.split(" ")[1]

    # Run the agent with batch prompts
    result = run_agent(data.prompts, jwt_token)
    return result


# User Preferences Endpoints
class SyncPreferencesRequest(Schema):
    checkupInterval: int
    emailNotifications: bool


class SyncPreferencesResponse(Schema):
    message: str
    email_notifications: bool
    checkup_interval: int
    updated_checkups: List[CheckupSchema]


class ClerkJwtTestResponse(Schema):
    userId: str
    username: str
    email: str
    csrf_token: str


@router.post(
    "/sync-preferences",
    response=SyncPreferencesResponse,
    auth=ClerkAuth(),
    tags=["User Preferences"],
)
def sync_user_preferences(request, data: SyncPreferencesRequest):
    """
    Sync user preferences from Clerk metadata to Django checkup intervals.
    Rate limit: 100 requests per 60 seconds

    This endpoint should be called when user saves email preferences in the frontend.
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    # Validate checkup_interval
    if data.checkupInterval < 1 or data.checkupInterval > 12:
        raise HttpError(400, "checkupInterval must be an integer between 1 and 12")

    user = request.user

    # Get all checkups for the user (both 'keep' and 'give')
    all_checkups = CheckupService.get_all_checkups(user=user)

    updated_checkups = []

    # Update interval for all existing checkups
    for checkup in all_checkups:
        updated_checkup = CheckupService.update_checkup_interval(
            checkup.id, data.checkupInterval
        )
        updated_checkups.append(
            CheckupSchema(
                id=updated_checkup.id,
                last_checkup_date=updated_checkup.last_checkup_date,
                checkup_interval_months=updated_checkup.checkup_interval_months,
                is_checkup_due=updated_checkup.is_checkup_due,
            )
        )

    # If no checkups exist, try to get them again in case they were just created
    if not updated_checkups:
        all_checkups = CheckupService.get_all_checkups(user=user)
        for checkup in all_checkups:
            updated_checkup = CheckupService.update_checkup_interval(
                checkup.id, data.checkupInterval
            )
            updated_checkups.append(
                CheckupSchema(
                    id=updated_checkup.id,
                    last_checkup_date=updated_checkup.last_checkup_date,
                    checkup_interval_months=updated_checkup.checkup_interval_months,
                    is_checkup_due=updated_checkup.is_checkup_due,
                )
            )

    return SyncPreferencesResponse(
        message="User preferences synced successfully",
        email_notifications=data.emailNotifications,
        checkup_interval=data.checkupInterval,
        updated_checkups=updated_checkups,
    )


# Authentication Endpoints
@router.get(
    "/clerk-jwt",
    response=ClerkJwtTestResponse,
    auth=ClerkAuth(),
    tags=["Authentication"],
)
def clerk_jwt_test(request):
    """
    Test endpoint to verify JWT authentication is working.
    Returns the user ID from the authenticated request along with a CSRF token.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])

    # Get CSRF token for use in subsequent requests
    from django.middleware.csrf import get_token

    csrf_token = get_token(request)

    return ClerkJwtTestResponse(
        userId=request.user.clerk_id,
        username=request.user.username,
        email=request.user.email,
        csrf_token=csrf_token,
    )


# ============================================================================
# Location Endpoints
# ============================================================================

@router.get(
    "/locations",
    response=List[LocationSchema],
    auth=ClerkAuth(),
    tags=["Locations"],
)
def list_locations(request):
    """
    Get all locations for the authenticated user (flat list).
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])
    
    from .models import Location
    locations = Location.objects.filter(user=request.user).order_by('full_path')
    return [LocationSchema.from_orm(loc) for loc in locations]


@router.get(
    "/locations/tree",
    response=List[LocationTreeNode],
    auth=ClerkAuth(),
    tags=["Locations"],
)
def get_location_tree(request):
    """
    Get hierarchical tree structure of all user locations.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])
    
    from .services import LocationService
    tree = LocationService.get_location_tree(request.user)
    return tree


@router.get(
    "/locations/search",
    response=List[LocationSearchResultSchema],
    auth=ClerkAuth(),
    tags=["Locations"],
)
def search_locations(request, q: str):
    """
    Search locations by path/name using full_path__icontains.
    Query parameter: q - search query string
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])
    
    from .services import LocationService
    locations = LocationService.search_locations(request.user, q)
    return [LocationSearchResultSchema.from_orm(loc) for loc in locations]


@router.post(
    "/locations",
    response=LocationSchema,
    auth=ClerkAuth(),
    tags=["Locations"],
)
def create_location(request, data: LocationCreateSchema):
    """
    Create a new location. Validates parent ownership.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])
    
    from .services import LocationService
    try:
        location = LocationService.create_location(
            user=request.user,
            display_name=data.display_name,
            parent_id=data.parent_id
        )
        return LocationSchema.from_orm(location)
    except ValidationError as e:
        raise HttpError(400, str(e))


@router.get(
    "/locations/{location_id}",
    response=LocationSchema,
    auth=ClerkAuth(),
    tags=["Locations"],
)
def get_location(request, location_id: UUID):
    """
    Get a specific location by ID with item count.
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])
    
    from .models import Location
    try:
        location = Location.objects.get(id=location_id, user=request.user)
        return LocationSchema.from_orm(location)
    except Location.DoesNotExist:
        raise HttpError(404, "Location not found")


@router.put(
    "/locations/{location_id}",
    response=LocationSchema,
    auth=ClerkAuth(),
    tags=["Locations"],
)
def update_location(request, location_id: UUID, data: LocationUpdateSchema):
    """
    Update location display_name (triggers slug regeneration and cascade).
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])
    
    from .models import Location
    from .services import LocationService
    try:
        location = Location.objects.get(id=location_id, user=request.user)
        location.display_name = data.display_name
        location.slug = LocationService.generate_slug(data.display_name)
        location.full_clean()
        location.save()
        return LocationSchema.from_orm(location)
    except Location.DoesNotExist:
        raise HttpError(404, "Location not found")
    except ValidationError as e:
        raise HttpError(400, str(e))


@router.put(
    "/locations/{location_id}/move",
    response=LocationSchema,
    auth=ClerkAuth(),
    tags=["Locations"],
)
def move_location(request, location_id: UUID, data: LocationMoveSchema):
    """
    Move location to a new parent (or to root if parent_id is null).
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])
    
    from .models import Location
    from .services import LocationService
    try:
        location = Location.objects.get(id=location_id, user=request.user)
        
        new_parent = None
        if data.parent_id:
            try:
                new_parent = Location.objects.get(id=data.parent_id, user=request.user)
            except Location.DoesNotExist:
                raise HttpError(404, "Parent location not found")
        
        location = LocationService.move_location(location, new_parent, request.user)
        return LocationSchema.from_orm(location)
    except Location.DoesNotExist:
        raise HttpError(404, "Location not found")
    except ValidationError as e:
        raise HttpError(400, str(e))


@router.delete(
    "/locations/{location_id}",
    auth=ClerkAuth(),
    tags=["Locations"],
)
def delete_location(request, location_id: UUID):
    """
    Delete a location (fails if it has items or children).
    Rate limit: 100 requests per 60 seconds
    """
    # Check rate limit
    is_allowed, error_response = check_rate_limit(request)
    if not is_allowed:
        raise HttpError(429, error_response["detail"])
    
    from .models import Location
    from .services import LocationService
    try:
        location = Location.objects.get(id=location_id, user=request.user)
        LocationService.delete_location_safe(location)
        return {"success": True, "message": "Location deleted successfully"}
    except Location.DoesNotExist:
        raise HttpError(404, "Location not found")
    except ValidationError as e:
        raise HttpError(400, str(e))
