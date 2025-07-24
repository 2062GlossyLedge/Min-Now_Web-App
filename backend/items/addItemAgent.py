import os
from dotenv import load_dotenv

load_dotenv()  # Loads .env before any langchain/langgraph import
from typing import Annotated
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from typing_extensions import TypedDict
from langchain_core.tools import tool

from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import MemorySaver
from langchain_openai import ChatOpenAI

from typing import Dict, Any
import httpx
import logging
import logging.config


prod = os.getenv("PROD", "false").lower() == "true"

# Configure logging similar to settings.py
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
        "addItemAgent": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
    },
}

# Initialize logging configuration
logging.config.dictConfig(LOGGING)

# Create logger after configuration
log = logging.getLogger("addItemAgent")
log.info(f"AddItemAgent Environment: {'Production' if prod else 'Development'}")
log.debug("AddItemAgent logger initialized successfully")

# from clerk_backend_api import Clerk
# from backend.minNow.auth import ClerkAuth
# from django.http import HttpRequest
from langchain.chat_models import init_chat_model

os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
os.environ["LANGSMITH_TRACING"] = os.getenv("LANGSMITH_TRACING", "true")
os.environ["LANGSMITH_API_KEY"] = os.getenv("LANGSMITH_API_KEY")

from langsmith import Client

# client = Client()

# # Replace with your actual run ID from LangSmith
# run_id = ""

# # Update the run status to "aborted" (equivalent to stopping it)
# client.update_run(run_id=run_id, status="aborted")

# llm = init_chat_model("openai:gpt-4.1-nano")

# Path to system instructions
SYSTEM_INSTRUCTIONS_PATH = os.path.join(
    os.path.dirname(__file__), "add_item_system_instructions.txt"
)

GRAPH_PATH = os.path.join(os.path.dirname(__file__), "graph_output.png")


class State(TypedDict):
    messages: Annotated[list, add_messages]
    item_json: Dict[str, Any]
    batch_prompts: Dict[str, str]  # key: identifier, value: prompt
    current_key: str  # current key being processed
    processed_keys: list[str]  # optional: track processed keys


# Tool node: POST request to create item with CSRF and auth headers
def get_csrf_token(client, api_url):
    """Get CSRF token from the API with detailed logging"""
    log.info(f"Requesting CSRF token from: {api_url}/api/csrf-token")
    try:
        log.debug("About to make GET request for CSRF token...")
        # Use the same timeout configuration as the client
        resp = client.get(f"{api_url}/api/csrf-token", follow_redirects=True)
        log.debug("GET request completed, processing response...")
        log.debug(f"CSRF request status code: {resp.status_code}")
        log.debug(f"CSRF response headers: {dict(resp.headers)}")
        log.debug("About to call raise_for_status()...")
        resp.raise_for_status()
        log.debug("Status check passed, parsing JSON...")
        token_data = resp.json()
        log.info("CSRF token retrieved successfully")
        log.debug(f"CSRF token data keys: {list(token_data.keys())}")
        return token_data["token"]
    except httpx.TimeoutException as e:
        log.error(f"Timeout error getting CSRF token: {type(e).__name__} - {str(e)}")
        raise
    except httpx.HTTPStatusError as e:
        log.error(
            f"HTTP error getting CSRF token: {e.response.status_code} - {e.response.text}"
        )
        raise
    except httpx.RequestError as e:
        log.error(f"Request error getting CSRF token: {type(e).__name__} - {str(e)}")
        raise
    except Exception as e:
        log.error(f"Unexpected error getting CSRF token: {type(e).__name__} - {str(e)}")
        raise


def route_tools(state: State):
    """
    Route to the ToolNode if there are more prompts to process, else END.
    """
    batch_prompts = state.get("batch_prompts", {})
    current_key = state.get("current_key")
    processed_keys = state.get("processed_keys", [])
    keys = list(batch_prompts.keys())

    log.debug(
        f"Routing tools - Current key: {current_key}, Processed: {processed_keys}, Total keys: {keys}"
    )

    # If all keys processed, end
    if not keys or set(keys) == set(processed_keys):
        log.info("All keys processed, routing to END")
        return END
    # If last message has tool calls, go to tool node
    messages = state.get("messages", [])
    ai_message = messages[-1] if messages else None
    if hasattr(ai_message, "tool_calls") and len(ai_message.tool_calls) > 0:
        log.info(
            f"Tool calls detected, routing to tools. Tool calls: {len(ai_message.tool_calls)}"
        )
        return "tools"
    log.info("No tool calls detected, routing to END")
    return END


def create_item_tool(api_url: str, auth_token: str = None):
    """Tool to create an item via API call"""

    @tool
    def create_item(item_json: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new item by making a POST request to the API"""
        log.info(f"Creating item with API URL: {api_url}")
        log.debug(f"Item JSON data: {item_json}")
        log.debug(f"Auth token provided: {'Yes' if auth_token else 'No'}")

        # Configure timeout with longer values for production, shorter for local
        if "localhost" in api_url or "127.0.0.1" in api_url:
            # Local development - shorter timeouts
            timeout = httpx.Timeout(
                connect=15.0,  # Time to establish connection
                read=30.0,  # Time to read response
                write=15.0,  # Time to write request
                pool=5.0,  # Time to acquire connection from pool
            )
            log.info("Using local development timeout settings")
        else:
            # Production - longer timeouts to handle cold starts and network latency
            timeout = httpx.Timeout(
                connect=60.0,  # Time to establish connection
                read=120.0,  # Time to read response (2 minutes for cold starts)
                write=120.0,  # Time to write request
                pool=30.0,  # Time to acquire connection from pool
            )
            log.info("Using production timeout settings")

        log.debug(
            f"Timeout configuration: connect={timeout.connect}s, read={timeout.read}s, write={timeout.write}s, pool={timeout.pool}s"
        )

        try:
            log.debug("Creating HTTP client with configured timeout...")
            with httpx.Client(follow_redirects=True, timeout=timeout) as client:
                log.info("HTTP client created successfully")

                # Always fetch CSRF token first
                log.info("Fetching CSRF token...")
                
                # Try CSRF token with a shorter timeout first to diagnose if that's the issue
                csrf_timeout = httpx.Timeout(connect=10.0, read=15.0, write=10.0, pool=5.0)
                log.debug(f"Using shorter timeout for CSRF: {csrf_timeout}")
                
                try:
                    with httpx.Client(follow_redirects=True, timeout=csrf_timeout) as csrf_client:
                        log.debug("Created separate CSRF client")
                        csrf_token = get_csrf_token(csrf_client, api_url)
                except Exception as csrf_e:
                    log.warning(f"CSRF with short timeout failed: {csrf_e}")
                    log.info("Retrying CSRF with main client and longer timeout...")
                    csrf_token = get_csrf_token(client, api_url)
                
                log.info("CSRF token obtained successfully")

                headers = {
                    "Content-Type": "application/json",
                    "accept": "application/json",
                    "X-CSRFToken": csrf_token,
                }

                # Add JWT auth token if provided
                if auth_token:
                    headers["Authorization"] = f"Bearer {auth_token}"
                    log.debug("Authorization header added")

                log.debug(f"Request headers: {dict(headers)}")
                log.info(f"Making POST request to: {api_url}/api/items")

                response = client.post(
                    f"{api_url}/api/items", json=item_json, headers=headers
                )

                log.info(f"Response received - Status: {response.status_code}")
                log.debug(f"Response headers: {dict(response.headers)}")
                log.debug(f"Response content length: {len(response.content)} bytes")

                response.raise_for_status()  # Raise an exception for HTTP error status codes

                response_data = response.json()
                log.info("Item created successfully")
                log.debug(f"Response data keys: {list(response_data.keys())}")

                return {"result": response_data}

        except httpx.TimeoutException as e:
            log.error(
                f"Timeout error during item creation: {type(e).__name__} - {str(e)}"
            )
            log.error(f"Timeout details: {timeout}")
            raise
        except httpx.HTTPStatusError as e:
            log.error(f"HTTP error during item creation: {e.response.status_code}")
            log.error(f"Response text: {e.response.text}")
            log.error(f"Response headers: {dict(e.response.headers)}")
            raise
        except httpx.RequestError as e:
            log.error(
                f"Request error during item creation: {type(e).__name__} - {str(e)}"
            )
            raise
        except Exception as e:
            log.error(
                f"Unexpected error during item creation: {type(e).__name__} - {str(e)}"
            )
            raise

    return create_item


global llm_with_tools


def chatbot(state: State):
    # Only use the prompt for the current key
    batch_prompts = state.get("batch_prompts", {})
    current_key = state.get("current_key")
    system_message = state["messages"][0]  # assume system message is first
    prompt = batch_prompts.get(current_key, "")

    log.info(f"Chatbot processing key: {current_key}")
    log.debug(f"Prompt length: {len(prompt)} characters")
    log.debug(
        f"Prompt preview: {prompt[:100]}..."
        if len(prompt) > 100
        else f"Full prompt: {prompt}"
    )

    # Replace user message with only the current prompt
    messages = [system_message, HumanMessage(content=prompt)]

    log.info("Invoking LLM with tools...")
    try:
        response = llm_with_tools.invoke(messages)
        log.info("LLM response received successfully")
        log.debug(f"Response type: {type(response).__name__}")
        if hasattr(response, "tool_calls"):
            log.debug(
                f"Tool calls in response: {len(response.tool_calls) if response.tool_calls else 0}"
            )
        return {"messages": [response]}
    except Exception as e:
        log.error(f"Error invoking LLM: {type(e).__name__} - {str(e)}")
        raise


# For demonstration, run the agent with a sample prompt
def run_agent(batch_prompts: dict, jwt_token: str = None):
    import datetime

    log.info("Starting agent run")
    log.info(f"Batch prompts count: {len(batch_prompts)}")
    log.debug(f"Batch prompts keys: {list(batch_prompts.keys())}")
    log.debug(f"JWT token provided: {'Yes' if jwt_token else 'No'}")

    today_iso = datetime.date.today().isoformat()
    # batch_prompts: dict of {key: prompt}
    keys = list(batch_prompts.keys())
    if not keys:
        log.error("No prompts provided for batch add")
        raise ValueError("No prompts provided for batch add.")
    first_key = keys[0]
    log.info(f"First key to process: {first_key}")

    if prod:
        api_url = "https://magnificent-optimism-production.up.railway.app"
        log.info(f"Using production API URL: {api_url}")
        tool = create_item_tool(
            api_url=api_url,
            auth_token=jwt_token,
        )
    else:
        api_url = "http://localhost:8000"
        log.info(f"Using development API URL: {api_url}")
        tool = create_item_tool(api_url=api_url, auth_token=jwt_token)

    global llm_with_tools
    log.info("Initializing LLM with tools...")
    llm_with_tools = ChatOpenAI(
        model="gpt-4.1", temperature=0, request_timeout=120
    ).bind_tools([tool])
    log.info("LLM with tools initialized successfully")

    graph_builder = StateGraph(State)
    graph_builder.add_node("chatbot", chatbot)
    tool_node = ToolNode(tools=[tool])
    graph_builder.add_node("tools", tool_node)
    # how relevant is the graph with more programmatic approach shown in while loop?
    # can same functionality be accomplished with graph approach?
    graph_builder.add_conditional_edges("chatbot", route_tools)
    graph_builder.add_edge("chatbot", "tools")
    graph_builder.add_edge("tools", "chatbot")
    graph_builder.add_edge(START, "chatbot")
    graph_builder.add_edge("tools", END)

    log.info("Reading system instructions...")
    try:
        with open(SYSTEM_INSTRUCTIONS_PATH, "r", encoding="utf-8") as f:
            system_instructions = f.read()
        log.info(
            f"System instructions loaded successfully ({len(system_instructions)} characters)"
        )
    except FileNotFoundError:
        system_instructions = "You are an AI agent that helps create items. Extract item information from user prompts and create JSON objects."
        log.warning("System instructions file not found, using default instructions")

    # Initialize state
    state = {
        "messages": [SystemMessage(content=system_instructions)],
        "item_json": {},
        "batch_prompts": batch_prompts,
        "current_key": first_key,
        "processed_keys": [],
    }
    log.info("Initial state created")

    # pretty print context given to chatbot
    # import pprint

    # print("\nState (as roles and content):")
    # pprint.pprint(
    #     {
    #         "messages": [
    #             {"role": "system", "content": system_instructions},
    #             {"role": "user", "content": prompt_with_date},
    #         ]
    #     },
    #     indent=2,
    #     width=80,
    #     compact=False,
    # )

    # not right for prod
    memory = MemorySaver()
    graph = graph_builder.compile(checkpointer=memory)
    log.info("Graph compiled successfully")

    config = {"configurable": {"thread_id": "1"}}
    # Main batch loop
    log.info("Starting main batch processing loop")
    loop_iteration = 0
    while True:
        loop_iteration += 1
        log.info(f"Batch loop iteration {loop_iteration}")

        # Only use the prompt for the current key
        current_key = state["current_key"]
        prompt = batch_prompts[current_key]
        log.info(f"Processing key: {current_key}")

        state["messages"] = [
            SystemMessage(content=system_instructions),
            HumanMessage(content=prompt),
        ]
        # Run chatbot node
        log.info("Running chatbot node...")
        chatbot_result = chatbot(state)
        state["messages"].extend(chatbot_result["messages"])
        log.info("Chatbot node completed")

        # Check if tool call is needed
        route_decision = route_tools(state)
        log.info(f"Route decision: {route_decision}")

        if route_decision == "tools":
            # Run tool node
            log.info("Running tool node...")
            try:
                tool_result = tool_node.invoke(state)
                log.info("Tool node completed successfully")
                # Optionally, collect result
                # state["item_json"][current_key] = tool_result.get("result")
                state["messages"].extend(tool_result.get("messages", []))
            except Exception as e:
                log.error(f"Error in tool node: {type(e).__name__} - {str(e)}")
                raise

        # Mark as processed
        state["processed_keys"].append(current_key)
        log.info(f"Key {current_key} marked as processed")

        # Find next key
        remaining = [
            k for k in batch_prompts.keys() if k not in state["processed_keys"]
        ]
        log.debug(f"Remaining keys: {remaining}")

        if not remaining:
            log.info("No remaining keys, breaking loop")
            break
        state["current_key"] = remaining[0]
        log.info(f"Next key to process: {state['current_key']}")

        try:
            png_data = graph.get_graph().draw_mermaid_png()
            with open(GRAPH_PATH, "wb") as f:
                f.write(png_data)
            log.debug("Graph visualization saved successfully")
        except Exception as e:
            # This requires some extra dependencies and is optional
            log.debug(f"Could not save graph visualization: {e}")
            pass

    log.info("Batch processing completed successfully")
    # Optionally, return all results
    result = {
        "message": "batch agent graph executed",
        "processed_keys": state["processed_keys"],
    }
    log.info(f"Final result: {result}")
    return result


if __name__ == "__main__":
    # Sample batch prompts: key is identifier, value is prompt
    batch_prompts = {
        "1": "Add an item: name is 'Red Apple', received on 2025-06-29.",
        "2": "Add an item: name is 'Blue Pen', received on 2025-06-29.",
        "3": "Add an item: name is 'Notebook', received on 2025-06-29.",
    }
    log.info("Starting main execution with sample batch prompts")
    try:
        result = run_agent(
            batch_prompts,
            "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18yeDdRVmt6cFFPclFtanlLWU5xU0h6V1ViQTIiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NTEzNDYzNjAsImZ2YSI6WzUyNjEsLTFdLCJpYXQiOjE3NTEzNDYzMDAsImlzcyI6Imh0dHBzOi8vdGVhY2hpbmctc3R1cmdlb24tMjUuY2xlcmsuYWNjb3VudHMuZGV2IiwibmJmIjoxNzUxMzQ2MjkwLCJzaWQiOiJzZXNzXzJ6NXA4MG9tSEJiS2JFWTBZSWRTdG1hZW14YyIsInN1YiI6InVzZXJfMnhMUHF2S2Y1MjZGYm1oU2xJaHRLRU5LelYzIiwidiI6Mn0.jezgv6UQWjXS3r2N3IihDG0w8DuBFZNAFZMYBiU74YiyHZGUrZeit3gYBUtwwDS5eB5-fpxPbvLNiH37Fwc-T1RjG1Cdd5bBGsiKp9Uk7QOekAIZ4DLMu5p0xatndQPvqKlsTRYIUK4yTLEm99C81ovMH_7zw7WvvSetbwRhCAUJ406ZcY4tsxWPhXjct_GoObfu_9qYswmFmzsTolGx8Q-yQ1-S-dQOeLSmzy46LpSjtNrL3PzmudP2oaZXOt3cJE3-7JgY4z5YZjk_o4QKGXnyhdGeoYB5DHszNwEDNNSsYv0UUl6mZE5GcHhnsGCsNxkIA_b59KumOfpQCUyCwA",
        )
        log.info("Main execution completed successfully")
        print("Batch run result:", result)
    except Exception as e:
        log.error(f"Main execution failed: {type(e).__name__} - {str(e)}")
        raise
