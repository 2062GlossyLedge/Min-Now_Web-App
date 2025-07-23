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


prod = os.getenv("PROD", "false").lower() == "true"

# from clerk_backend_api import Clerk
# from backend.minNow.auth import ClerkAuth
# from django.http import HttpRequest
from langchain.chat_models import init_chat_model

os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
os.environ["LANGSMITH_TRACING"] = os.getenv("LANGSMITH_TRACING", "true")
os.environ["LANGSMITH_API_KEY"] = os.getenv("LANGSMITH_API_KEY")

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
    resp = client.get(f"{api_url}/api/csrf-token", follow_redirects=True)
    resp.raise_for_status()
    return resp.json()["token"]


def route_tools(state: State):
    """
    Route to the ToolNode if there are more prompts to process, else END.
    """
    batch_prompts = state.get("batch_prompts", {})
    current_key = state.get("current_key")
    processed_keys = state.get("processed_keys", [])
    keys = list(batch_prompts.keys())
    # If all keys processed, end
    if not keys or set(keys) == set(processed_keys):
        return END
    # If last message has tool calls, go to tool node
    messages = state.get("messages", [])
    ai_message = messages[-1] if messages else None
    if hasattr(ai_message, "tool_calls") and len(ai_message.tool_calls) > 0:
        return "tools"
    return END


def create_item_tool(api_url: str, auth_token: str = None):
    """Tool to create an item via API call"""

    @tool
    def create_item(item_json: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new item by making a POST request to the API"""
        with httpx.Client(follow_redirects=True) as client:
            csrf_token = get_csrf_token(client, api_url)
            headers = {
                "Content-Type": "application/json",
                "accept": "application/json",
                "X-CSRFToken": csrf_token,
            }
            if auth_token:
                headers["Authorization"] = f"Bearer {auth_token}"
            response = client.post(
                f"{api_url}/api/items", json=item_json, headers=headers
            )
            return {"result": response.json()}

    return create_item


global llm_with_tools


def chatbot(state: State):
    # Only use the prompt for the current key
    batch_prompts = state.get("batch_prompts", {})
    current_key = state.get("current_key")
    system_message = state["messages"][0]  # assume system message is first
    prompt = batch_prompts.get(current_key, "")
    # Replace user message with only the current prompt
    messages = [system_message, HumanMessage(content=prompt)]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


# For demonstration, run the agent with a sample prompt
def run_agent(batch_prompts: dict, jwt_token: str = None):
    import datetime

    today_iso = datetime.date.today().isoformat()
    # batch_prompts: dict of {key: prompt}
    keys = list(batch_prompts.keys())
    if not keys:
        raise ValueError("No prompts provided for batch add.")
    first_key = keys[0]
    if prod:
        tool = create_item_tool(api_url="https://min-now.store", auth_token=jwt_token)
    else:
        tool = create_item_tool(api_url="http://localhost:8000", auth_token=jwt_token)
    global llm_with_tools
    llm_with_tools = ChatOpenAI(model="gpt-4.1", temperature=0).bind_tools([tool])
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
    try:
        with open(SYSTEM_INSTRUCTIONS_PATH, "r", encoding="utf-8") as f:
            system_instructions = f.read()
    except FileNotFoundError:
        system_instructions = "You are an AI agent that helps create items. Extract item information from user prompts and create JSON objects."
    # Initialize state
    state = {
        "messages": [SystemMessage(content=system_instructions)],
        "item_json": {},
        "batch_prompts": batch_prompts,
        "current_key": first_key,
        "processed_keys": [],
    }
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

    config = {"configurable": {"thread_id": "1"}}
    # Main batch loop
    while True:
        # Only use the prompt for the current key
        current_key = state["current_key"]
        prompt = batch_prompts[current_key]
        state["messages"] = [
            SystemMessage(content=system_instructions),
            HumanMessage(content=prompt),
        ]
        # Run chatbot node
        chatbot_result = chatbot(state)
        state["messages"].extend(chatbot_result["messages"])
        # Check if tool call is needed
        if route_tools(state) == "tools":
            # Run tool node
            tool_result = tool_node.invoke(state)
            # Optionally, collect result
            # state["item_json"][current_key] = tool_result.get("result")
            state["messages"].extend(tool_result.get("messages", []))
        # Mark as processed
        state["processed_keys"].append(current_key)
        # Find next key
        remaining = [
            k for k in batch_prompts.keys() if k not in state["processed_keys"]
        ]
        if not remaining:
            break
        state["current_key"] = remaining[0]

        try:
            png_data = graph.get_graph().draw_mermaid_png()
            with open(GRAPH_PATH, "wb") as f:
                f.write(png_data)
        except Exception:
            # This requires some extra dependencies and is optional
            pass
    # Optionally, return all results
    return {
        "message": "batch agent graph executed",
        "processed_keys": state["processed_keys"],
    }


if __name__ == "__main__":
    # Sample batch prompts: key is identifier, value is prompt
    batch_prompts = {
        "1": "Add an item: name is 'Red Apple', received on 2025-06-29.",
        "2": "Add an item: name is 'Blue Pen', received on 2025-06-29.",
        "3": "Add an item: name is 'Notebook', received on 2025-06-29.",
    }
    result = run_agent(
        batch_prompts,
        "eyJhbGciOiJSUzI1NiIsImNhdCI6ImNsX0I3ZDRQRDExMUFBQSIsImtpZCI6Imluc18yeDdRVmt6cFFPclFtanlLWU5xU0h6V1ViQTIiLCJ0eXAiOiJKV1QifQ.eyJhenAiOiJodHRwOi8vbG9jYWxob3N0OjMwMDAiLCJleHAiOjE3NTEzNDYzNjAsImZ2YSI6WzUyNjEsLTFdLCJpYXQiOjE3NTEzNDYzMDAsImlzcyI6Imh0dHBzOi8vdGVhY2hpbmctc3R1cmdlb24tMjUuY2xlcmsuYWNjb3VudHMuZGV2IiwibmJmIjoxNzUxMzQ2MjkwLCJzaWQiOiJzZXNzXzJ6NXA4MG9tSEJiS2JFWTBZSWRTdG1hZW14YyIsInN1YiI6InVzZXJfMnhMUHF2S2Y1MjZGYm1oU2xJaHRLRU5LelYzIiwidiI6Mn0.jezgv6UQWjXS3r2N3IihDG0w8DuBFZNAFZMYBiU74YiyHZGUrZeit3gYBUtwwDS5eB5-fpxPbvLNiH37Fwc-T1RjG1Cdd5bBGsiKp9Uk7QOekAIZ4DLMu5p0xatndQPvqKlsTRYIUK4yTLEm99C81ovMH_7zw7WvvSetbwRhCAUJ406ZcY4tsxWPhXjct_GoObfu_9qYswmFmzsTolGx8Q-yQ1-S-dQOeLSmzy46LpSjtNrL3PzmudP2oaZXOt3cJE3-7JgY4z5YZjk_o4QKGXnyhdGeoYB5DHszNwEDNNSsYv0UUl6mZE5GcHhnsGCsNxkIA_b59KumOfpQCUyCwA",
    )
    print("Batch run result:", result)
