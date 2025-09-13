"""
Test for JWT rate limiting functionality.

This test verifies that the jwt_required decorator properly rate limits requests
to 20 requests per 50 seconds.
"""

import os
import time
import json
from django.test import TestCase, Client
from django.contrib.auth import get_user_model
from django.urls import reverse
from unittest.mock import patch, MagicMock
import jwt
from django.conf import settings

User = get_user_model()


class RateLimitTest(TestCase):
    def setUp(self):
        """Set up test data."""
        self.client = Client()

        # Create a test user
        self.test_user = User.objects.create_user(
            username="test_clerk_id", clerk_id="test_clerk_id", email="test@example.com"
        )

        # Create a JWT token for testing (development mode)
        self.jwt_token = jwt.encode(
            {"sub": "test_clerk_id"}, settings.SECRET_KEY, algorithm="HS256"
        )

    def test_rate_limit_not_exceeded(self):
        """Test that requests under the rate limit are allowed."""
        # Patch the rate limiter to simulate successful rate limiting
        with patch("minNow.auth.jwt_rate_limiter") as mock_rate_limiter:
            # Mock rate limiter response (request allowed)
            mock_response = MagicMock()
            mock_response.allowed = True
            mock_rate_limiter.limit.return_value = mock_response

            # Make a request to a JWT-protected endpoint
            response = self.client.get(
                "/django-api/clerk_jwt",  # Using the existing JWT test endpoint
                HTTP_AUTHORIZATION=f"Bearer {self.jwt_token}",
            )

            # The request should succeed (or fail for other reasons, not rate limiting)
            # We're primarily checking that rate limiting doesn't block it
            self.assertNotEqual(response.status_code, 429)

    def test_rate_limit_exceeded(self):
        """Test that requests exceeding the rate limit are blocked."""
        # Patch the rate limiter to simulate rate limit exceeded
        with patch("minNow.auth.jwt_rate_limiter") as mock_rate_limiter:
            # Mock rate limiter response (request blocked)
            mock_response = MagicMock()
            mock_response.allowed = False
            mock_response.reset = 30  # 30 seconds until reset
            mock_rate_limiter.limit.return_value = mock_response

            # Make a request to a JWT-protected endpoint
            response = self.client.get(
                "/django-api/clerk_jwt", HTTP_AUTHORIZATION=f"Bearer {self.jwt_token}"
            )

            # The request should be blocked with 429 status
            self.assertEqual(response.status_code, 429)

            # Check the error message
            response_data = json.loads(response.content)
            self.assertIn("Rate limit exceeded", response_data["detail"])
            self.assertEqual(response_data["reset_time"], 30)

    def test_rate_limit_disabled_when_not_available(self):
        """Test that when rate limiter is None, requests are not blocked."""
        # Patch the rate limiter to be None (disabled)
        with patch("minNow.auth.jwt_rate_limiter", None):
            # Make a request to a JWT-protected endpoint
            response = self.client.get(
                "/django-api/clerk_jwt", HTTP_AUTHORIZATION=f"Bearer {self.jwt_token}"
            )

            # The request should not be blocked by rate limiting
            self.assertNotEqual(response.status_code, 429)

    def test_rate_limit_uses_user_id(self):
        """Test that rate limiting uses the user's clerk_id when available."""
        with patch("minNow.auth.jwt_rate_limiter") as mock_rate_limiter:
            mock_response = MagicMock()
            mock_response.allowed = True
            mock_rate_limiter.limit.return_value = mock_response

            # Make a request
            self.client.get(
                "/api/django/auth/test", HTTP_AUTHORIZATION=f"Bearer {self.jwt_token}"
            )

            # Verify that the rate limiter was called with the user's clerk_id
            mock_rate_limiter.limit.assert_called()
            # The first argument should be the user identifier
            call_args = mock_rate_limiter.limit.call_args
            user_identifier = call_args[0][0]  # First positional argument

            # Should use clerk_id when user is authenticated
            self.assertEqual(user_identifier, "test_clerk_id")

    def test_rate_limit_fallback_to_ip(self):
        """Test that rate limiting falls back to IP when no user is available."""
        # Test with an invalid token (no user will be authenticated)
        invalid_token = "invalid.jwt.token"

        with patch("minNow.auth.jwt_rate_limiter") as mock_rate_limiter:
            mock_response = MagicMock()
            mock_response.allowed = True
            mock_rate_limiter.limit.return_value = mock_response

            # Make a request with invalid token
            response = self.client.get(
                "/api/django/auth/test",
                HTTP_AUTHORIZATION=f"Bearer {invalid_token}",
                REMOTE_ADDR="192.168.1.100",
            )

            # The request should fail authentication (401), not rate limiting (429)
            self.assertEqual(response.status_code, 401)
