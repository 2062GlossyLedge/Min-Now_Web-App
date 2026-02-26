"""
Location Search Agent - Elasticsearch Agent Builder Integration

This module handles interaction with Elasticsearch Agent Builder via Kibana API
for natural language location queries.
"""

import os
from dotenv import load_dotenv

load_dotenv()  # Load environment variables from .env file

import logging
import logging.config
import json
import asyncio
import aiohttp
from typing import AsyncGenerator, Dict, Any, Optional, Tuple
from django.utils import timezone


prod = os.getenv("PROD", "false").lower() == "true"

# Configure logging similar to addItemAgent.py
# Logs the agent thinking and tool call traces 
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "simple": {
            "format": "[{levelname}] {name} - {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "simple",
            "stream": "ext://sys.stdout",
        },
    },
    "loggers": {
        "locationSearchAgent": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}

# Initialize logging configuration
logging.config.dictConfig(LOGGING)

# Create logger after configuration
log = logging.getLogger("locationSearchAgent")
log.info(f"LocationSearchAgent Environment: {'Production' if prod else 'Development'}")
log.debug("LocationSearchAgent logger initialized successfully")


class ElasticsearchAgentService:
    """
    Service for interacting with Elasticsearch Agent Builder via Kibana API.
    Provides streaming SSE support for real-time agent progress and responses.
    """
    
    # Event type mapping: Kibana event -> (emoji, display_text)
    KIBANA_EVENT_MAPPING = {
        'conversation_id_set': ('💬', 'Starting conversation'),
        'conversation_created': ('💬', 'Conversation started'),
        'conversation_updated': ('💬', 'Conversation updated'),
        'reasoning': ('💭', 'Analyzing your question'),
        'tool_call': ('🔧', 'Searching inventory'),
        'tool_progress': ('⏳', 'Processing'),
        'tool_result': ('✅', 'Found results'),
        'thinking_complete': ('🎯', 'Thinking complete'),
        'message_complete': ('✨', 'Response complete'),
        'round_complete': ('🏁', 'Round complete'),
    }
    
    @staticmethod
    def _extract_event_context(event_type: str, data: Dict[str, Any]) -> Optional[str]:
        """
        Extract contextual information from event data for enhanced display.
        
        Args:
            event_type: The type of event
            data: The event data dictionary
            
        Returns:
            Optional context string with specific details
        """
        try:
            if event_type == 'tool_call':
                tool_name = data.get('tool_id') or data.get('toolId') or data.get('tool_name')
                if tool_name:
                    return f"Tool: {tool_name}"
            
            elif event_type == 'tool_result':
                results = data.get('results', [])
                if results:
                    return f"{len(results)} results"
            
            elif event_type == 'reasoning':
                # Try to extract reasoning text from nested structure
                reasoning = data.get('data', {}).get('reasoning') or data.get('reasoning') or data.get('text')
                if reasoning and len(reasoning) <= 60:
                    return reasoning
                elif reasoning:
                    return reasoning[:57] + "..."
            
            return None
        except Exception as e:
            log.warning(f"Error extracting event context: {e}")
            return None
    
    @staticmethod
    def _parse_sse_event(event_type: str, event_data: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
        """
        Parse SSE event data into event type and JSON data.
        
        Args:
            event_type: The event type from 'event:' line
            event_data: The data from 'data:' line
            
        Returns:
            Tuple of (event_type, data_dict) or (None, None) if parsing fails
        """
        if not event_type or not event_data:
            return None, None
        
        try:
            data = json.loads(event_data)
            return event_type, data
        except json.JSONDecodeError as e:
            log.warning(f"Failed to parse SSE JSON: {e}")
            return None, None
    
    @staticmethod
    async def stream_query(user_id: str, query: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Stream a query to Elasticsearch Agent Builder and yield events in real-time.
        
        Args:
            user_id: The user's ID (clerk_id)
            query: The search query
            
        Yields:
            Dict events with structure:
            - Progress: {"type": "progress", "event": str, "emoji": str, "text": str, "context": str}
            - Chunk: {"type": "chunk", "text": str, "message_id": str}
            - Complete: {"type": "complete", "message_id": str}
            - Done: {"type": "done"}
            - Error: {"type": "error", "message": str, "emoji": str}
        """
        # Get configuration from settings
        kibana_url = os.getenv("KIBANA_URL")
        kibana_space = os.getenv("KIBANA_SPACE", "default")
        agent_id = os.getenv("ELASTICSEARCH_AGENT_ID")
        api_key = os.getenv("ELASTICSEARCH_API_KEY")
        
        # Validate configuration
        if not kibana_url or not api_key or not agent_id:
            error_msg = "Missing Elasticsearch configuration (KIBANA_URL, ELASTICSEARCH_API_KEY, or ELASTICSEARCH_AGENT_ID)"
            log.error(error_msg)
            yield {
                "type": "error",
                "message": error_msg,
                "emoji": "❌"
            }
            return
        
        # Build endpoint URL
        base_url = kibana_url.rstrip('/')
        if kibana_space and kibana_space != 'default':
            url = f"{base_url}/s/{kibana_space}/api/agent_builder/converse/async"
        else:
            url = f"{base_url}/api/agent_builder/converse/async"
        
        # Build request payload
        payload = {
            "input": query,
            "agent_id": agent_id,
        }
        
        headers = {
            "Authorization": f"ApiKey {api_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "kbn-xsrf": "true",
        }
        
        log.info(f"Starting SSE stream to Elasticsearch agent for user {user_id}")
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=120)) as response:
                    if response.status != 200:
                        error_text = await response.text()
                        error_msg = f"Elasticsearch agent error {response.status}: {error_text[:200]}"
                        log.error(error_msg)
                        yield {
                            "type": "error",
                            "message": error_msg,
                            "emoji": "❌"
                        }
                        return
                    
                    # SSE parser state
                    event_type = None
                    event_data = ""
                    buffer = ""
                    current_message_id = None
                    
                    # Stream SSE events
                    async for chunk in response.content.iter_any():
                        buffer += chunk.decode('utf-8', errors='replace')
                        
                        # Process complete lines
                        while '\n' in buffer:
                            line, buffer = buffer.split('\n', 1)
                            line = line.rstrip('\r')
                            
                            # Parse SSE format
                            if line.startswith('event:'):
                                event_type = line[6:].strip()
                            
                            elif line.startswith('data:'):
                                event_data = line[5:].strip()
                            
                            elif line == '':
                                # Empty line signals end of event
                                if event_type and event_data:
                                    parsed_type, parsed_data = ElasticsearchAgentService._parse_sse_event(
                                        event_type, event_data
                                    )
                                    
                                    if parsed_type and parsed_data:
                                        # Handle different event types
                                        if parsed_type == 'message_chunk':
                                            # Extract text chunk from nested structure
                                            text_chunk = (
                                                parsed_data.get('data', {}).get('text_chunk') or
                                                parsed_data.get('text_chunk') or
                                                parsed_data.get('textChunk') or
                                                parsed_data.get('chunk') or
                                                parsed_data.get('text') or
                                                parsed_data.get('content') or
                                                ""
                                            )
                                            
                                            if text_chunk:
                                                # Extract message_id if available
                                                msg_id = (
                                                    parsed_data.get('data', {}).get('message_id') or
                                                    parsed_data.get('message_id') or
                                                    parsed_data.get('messageId') or
                                                    current_message_id
                                                )
                                                if msg_id:
                                                    current_message_id = msg_id
                                                
                                                yield {
                                                    "type": "chunk",
                                                    "text": text_chunk,
                                                    "message_id": current_message_id
                                                }
                                        
                                        elif parsed_type == 'message_complete':
                                            msg_id = (
                                                parsed_data.get('data', {}).get('message_id') or
                                                parsed_data.get('message_id') or
                                                parsed_data.get('messageId') or
                                                current_message_id
                                            )
                                            yield {
                                                "type": "complete",
                                                "message_id": msg_id
                                            }
                                        
                                        elif parsed_type in ElasticsearchAgentService.KIBANA_EVENT_MAPPING:
                                            # Handle progress events
                                            emoji, text = ElasticsearchAgentService.KIBANA_EVENT_MAPPING[parsed_type]
                                            context = ElasticsearchAgentService._extract_event_context(
                                                parsed_type, parsed_data
                                            )
                                            
                                            progress_event = {
                                                "type": "progress",
                                                "event": parsed_type,
                                                "emoji": emoji,
                                                "text": text
                                            }
                                            if context:
                                                progress_event["context"] = context
                                            
                                            yield progress_event
                                    
                                    # Reset for next event
                                    event_type = None
                                    event_data = ""
                            
                            elif line.startswith(':'):
                                # Comment line, skip
                                continue
                    
                    # Stream complete
                    log.info(f"SSE stream complete for user {user_id}")
                    yield {"type": "done"}
        
        except asyncio.TimeoutError:
            error_msg = "Request timed out after 120 seconds"
            log.error(error_msg)
            yield {
                "type": "error",
                "message": error_msg,
                "emoji": "⏱️"
            }
        
        except Exception as e:
            error_msg = f"Error during streaming: {str(e)}"
            log.error(error_msg, exc_info=True)
            yield {
                "type": "error",
                "message": error_msg,
                "emoji": "❌"
            }
    
    @staticmethod
    async def query(user_id: str, query: str) -> Dict[str, Any]:
        """
        Send a non-streaming query to Elasticsearch Agent Builder.
        
        Args:
            user_id: The user's ID (user.id)
            query: The search query
            
        Returns:
            Dict with structure:
            - success: bool
            - response: str (the agent's response text)
            - conversation_id: str (for multi-turn conversations)
            - elapsed_time_ms: float
            - error: str (if success=False)
        """
        start_time = timezone.now()
        
        # Get configuration from settings
        kibana_url = os.getenv("KIBANA_URL")
        kibana_space = os.getenv("KIBANA_SPACE", "default")
        agent_id = os.getenv("ELASTICSEARCH_AGENT_ID")
        api_key = os.getenv("ELASTICSEARCH_API_KEY")
        
        # Validate configuration
        if not kibana_url or not api_key or not agent_id:
            error_msg = "Missing Elasticsearch configuration (KIBANA_URL, ELASTICSEARCH_API_KEY, or ELASTICSEARCH_AGENT_ID)"
            log.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "elapsed_time_ms": 0
            }
        
        # Build endpoint URL (non-streaming endpoint)
        base_url = kibana_url.rstrip('/')
        if kibana_space and kibana_space != 'default':
            url = f"{base_url}/s/{kibana_space}/api/agent_builder/converse"
        else:
            url = f"{base_url}/api/agent_builder/converse"
        
        # Build request payload
        # attach user id to query
        payload = {
            "input": query,
            "agent_id": agent_id,
             "configuration_overrides": {
              "instructions": f"User ID: {user_id}"
        }
               
            
         }   
        
        
        headers = {
            "Authorization": f"ApiKey {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "kbn-xsrf": "true",
        }
        
        log.debug(f"Query payload: {payload}")
 
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers, timeout=aiohttp.ClientTimeout(total=60)) as response:
                    end_time = timezone.now()
                    elapsed_time = (end_time - start_time).total_seconds() * 1000
                    
                    if response.status != 200:
                        error_text = await response.text()
                        error_msg = f"Elasticsearch agent error {response.status}: {error_text[:200]}"
                        log.error(error_msg)
                        return {
                            "success": False,
                            "error": error_msg,
                            "elapsed_time_ms": elapsed_time
                        }
                    
                    result = await response.json()
                    
                    # Log full JSON response for debugging
                    log.info("Elasticsearch agent response received")
                    log.debug("Full JSON Response:")
                    log.debug(json.dumps(result, indent=2))
                    
                    # Extract response text from the result structure
                    response_text = ""
                    conversation_id = result.get("conversation_id")
                    
                    # Try to extract from message structure
                    if "message" in result:
                        message = result["message"]
                        if isinstance(message, dict):
                            response_text = message.get("text", "") or message.get("content", "")
                        elif isinstance(message, str):
                            response_text = message
                    
                    # Fallback: try to extract from artifacts
                    if not response_text and "artifacts" in result:
                        artifacts = result.get("artifacts", [])
                        for artifact in artifacts:
                            if isinstance(artifact, dict):
                                artifact_content = artifact.get("content", "") or artifact.get("text", "")
                                if artifact_content:
                                    response_text = artifact_content
                                    break
                    
                    # Another fallback: try raw response
                    if not response_text and "response" in result:
                        response_text = result.get("response", "")
                    
                    # Last resort: convert entire result to string
                    if not response_text:
                        response_text = json.dumps(result)
                    
                    log.info(f"Query complete for user {user_id}")
                    
                    return {
                        "success": True,
                        "response": response_text,
                        "conversation_id": conversation_id,
                        "elapsed_time_ms": elapsed_time
                    }
        
        except asyncio.TimeoutError:
            error_msg = "Request timed out after 60 seconds"
            log.error(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "elapsed_time_ms": 60000
            }
        
        except Exception as e:
            end_time = timezone.now()
            elapsed_time = (end_time - start_time).total_seconds() * 1000
            error_msg = f"Error querying agent: {str(e)}"
            log.error(error_msg, exc_info=True)
            return {
                "success": False,
                "error": error_msg,
                "elapsed_time_ms": elapsed_time
            }
