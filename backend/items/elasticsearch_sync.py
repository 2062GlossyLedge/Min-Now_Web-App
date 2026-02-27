"""
Elasticsearch sync service for PostgreSQL to Elasticsearch data synchronization.
Handles serialization of Django models to ES documents and manual sync operations.
"""

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from django.conf import settings
from django.contrib.auth import get_user_model

logger = logging.getLogger("minNow")

User = get_user_model()


def serialize_user(user) -> Dict[str, Any]:
    """Convert User model to Elasticsearch document."""
    return {
        "id": str(user.id),
        "clerk_id": user.clerk_id or "",
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "is_active": user.is_active,
        "date_joined": user.date_joined.isoformat() if user.date_joined else None,
    }


def serialize_item(owned_item) -> Dict[str, Any]:
    """Convert OwnedItem model to Elasticsearch document."""
    return {
        "id": str(owned_item.id),
        "user_id": str(owned_item.user_id),
        "name": owned_item.name,
        "picture_url": owned_item.picture_url,
        "item_type": owned_item.item_type,
        "status": owned_item.status,
        "current_location_id": str(owned_item.current_location_id) if owned_item.current_location_id else None,
        "item_received_date": owned_item.item_received_date.isoformat() if owned_item.item_received_date else None,
        "last_used": owned_item.last_used.isoformat() if owned_item.last_used else None,
        "ownership_duration_goal_months": owned_item.ownership_duration_goal_months,
        "location_updated_at": owned_item.location_updated_at.isoformat() if owned_item.location_updated_at else None,
    }


def serialize_location(location) -> Dict[str, Any]:
    """Convert Location model to Elasticsearch document."""
    return {
        "id": str(location.id),
        "user_id": str(location.user_id),
        "slug": location.slug,
        "display_name": location.display_name,
        "full_path": location.full_path,
        "parent_id": str(location.parent_id) if location.parent_id else None,
        "level": location.level,
        "created_at": location.created_at.isoformat() if location.created_at else None,
        "updated_at": location.updated_at.isoformat() if location.updated_at else None,
    }


def bulk_index_documents(index_name: str, documents: List[Dict[str, Any]]) -> Dict[str, int]:
    """
    Bulk index documents to Elasticsearch.
    Returns dict with success and failure counts.
    Raises exceptions on connection failures.
    """
    if not settings.ES_CLIENT:
        raise ConnectionError("Elasticsearch client not available")
    
    if not documents:
        return {"success": 0, "failed": 0}
    
    try:
        from elasticsearch import helpers
        
        actions = []
        for doc in documents:
            action = {
                "_index": index_name,
                "_id": doc.get("id"),
                "_source": doc
            }
            actions.append(action)
        
        # Perform bulk indexing
        success, failed = helpers.bulk(
            settings.ES_CLIENT,
            actions,
            stats_only=True,
            raise_on_error=False,
            refresh=False
        )
        
        success_count = success if success else 0
        # failed can be either an integer or a list of failed items
        if isinstance(failed, int):
            failed_count = failed
        elif isinstance(failed, list):
            failed_count = len(failed)
        else:
            failed_count = 0
        
        logger.info(f"✓ Bulk indexed {success_count} documents to {index_name} ({failed_count} failed)")
        
        return {"success": success_count, "failed": failed_count}
        
    except Exception as e:
        logger.error(f"✗ Bulk index failed for {index_name}: {e}")
        raise


def test_connection() -> bool:
    """
    Test Elasticsearch connection.
    Returns True if connected, False otherwise.
    """
    if not settings.ES_CLIENT:
        return False
    
    try:
        return settings.ES_CLIENT.ping()
    except Exception as e:
        logger.error(f"ES connection test failed: {e}")
        return False


def execute_enrichment_policy(policy_name: str) -> Dict[str, Any]:
    """
    Execute an Elasticsearch enrichment policy.
    
    Args:
        policy_name: Name of the enrichment policy to execute
    
    Returns:
        Dict with execution results including success status
    """
    result = {
        "success": False,
        "policy_name": policy_name,
        "error": None
    }
    
    if not settings.ES_CLIENT:
        result["error"] = "Elasticsearch client not available"
        logger.error(f"✗ Cannot execute enrichment policy {policy_name}: ES client not available")
        return result
    
    try:
        logger.info(f"Executing enrichment policy: {policy_name}...")
        response = settings.ES_CLIENT.enrich.execute_policy(name=policy_name)
        result["success"] = True
        # Convert ObjectApiResponse to dict for JSON serialization
        result["response"] = dict(response) if response else None
        logger.info(f"✓ Enrichment policy {policy_name} executed successfully")
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"✗ Failed to execute enrichment policy {policy_name}: {e}")
    
    return result


def sync_user_to_elasticsearch(user) -> Dict[str, Any]:
    """
    Sync a specific user's OwnedItem and Location data to Elasticsearch.
    This is triggered by user API call, not automatic.
    
    Args:
        user: Django User instance to sync data for
    
    Returns:
        Dict with sync results including success status and counts per index.
    """
    from .models import OwnedItem, Location
    
    logger.info(f"Starting user-specific sync to Elasticsearch for user {user.id}...")
    
    result = {
        "success": False,
        "es_connected": False,
        "indices": {},
        "total_synced": 0,
        "total_failed": 0,
        "error": None
    }
    
    # Test connection first
    if not test_connection():
        result["error"] = "Elasticsearch is not available"
        logger.error("✗ Sync failed: Elasticsearch not available")
        return result
    
    result["es_connected"] = True
    
    try:
        # Sync user's items
        logger.info(f"Syncing items for user {user.id}...")
        items = OwnedItem.objects.filter(user=user)
        item_docs = [serialize_item(item) for item in items]
        
        if item_docs:
            item_result = bulk_index_documents('items', item_docs)
            result["indices"]["items"] = {
                "total": len(item_docs),
                "success": item_result["success"],
                "failed": item_result["failed"]
            }
            result["total_synced"] += item_result["success"]
            result["total_failed"] += item_result["failed"]
        else:
            result["indices"]["items"] = {"total": 0, "success": 0, "failed": 0}
        
        # Sync user's locations
        logger.info(f"Syncing locations for user {user.id}...")
        locations = Location.objects.filter(user=user)
        location_docs = [serialize_location(loc) for loc in locations]
        
        if location_docs:
            location_result = bulk_index_documents('locations', location_docs)
            result["indices"]["locations"] = {
                "total": len(location_docs),
                "success": location_result["success"],
                "failed": location_result["failed"]
            }
            result["total_synced"] += location_result["success"]
            result["total_failed"] += location_result["failed"]
            
            # Execute enrichment policy after successful location sync
            if location_result["success"] > 0:
                enrichment_result = execute_enrichment_policy('locations_policy')
                result["enrichment_policy"] = enrichment_result
        else:
            result["indices"]["locations"] = {"total": 0, "success": 0, "failed": 0}
        
        # Mark as successful if no failures
        result["success"] = result["total_failed"] == 0
        
        logger.info(
            f"✓ User sync complete: {result['total_synced']} synced, "
            f"{result['total_failed']} failed"
        )
        
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"✗ User sync failed with error: {e}", exc_info=True)
    
    return result


def sync_all_to_elasticsearch() -> Dict[str, Any]:
    """
    Manually sync all PostgreSQL data to Elasticsearch.
    This is triggered by API call, not automatic.
    
    Returns:
        Dict with sync results including success status and counts per index.
    """
    from .models import OwnedItem, Location
    
    logger.info("Starting manual sync to Elasticsearch...")
    
    result = {
        "success": False,
        "es_connected": False,
        "indices": {},
        "total_synced": 0,
        "total_failed": 0,
        "error": None
    }
    
    # Test connection first
    if not test_connection():
        result["error"] = "Elasticsearch is not available"
        logger.error("✗ Sync failed: Elasticsearch not available")
        return result
    
    result["es_connected"] = True
    
    try:
        # Sync users
        logger.info("Syncing users...")
        users = User.objects.all()
        user_docs = [serialize_user(user) for user in users]
        user_result = bulk_index_documents('users', user_docs)
        result["indices"]["users"] = {
            "total": len(user_docs),
            "success": user_result["success"],
            "failed": user_result["failed"]
        }
        result["total_synced"] += user_result["success"]
        result["total_failed"] += user_result["failed"]
        
        # Sync items
        logger.info("Syncing items...")
        items = OwnedItem.objects.all()
        item_docs = [serialize_item(item) for item in items]
        item_result = bulk_index_documents('items', item_docs)
        result["indices"]["items"] = {
            "total": len(item_docs),
            "success": item_result["success"],
            "failed": item_result["failed"]
        }
        result["total_synced"] += item_result["success"]
        result["total_failed"] += item_result["failed"]
        
        # Sync locations
        logger.info("Syncing locations...")
        locations = Location.objects.all()
        location_docs = [serialize_location(loc) for loc in locations]
        location_result = bulk_index_documents('locations', location_docs)
        result["indices"]["locations"] = {
            "total": len(location_docs),
            "success": location_result["success"],
            "failed": location_result["failed"]
        }
        result["total_synced"] += location_result["success"]
        result["total_failed"] += location_result["failed"]
        
        # Execute enrichment policy after successful location sync
        if location_result["success"] > 0:
            enrichment_result = execute_enrichment_policy('locations_policy')
            result["enrichment_policy"] = enrichment_result
        
        # Mark as successful if no failures
        result["success"] = result["total_failed"] == 0
        
        logger.info(
            f"✓ Sync complete: {result['total_synced']} synced, "
            f"{result['total_failed']} failed"
        )
        
    except Exception as e:
        result["error"] = str(e)
        logger.error(f"✗ Sync failed with error: {e}", exc_info=True)
    
    return result

