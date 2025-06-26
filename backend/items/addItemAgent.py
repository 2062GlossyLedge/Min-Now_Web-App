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


class State(TypedDict):
    messages: Annotated[list, add_messages]
    item_json: Dict[str, Any]


# Tool node: POST request to create item with CSRF and auth headers
def get_csrf_token(client, api_url):
    resp = client.get(f"{api_url}/api/csrf-token")
    resp.raise_for_status()
    return resp.json()["token"]


def create_item_tool(api_url: str, auth_token: str = None):
    """Tool to create an item via API call"""

    @tool
    def create_item(item_json: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new item by making a POST request to the API"""
        with httpx.Client() as client:
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
    messages = state["messages"]
    response = llm_with_tools.invoke(messages)
    return {"messages": [response]}


# For demonstration, run the agent with a sample prompt
def run_agent(prompt: str, jwt_token: str = None):
    # Create tool with JWT token if provided
    tool = create_item_tool(api_url="http://localhost:8000", auth_token=jwt_token)

    print("prompt for agent", prompt)

    # Update the tools list with the new tool instance
    tools = [tool]
    global llm_with_tools
    llm_with_tools = ChatOpenAI(model="gpt-4.1", temperature=0).bind_tools(tools)

    print("llm_with_tools", type(llm_with_tools))

    # Create a new graph with the updated tools
    graph_builder = StateGraph(State)
    graph_builder.add_node("chatbot", chatbot)
    # checks state to see of any tools calls. What does a tool call look like? - Tool name and tool args.
    # Outputs tools results, name of tool called, and tool call id
    tool_node = ToolNode(tools=[tool])
    graph_builder.add_node("tools", tool_node)
    graph_builder.add_conditional_edges(
        "chatbot",
        tools_condition,
    )
    graph_builder.add_edge("chatbot", "tools")
    graph_builder.add_edge(START, "chatbot")
    graph_builder.add_edge("tools", END)

    # Read system instructions
    print("SYSTEM_INSTRUCTIONS_PATH", SYSTEM_INSTRUCTIONS_PATH)
    try:
        with open(SYSTEM_INSTRUCTIONS_PATH, "r", encoding="utf-8") as f:
            system_instructions = f.read()
    except FileNotFoundError:
        system_instructions = "You are an AI agent that helps create items. Extract item information from user prompts and create JSON objects."

    # Initialize state with system instructions and user prompt
    state = {
        "messages": [
            SystemMessage(content=system_instructions),
            HumanMessage(content=prompt),
        ]
    }

    # import pprint

    # print("\nState (as roles and content):")
    # pprint.pprint(
    #     {
    #         "messages": [
    #             {"role": "system", "content": system_instructions},
    #             {"role": "user", "content": prompt},
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
    events = graph.stream(
        {
            "messages": [
                SystemMessage(content=system_instructions),
                HumanMessage(content=prompt),
            ]
        },
        config,
        stream_mode="values",
    )
    for event in events:
        if "messages" in event:
            event["messages"][-1].pretty_print()

    # shows order of graph flow
    to_replay = None
    for state in graph.get_state_history(config):
        print("Num Messages: ", len(state.values["messages"]), "Next: ", state.next)
        print("-" * 80)
        if len(state.values["messages"]) == 6:
            # We are somewhat arbitrarily selecting a specific state based on the number of chat messages in the state.
            to_replay = state

    snapshot = graph.get_state(config)

    # print({k: v for k, v in snapshot.values.items() if k in ("name")})
    # del state

    # print(snapshot)

    result = {"message": "agent graph executed"}
    return result
