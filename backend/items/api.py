from ninja import Router, Schema
from typing import List, Optional
from .models import ItemType, ItemStatus, TimeSpan
from .services import ItemService, CheckupService
from datetime import datetime
from uuid import UUID
from dotenv import load_dotenv
import os
import logging

log = logging.getLogger(__name__)
load_dotenv()
prod = os.getenv("PROD") == "True"
log.info(f"API Environment: {'Production' if prod else 'Development'}")

if prod:
    from minNow.minNow.auth import ClerkAuth
else:
    from minNow.auth import ClerkAuth

router = Router()


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
        )


class OwnedItemCreateSchema(Schema):
    name: str
    picture_url: str
    item_type: ItemType
    status: ItemStatus = ItemStatus.KEEP
    item_received_date: datetime
    last_used: datetime


class OwnedItemUpdateSchema(Schema):
    name: Optional[str] = None
    picture_url: Optional[str] = None
    item_type: Optional[ItemType] = None
    status: Optional[ItemStatus] = None


class CheckupCreateSchema(Schema):
    interval_months: int = 1
    checkup_type: str


class CheckupUpdateSchema(Schema):
    interval_months: int


@router.post("/items", response={201: OwnedItemSchema}, auth=ClerkAuth())
def create_item(request, payload: OwnedItemCreateSchema):
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
    response={200: OwnedItemSchema, 404: dict},
    auth=ClerkAuth(),
)
def get_item(request, item_id: UUID):
    item = ItemService.get_item(item_id)
    if not item:
        return 404, {"detail": "Item not found"}
    return 200, OwnedItemSchema.from_orm(item)


@router.put(
    "/items/{item_id}",
    response={200: OwnedItemSchema, 404: dict},
    auth=ClerkAuth(),
)
def update_item(request, item_id: UUID, payload: OwnedItemUpdateSchema):
    update_data = payload.dict(exclude_unset=True)
    item = ItemService.update_item(item_id, **update_data)
    if not item:
        return 404, {"detail": "Item not found"}
    return 200, OwnedItemSchema.from_orm(item)


@router.delete("/items/{item_id}", response={200: dict, 404: dict}, auth=ClerkAuth())
def delete_item(request, item_id: UUID):
    success = ItemService.delete_item(item_id)
    if not success:
        return 404, {"detail": "Item not found"}
    return 200, {"detail": "Item deleted successfully"}


@router.get("/items", response=List[OwnedItemSchema], auth=ClerkAuth())
def list_items(
    request, status: Optional[ItemStatus] = None, item_type: Optional[ItemType] = None
):
    user = request.user  # This should be set by ClerkAuth

    # Filter items by the authenticated user
    items = ItemService.get_items_for_user(user, status=status, item_type=item_type)
    return [OwnedItemSchema.from_orm(item) for item in items]


@router.post("/checkups", response={201: CheckupSchema}, auth=ClerkAuth())
def create_checkup(request, payload: CheckupCreateSchema):
    checkup = CheckupService.create_checkup(
        user=request.user,
        interval_months=payload.interval_months,
        checkup_type=payload.checkup_type,
    )
    return 201, checkup


@router.get(
    "/checkups/{checkup_id}",
    response={200: CheckupSchema, 404: dict},
    auth=ClerkAuth(),
)
def get_checkup(request, checkup_id: int):
    checkup = CheckupService.get_checkup(checkup_id)
    if not checkup or checkup.user != request.user:
        return 404, {"detail": "Checkup not found"}
    return 200, checkup


@router.put(
    "/checkups/{checkup_id}/interval",
    response={200: CheckupSchema, 404: dict},
    auth=ClerkAuth(),
)
def update_checkup_interval(request, checkup_id: int, payload: CheckupUpdateSchema):
    checkup = CheckupService.get_checkup(checkup_id)
    if not checkup or checkup.user != request.user:
        return 404, {"detail": "Checkup not found"}
    checkup = CheckupService.update_checkup_interval(
        checkup_id, payload.interval_months
    )
    return 200, checkup


@router.post(
    "/checkups/{checkup_id}/complete",
    response={200: CheckupSchema, 404: dict},
    auth=ClerkAuth(),
)
def complete_checkup(request, checkup_id: int):
    checkup = CheckupService.get_checkup(checkup_id)
    if not checkup or checkup.user != request.user:
        return 404, {"detail": "Checkup not found"}
    checkup = CheckupService.complete_checkup(checkup_id)
    return 200, checkup


# Add this to the existing imports
from typing import Optional


# Add this new schema
class CheckupTypeSchema(Schema):
    type: str


# Modify the list_checkups endpoint to filter by type
@router.get("/checkups", response=List[CheckupSchema], auth=ClerkAuth())
def list_checkups(request, type: Optional[str] = None):
    if type:
        checkups = CheckupService.get_checkups_by_type(
            user=request.user, checkup_type=type
        )
    else:
        checkups = CheckupService.get_all_checkups(user=request.user)
    return checkups


# Modify the create_checkup endpoint to include type
@router.post("/checkups", response={201: CheckupSchema}, auth=ClerkAuth())
def create_checkup(request, payload: CheckupCreateSchema):
    checkup = CheckupService.create_checkup(
        interval_months=payload.interval_months, checkup_type=payload.checkup_type
    )
    return 201, checkup
