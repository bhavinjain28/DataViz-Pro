"""Claude chat endpoint: SSE streaming + the full tool-use loop.

POST /api/chat/stream
Request:  {"session_id": ..., "message": ..., "history": [{role, content}, ...]}
Response: text/event-stream where each `data:` line is JSON:
    {"type": "text",       "content": "..."}                       streamed tokens
    {"type": "tool_start", "tool", "description", "detail"}        a tool is running
    {"type": "tool_done",  "tool", "ok"}                           tool finished
    {"type": "chart_data", "data": {...}}                          chart/forecast for the dashboard
    {"type": "error",      "content": "..."}                       user-friendly failure
followed by a final literal "data: [DONE]".
"""

import json
import os
from functools import lru_cache
from typing import Literal

import anthropic
from anyio import to_thread
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.session_store import get_session
from services.tool_executor import CHART_PAYLOAD_TOOLS, execute_tool
from tools import ALL_TOOLS

router = APIRouter()

MAX_TOOL_ROUNDS = 5
MAX_HISTORY_MESSAGES = 10
MAX_TOKENS = 2048

SYSTEM_TEMPLATE = """You are an expert BI Analyst and data copilot embedded inside \
DataViz Pro. You have access to the user's actual dataset and can run real code on it \
using your tools. ALWAYS use tools to answer data questions — never guess from the \
context summary alone.

## DATASET CONTEXT (for orientation only — use tools for actual numbers)
{data_context}

## TOOL USAGE RULES
- For ANY question about specific numbers, rankings, comparisons: use run_dataframe_query or run_sql_query
- For "show me a chart/graph/plot": use generate_chart_data
- For "forecast/predict/future": use run_forecast
- For "outliers/anomalies/unusual": use detect_anomalies
- You may chain multiple tool calls in one response (e.g. query data then generate a chart)
- After getting tool results, synthesize them into a clear, confident business narrative

## ANSWER FORMAT
- Lead with the single most important insight — bold the key metric: **Revenue: $1.2M**
- Support with 2-3 specific numbers from your tool results
- Use bullet points only for 3+ items
- Keep under 200 words unless the user asks to elaborate
- End with one concrete recommendation when relevant
- Tone: confident senior analyst briefing a VP. No filler. No hedging.
- Never say "based on my context" — you ran actual code, so say "based on the data"
- When you generate a chart, say "📊 I've added a [chart name] to your dashboard"

## WHAT NOT TO DO
- Never hallucinate numbers — always run a tool to verify
- Never say "I don't have access to" — use a tool
- No "Great question!" or "Certainly!" openers
"""


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    session_id: str
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


@lru_cache(maxsize=1)
def _client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic()


def _model() -> str:
    return os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def _stream_chat(req: ChatRequest):
    session = get_session(req.session_id)
    if session is None:
        yield _sse({"type": "error",
                    "content": "Session not found or expired. Please re-upload your file."})
        yield "data: [DONE]\n\n"
        return

    system_prompt = SYSTEM_TEMPLATE.format(data_context=session["data_context"])
    messages = [
        m.model_dump() for m in req.history[-MAX_HISTORY_MESSAGES:] if m.content.strip()
    ]
    messages.append({"role": "user", "content": req.message})

    client = _client()
    try:
        for _ in range(MAX_TOOL_ROUNDS + 1):
            async with client.messages.stream(
                model=_model(),
                max_tokens=MAX_TOKENS,
                system=[{
                    "type": "text",
                    "text": system_prompt,
                    # Tools + system are a stable per-session prefix; cache them
                    # so multi-turn conversations only pay for new messages.
                    "cache_control": {"type": "ephemeral"},
                }],
                tools=ALL_TOOLS,
                messages=messages,
            ) as stream:
                async for event in stream:
                    if (event.type == "content_block_delta"
                            and event.delta.type == "text_delta"):
                        yield _sse({"type": "text", "content": event.delta.text})
                final = await stream.get_final_message()

            if final.stop_reason != "tool_use":
                break

            # Echo the assistant turn (incl. tool_use blocks), execute each
            # tool, then loop so Claude can synthesize the results.
            messages.append({"role": "assistant", "content": final.content})
            tool_results = []
            for block in final.content:
                if block.type != "tool_use":
                    continue
                tool_input = dict(block.input or {})
                detail = (tool_input.get("code") or tool_input.get("sql") or "")[:300]
                yield _sse({
                    "type": "tool_start",
                    "tool": block.name,
                    "description": (tool_input.get("description")
                                    or tool_input.get("title") or block.name),
                    "detail": detail,
                })
                result = await to_thread.run_sync(
                    execute_tool, block.name, tool_input, req.session_id
                )
                ok = not result.startswith("Error")
                if ok and block.name in CHART_PAYLOAD_TOOLS:
                    try:
                        yield _sse({"type": "chart_data", "data": json.loads(result)})
                    except json.JSONDecodeError:
                        pass
                yield _sse({"type": "tool_done", "tool": block.name, "ok": ok})
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": result,
                    "is_error": not ok,
                })
            messages.append({"role": "user", "content": tool_results})
        else:
            yield _sse({"type": "error",
                        "content": "Reached the tool-use limit for a single message. "
                                   "Try asking a more focused question."})
    except anthropic.RateLimitError:
        yield _sse({"type": "error",
                    "content": "The AI service is rate-limited right now. "
                               "Wait a moment and try again."})
    except anthropic.APIStatusError as exc:
        yield _sse({"type": "error",
                    "content": f"AI service error ({exc.status_code}). Please try again."})
    except anthropic.APIConnectionError:
        yield _sse({"type": "error",
                    "content": "Could not reach the AI service. Check the server's "
                               "internet connection."})

    yield "data: [DONE]\n\n"


@router.post("/stream")
async def stream_chat(request: ChatRequest):
    return StreamingResponse(
        _stream_chat(request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
