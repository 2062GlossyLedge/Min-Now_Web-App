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
import json
from .addItemAgent import run_agent
from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.core.exceptions import ValidationError
import jwt
from django.conf import settings
from datetime import datetime, timedelta
from django.middleware.csrf import get_token
from upstash_ratelimit import Ratelimit, FixedWindow
from upstash_redis import Redis

from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from minNow.auth import jwt_required

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


# New Django-based JWT authenticated endpoints (alternative approach)


@jwt_required
def clerk_jwt_test(request):
    """
    Test endpoint to verify JWT authentication is working.
    Returns the user ID from the authenticated request along with a CSRF token.
    """
    # Get CSRF token for use in subsequent requests
    csrf_token = get_token(request)

    data = {
        "userId": request.user.clerk_id,
        "username": request.user.username,
        "email": request.user.email,
        "csrf_token": csrf_token,  # Include CSRF token for frontend use
    }
    return JsonResponse(data)


@jwt_required
@require_http_methods(["GET"])
def list_items_django(request):
    """
    Django view version of list_items endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Parse query parameters
        status_param = request.GET.get("status")
        item_type_param = request.GET.get("item_type")

        # Convert string parameters to enum values if provided
        status = None
        if status_param:
            try:
                status = ItemStatus(status_param)
            except ValueError:
                return JsonResponse({"error": "Invalid status value"}, status=400)

        item_type = None
        if item_type_param:
            try:
                item_type = ItemType(item_type_param)
            except ValueError:
                return JsonResponse({"error": "Invalid item_type value"}, status=400)

        # Get items for the authenticated user
        user = request.user
        items = ItemService.get_items_for_user(user, status=status, item_type=item_type)

        # Convert to OwnedItemSchema format (same as list_items ninja endpoint)
        items_schemas = [OwnedItemSchema.from_orm(item) for item in items]

        # Convert schemas to dictionaries for JSON serialization
        items_data = [schema.dict() for schema in items_schemas]

        return JsonResponse(items_data, safe=False)

    except Exception as e:
        log.error(f"Error in list_items_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["POST"])
def create_item_django(request):
    """
    Django view version of create_item endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Parse JSON payload
        data = json.loads(request.body)

        # Validate required fields
        required_fields = [
            "name",
            "picture_url",
            "item_type",
            "item_received_date",
            "last_used",
        ]
        for field in required_fields:
            if field not in data:
                return JsonResponse(
                    {"error": f"Missing required field: {field}"}, status=400
                )

        # Convert string parameters to enum values
        try:
            item_type = ItemType(data["item_type"])
        except ValueError:
            return JsonResponse({"error": "Invalid item_type value"}, status=400)

        status = ItemStatus.KEEP  # Default status
        if "status" in data:
            try:
                status = ItemStatus(data["status"])
            except ValueError:
                return JsonResponse({"error": "Invalid status value"}, status=400)

        # Parse datetime fields
        try:
            item_received_date = datetime.fromisoformat(
                data["item_received_date"].replace("Z", "+00:00")
            )
            last_used = datetime.fromisoformat(data["last_used"].replace("Z", "+00:00"))
        except ValueError as e:
            return JsonResponse(
                {"error": f"Invalid datetime format: {str(e)}"}, status=400
            )

        # Extract ownership duration goal (with default of 12 months)
        ownership_duration_goal_months = data.get("ownership_duration_goal_months", 12)

        # Create the item
        user = request.user
        try:
            item = ItemService.create_item(
                user=user,
                name=data["name"],
                picture_url=data["picture_url"],
                item_type=item_type,
                status=status,
                item_received_date=item_received_date,
                last_used=last_used,
                ownership_duration_goal_months=ownership_duration_goal_months,
            )
        except ValidationError as e:
            return JsonResponse({"error": str(e)}, status=400)

        # Convert to schema format
        item_schema = OwnedItemSchema.from_orm(item)
        return JsonResponse(item_schema.dict(), status=201)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)
    except Exception as e:
        log.error(f"Error in create_item_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["GET"])
def get_item_django(request, item_id):
    """
    Django view version of get_item endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Convert string UUID to UUID object
        try:
            item_uuid = UUID(item_id)
        except ValueError:
            return JsonResponse({"error": "Invalid UUID format"}, status=400)

        # Get the item
        item = ItemService.get_item(item_uuid)
        if not item:
            return JsonResponse({"error": "Item not found"}, status=404)

        # Convert to schema format
        item_schema = OwnedItemSchema.from_orm(item)
        return JsonResponse(item_schema.dict())

    except Exception as e:
        log.error(f"Error in get_item_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["GET"])
def get_user_item_stats_django(request):
    """
    Django view to get user item statistics including limits.
    """
    try:
        user = request.user
        stats = ItemService.get_user_item_stats(user)
        return JsonResponse(stats)

    except Exception as e:
        log.error(f"Error in get_user_item_stats_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["PUT"])
def update_item_django(request, item_id):
    """
    Django view version of update_item endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Convert string UUID to UUID object
        try:
            item_uuid = UUID(item_id)
        except ValueError:
            return JsonResponse({"error": "Invalid UUID format"}, status=400)

        # Parse JSON payload
        data = json.loads(request.body)

        # Convert enum fields if provided
        update_data = {}
        for key, value in data.items():
            if key == "item_type" and value is not None:
                try:
                    update_data[key] = ItemType(value)
                except ValueError:
                    return JsonResponse(
                        {"error": "Invalid item_type value"}, status=400
                    )
            elif key == "status" and value is not None:
                try:
                    update_data[key] = ItemStatus(value)
                except ValueError:
                    return JsonResponse({"error": "Invalid status value"}, status=400)
            elif key in ["item_received_date", "last_used"] and value is not None:
                try:
                    update_data[key] = datetime.fromisoformat(
                        value.replace("Z", "+00:00")
                    )
                except ValueError:
                    return JsonResponse(
                        {"error": f"Invalid datetime format for {key}"}, status=400
                    )
            else:
                update_data[key] = value

        # Update the item
        item = ItemService.update_item(item_uuid, **update_data)
        if not item:
            return JsonResponse({"error": "Item not found"}, status=404)

        # Convert to schema format
        item_schema = OwnedItemSchema.from_orm(item)
        return JsonResponse(item_schema.dict())

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)
    except Exception as e:
        log.error(f"Error in update_item_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["DELETE"])
def delete_item_django(request, item_id):
    """
    Django view version of delete_item endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Convert string UUID to UUID object
        try:
            item_uuid = UUID(item_id)
        except ValueError:
            return JsonResponse({"error": "Invalid UUID format"}, status=400)

        # Delete the item
        success = ItemService.delete_item(item_uuid)
        if not success:
            return JsonResponse({"error": "Item not found"}, status=404)

        return JsonResponse({"detail": "Item deleted successfully"})

    except Exception as e:
        log.error(f"Error in delete_item_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["GET"])
def get_donated_badges_django(request):
    """
    Django view version of get_donated_badges endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        user = request.user
        donated_badges = OwnedItem.donated_badge_progress(user)
        return JsonResponse(donated_badges)

    except Exception as e:
        log.error(f"Error in get_donated_badges_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


# @jwt_required
# @require_http_methods(["POST"])
# def create_checkup_django(request):
#     """
#     Django view version of create_checkup endpoint using JWT authentication.
#     Alternative to the ninja-based endpoint.
#     """
#     try:
#         # Parse JSON payload
#         data = json.loads(request.body)

#         # Validate required fields
#         if "checkup_type" not in data:
#             return JsonResponse(
#                 {"error": "Missing required field: checkup_type"}, status=400
#             )

#         interval_months = data.get("interval_months", 1)
#         checkup_type = data["checkup_type"]

#         # Check if user already has a checkup of this type
#         existing_checkup = CheckupService.get_checkups_by_type(
#             request.user, checkup_type
#         ).first()
#         if existing_checkup:
#             return JsonResponse(
#                 {"error": f"User already has a {checkup_type} checkup"}, status=400
#             )

#         # Create the checkup
#         checkup = CheckupService.create_checkup(
#             user=request.user,
#             interval_months=interval_months,
#             checkup_type=checkup_type,
#         )

#         # Convert to dictionary (assuming CheckupService returns a model instance with the required fields)
#         checkup_data = {
#             "id": checkup.id,
#             "last_checkup_date": checkup.last_checkup_date.isoformat(),
#             "checkup_interval_months": checkup.checkup_interval_months,
#             "is_checkup_due": checkup.is_checkup_due,
#         }

#         return JsonResponse(checkup_data, status=201)

#     except json.JSONDecodeError:
#         return JsonResponse({"error": "Invalid JSON payload"}, status=400)
#     except Exception as e:
#         log.error(f"Error in create_checkup_django: {str(e)}")
#         return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["GET"])
def get_checkup_django(request, checkup_id):
    """
    Django view version of get_checkup endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Convert string ID to int
        try:
            checkup_id_int = int(checkup_id)
        except ValueError:
            return JsonResponse({"error": "Invalid checkup ID format"}, status=400)

        # Get the checkup
        checkup = CheckupService.get_checkup(checkup_id_int)
        if not checkup or checkup.user != request.user:
            return JsonResponse({"error": "Checkup not found"}, status=404)

        # Convert to dictionary
        checkup_data = {
            "id": checkup.id,
            "last_checkup_date": checkup.last_checkup_date.isoformat(),
            "checkup_interval_months": checkup.checkup_interval_months,
            "is_checkup_due": checkup.is_checkup_due,
        }

        return JsonResponse(checkup_data)

    except Exception as e:
        log.error(f"Error in get_checkup_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["PUT"])
def update_checkup_interval_django(request, checkup_id):
    """
    Django view version of update_checkup_interval endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Convert string ID to int
        try:
            checkup_id_int = int(checkup_id)
        except ValueError:
            return JsonResponse({"error": "Invalid checkup ID format"}, status=400)

        # Parse JSON payload
        data = json.loads(request.body)

        if "interval_months" not in data:
            return JsonResponse(
                {"error": "Missing required field: interval_months"}, status=400
            )

        # Get the checkup and verify ownership
        checkup = CheckupService.get_checkup(checkup_id_int)
        if not checkup or checkup.user != request.user:
            return JsonResponse({"error": "Checkup not found"}, status=404)

        # Update the checkup
        checkup = CheckupService.update_checkup_interval(
            checkup_id_int, data["interval_months"]
        )

        # Convert to dictionary
        checkup_data = {
            "id": checkup.id,
            "last_checkup_date": checkup.last_checkup_date.isoformat(),
            "checkup_interval_months": checkup.checkup_interval_months,
            "is_checkup_due": checkup.is_checkup_due,
        }

        return JsonResponse(checkup_data)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)
    except Exception as e:
        log.error(f"Error in update_checkup_interval_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["POST"])
def complete_checkup_django(request, checkup_id):
    """
    Django view version of complete_checkup endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Convert string ID to int
        try:
            checkup_id_int = int(checkup_id)
        except ValueError:
            return JsonResponse({"error": "Invalid checkup ID format"}, status=400)

        # Get the checkup and verify ownership
        checkup = CheckupService.get_checkup(checkup_id_int)
        if not checkup or checkup.user != request.user:
            return JsonResponse({"error": "Checkup not found"}, status=404)

        # Complete the checkup
        checkup = CheckupService.complete_checkup(checkup_id_int)

        # Convert to dictionary
        checkup_data = {
            "id": checkup.id,
            "last_checkup_date": checkup.last_checkup_date.isoformat(),
            "checkup_interval_months": checkup.checkup_interval_months,
            "is_checkup_due": checkup.is_checkup_due,
        }

        return JsonResponse(checkup_data)

    except Exception as e:
        log.error(f"Error in complete_checkup_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["GET"])
def list_checkups_django(request):
    """
    Django view version of list_checkups endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Parse query parameters
        checkup_type = request.GET.get("type")

        # Get checkups for the authenticated user
        if checkup_type:
            checkups = CheckupService.get_checkups_by_type(
                user=request.user, checkup_type=checkup_type
            )
        else:
            checkups = CheckupService.get_all_checkups(user=request.user)

        # Convert to list of dictionaries
        checkups_data = []
        for checkup in checkups:
            checkup_data = {
                "id": checkup.id,
                "last_checkup_date": checkup.last_checkup_date.isoformat(),
                "checkup_interval_months": checkup.checkup_interval_months,
                "is_checkup_due": checkup.is_checkup_due,
            }
            checkups_data.append(checkup_data)

        return JsonResponse(checkups_data, safe=False)

    except Exception as e:
        log.error(f"Error in list_checkups_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["POST"])
def send_test_checkup_email_django(request):
    """
    Django view version of send_test_checkup_email endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        user = request.user
        results = CheckupService.check_and_send_due_emails(user)

        # Convert results to proper format
        email_results = []
        for result in results:
            email_data = {
                "checkup_type": result["checkup_type"],
                "status": result["status"],
                "recipient_email": result["recipient_email"],
                "recipient_username": result["recipient_username"],
            }
            email_results.append(email_data)

        return JsonResponse(email_results, safe=False)

    except Exception as e:
        log.error(f"Error in send_test_checkup_email_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["POST"])
def agent_add_item_django(request):
    """
    Django view version of agent_add_item endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Parse JSON payload
        data = json.loads(request.body)

        if "prompt" not in data:
            return JsonResponse({"error": "Missing required field: prompt"}, status=400)

        # Get JWT token from Authorization header
        auth_header = request.META.get("HTTP_AUTHORIZATION")
        jwt_token = None
        if auth_header and auth_header.startswith("Bearer "):
            jwt_token = auth_header.split(" ")[1]

        # Convert prompt to expected format if it's a string
        prompt_data = data["prompt"]
        if isinstance(prompt_data, str):
            prompt_data = {"prompt": prompt_data}

        # Run the agent
        result = run_agent(prompt_data, jwt_token)
        return JsonResponse(result)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)
    except Exception as e:
        log.error(f"Error in agent_add_item_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@jwt_required
@require_http_methods(["POST"])
def agent_add_item_batch_django(request):
    """
    Django view version of agent_add_item_batch endpoint using JWT authentication.
    Alternative to the ninja-based endpoint.
    """
    try:
        # Parse JSON payload
        data = json.loads(request.body)

        if "prompts" not in data:
            return JsonResponse(
                {"error": "Missing required field: prompts"}, status=400
            )

        # Validate item limits before processing batch
        user = request.user
        num_items_to_add = len(data["prompts"])

        try:
            OwnedItem.validate_item_limit(user, count=num_items_to_add)
        except ValidationError as e:
            return JsonResponse({"error": str(e)}, status=400)

        # Get JWT token from Authorization header
        auth_header = request.META.get("HTTP_AUTHORIZATION")
        jwt_token = None
        if auth_header and auth_header.startswith("Bearer "):
            jwt_token = auth_header.split(" ")[1]

        # Run the agent with batch prompts
        results = {}
        run_agent(data["prompts"], jwt_token)
        return JsonResponse(results)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON payload"}, status=400)
    except Exception as e:
        log.error(f"Error in agent_add_item_batch_django: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


"""
Django JWT Authenticated Endpoints Summary
==========================================

All the Django-based endpoints above provide an alternative to the Django-Ninja routes.
These endpoints use JWT authentication via the @jwt_required decorator instead of ClerkAuth().

Available endpoints under /django-api/:
- GET    /items                    - List items with optional status/item_type filters
- POST   /items/create             - Create a new item
- GET    /items/<item_id>          - Get specific item by UUID
- PUT    /items/<item_id>/update   - Update specific item
- DELETE /items/<item_id>/delete   - Delete specific item
- GET    /badges/donated           - Get donated badges progress
- GET    /checkups                 - List checkups with optional type filter
- POST   /checkups/create          - Create a new checkup
- GET    /checkups/<checkup_id>    - Get specific checkup
- PUT    /checkups/<checkup_id>/interval - Update checkup interval
- POST   /checkups/<checkup_id>/complete - Complete a checkup
- POST   /send-test-email          - Send test checkup email (dev/testing)
- POST   /agent-add-item           - AI agent item creation
- POST   /agent-add-item-batch     - Batch AI agent item creation

Usage:
------
All endpoints require JWT authentication via Authorization header:
Authorization: Bearer <clerk_jwt_token>

Content-Type: application/json (for POST/PUT requests)

Example:
curl -H "Authorization: Bearer <token>" -H "Content-Type: application/json" \\
     -d '{"name":"Item Name","picture_url":"url","item_type":"clothing",...}' \\
     http://localhost:8000/django-api/items/create
"""
