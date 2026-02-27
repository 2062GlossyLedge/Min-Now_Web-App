"""
Test initialization - Mock problematic imports before Django loads.
"""
import sys
import os
from unittest.mock import MagicMock, patch



# Mock langgraph modules that cause import errors during testing
sys.modules['langgraph'] = MagicMock()
sys.modules['langgraph.prebuilt'] = MagicMock()
sys.modules['langgraph.graph'] = MagicMock()
sys.modules['langgraph.graph.message'] = MagicMock()
sys.modules['langgraph.checkpoint'] = MagicMock()
sys.modules['langgraph.checkpoint.memory'] = MagicMock()

# Mock upstash modules
sys.modules['upstash_ratelimit'] = MagicMock()
sys.modules['upstash_redis'] = MagicMock()

# Mock elasticsearch modules
mock_es = MagicMock()
mock_helpers = MagicMock()
mock_es.helpers = mock_helpers
sys.modules['elasticsearch'] = mock_es
sys.modules['elasticsearch.helpers'] = mock_helpers

# Mock django-permissions-policy with a proper middleware class
class MockPermissionsPolicyMiddleware:
    """Mock middleware that does nothing."""
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        return self.get_response(request)

mock_permissions_policy = MagicMock()
mock_permissions_policy.middleware = MagicMock()
mock_permissions_policy.middleware.PermissionsPolicyMiddleware = MockPermissionsPolicyMiddleware
sys.modules['django_permissions_policy'] = mock_permissions_policy
sys.modules['django_permissions_policy.middleware'] = mock_permissions_policy.middleware

# Mock clerk_backend_api to prevent real API calls during tests
mock_clerk = MagicMock()

# Create a mock Clerk SDK that doesn't make real API calls and doesn't throw errors
class MockClerkSDK:
    def __init__(self, *args, **kwargs):
        pass
    
    def __enter__(self):
        return self
    
    def __exit__(self, *args):
        pass
    
    class MockUsers:
        def get(self, user_id=None):
            # Return a mock user with empty metadata
            mock_user = MagicMock()
            mock_user.public_metadata = {}
            return mock_user
    
    @property
    def users(self):
        return self.MockUsers()

mock_clerk.Clerk = MockClerkSDK
sys.modules['clerk_backend_api'] = mock_clerk
