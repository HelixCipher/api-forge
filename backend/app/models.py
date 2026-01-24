from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from enum import Enum


class MessageRole(str, Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatMessage(BaseModel):
    """A single chat message."""
    role: MessageRole
    content: str
    timestamp: Optional[datetime] = None


class ChatRequest(BaseModel):
    """Request for chat endpoint."""
    messages: list[ChatMessage]
    context: Optional[dict] = None


class ChatResponse(BaseModel):
    """Response from chat endpoint."""
    content: str
    endpoints: Optional[list[dict]] = None
    schemas: Optional[dict] = None


class Endpoint(BaseModel):
    """API endpoint definition."""
    id: str
    method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"]
    path: str
    summary: str
    description: Optional[str] = None
    approved: bool = False


class GenerateSpecRequest(BaseModel):
    """Request to generate OpenAPI spec."""
    endpoints: list[Endpoint]
    title: str = "My API"
    version: str = "1.0.0"
    description: Optional[str] = None


class ValidationError(BaseModel):
    """A single validation error or warning."""
    path: str
    message: str
    severity: Literal["error", "warning", "info"]


class ValidationResult(BaseModel):
    """Result of OpenAPI spec validation."""
    valid: bool
    errors: list[ValidationError] = []
    warnings: list[ValidationError] = []


class MCPContext(BaseModel):
    """Model Context Protocol shared context."""
    conversation_id: str
    user_requirements: str = ""
    proposed_endpoints: list[Endpoint] = []
    current_spec: Optional[dict] = None
    validation_results: Optional[ValidationResult] = None
    iteration_count: int = 0
    phase: Literal["gathering", "proposing", "reviewing", "generating", "validating", "complete"] = "gathering"


class AgentMessage(BaseModel):
    """Message passed between agents in A2A protocol."""
    from_agent: str
    to_agent: str
    action: str
    payload: dict
    context: MCPContext
