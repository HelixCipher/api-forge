# Workflow Design Documentation

## Overview

API Forge implements a multi-agent system using the A2A (Agent-to-Agent) protocol with MCP (Model Context Protocol) for context sharing. This document explains the workflow design and how the system prompts guide API design.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              USER                                        │
│                         (Web Interface)                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   ChatPanel │  │  ReviewPanel│  │ SpecPreview │  │ Docs  │   │  Validation |  | MCP |  | 
│  │             │  │             │  │             │  │       │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                              REST API
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                                │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                     ORCHESTRATOR AGENT                          │    │
│  │   • Coordinates workflow between agents                         │    │
│  │   • Manages conversation state                                  │    │
│  │   • Handles iteration logic                                     │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                    │                              │                      │
│                    ▼                              ▼                      │
│  ┌──────────────────────────┐    ┌──────────────────────────┐          │
│  │      DRAFTER AGENT       │    │     VALIDATOR AGENT      │          │
│  │                          │    │                          │          │
│  │  • Generates endpoints   │    │  • Validates OpenAPI     │          │
│  │  • Follows REST rules    │    │  • Returns errors/warns  │          │
│  │  • Uses Ollama LLM       │    │  • Suggests fixes        │          │
│  └──────────────────────────┘    └──────────────────────────┘          │
│                    │                                                     │
│                    ▼                                                     │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                          OLLAMA                                 │    │
│  │                    (Local LLM Service)                          │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

## MCP Context Protocol

The MCP (Model Context Protocol) enables shared context between agents:

```python
class MCPContext:
    conversation_id: str          # Unique conversation identifier
    user_requirements: str        # Accumulated user requirements
    proposed_endpoints: list      # List of proposed API endpoints
    current_spec: dict           # Current OpenAPI specification
    validation_results: dict     # Validation errors/warnings
    iteration_count: int         # Number of fix iterations
    phase: str                   # Current workflow phase
```

### Context Flow

1. **User Message** → Creates/updates context with requirements
2. **Drafter Agent** → Reads context, adds proposed endpoints
3. **Orchestrator** → Updates context with drafter output
4. **Validator Agent** → Reads spec from context, adds validation results
5. **Iteration** → Context tracks iterations for auto-fixing

## A2A Protocol Messages

Agents communicate using structured messages:

```python
class AgentMessage:
    from_agent: str    # Source agent name
    to_agent: str      # Target agent name
    action: str        # Action type (draft_request, validate_request, etc.)
    payload: dict      # Action-specific data
    context: MCPContext # Shared context
```

### Message Types

| Action | From | To | Description |
|--------|------|-----|-------------|
| `draft_request` | orchestrator | drafter | Request endpoint proposals |
| `draft_complete` | drafter | orchestrator | Return proposed endpoints |
| `validate_request` | orchestrator | validator | Request spec validation |
| `validation_complete` | validator | orchestrator | Spec is valid |
| `validation_failed` | validator | orchestrator | Spec has errors |

## Workflow Phases

```
 ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 │  GATHERING  │────▶│  PROPOSING  │────▶│  REVIEWING  │
 └─────────────┘     └─────────────┘     └─────────────┘
                                                │
                                                ▼
 ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 │  COMPLETE   │◀────│  VALIDATING │◀────│ GENERATING  │
 └─────────────┘     └─────────────┘     └─────────────┘
        ▲                   │
        │                   │ (if errors, iteration_count++)
        │                   ▼
        │          ┌─────────────────┐
        └───────────│  AUTO-FIXING   │
                     │(up to 5 times)│
                     └─────────────────┘
 ```

### Phase Descriptions

1. **GATHERING**: Collecting user requirements through chat with streaming responses
2. **PROPOSING**: AI proposes endpoints based on requirements with sophisticated parsing
3. **REVIEWING**: User reviews and approves/rejects endpoints individually
4. **GENERATING**: Creating OpenAPI specification from approved endpoints
5. **VALIDATING**: Comprehensive validation with enhanced rule checking
6. **COMPLETE**: Valid specification ready for export

**Iteration Handling**: Auto-fixing validation errors through iteration tracking (max 5 iterations)
- Iteration count is tracked via `iteration_count` in MCP context
- No separate "ITERATING" phase needed - iteration happens within VALIDATING phase

## System Prompts

### Drafter Agent System Prompt

```
You are an expert REST API designer. Your role is to IMMEDIATELY design RESTful APIs following best practices.

IMMEDIATELY design RESTful API endpoints for the user's request.
DO NOT ask for more details.
NEVER ask for more details.
Design endpoints that cover the complete domain.

CRITICAL RULES:
1. ONLY discuss API design, REST principles, and OpenAPI specifications
2. If user asks about anything unrelated to API design, politely redirect them
3. Follow REST naming conventions:
   - Use plural nouns for resources (e.g., /users, /products)
   - No verbs in paths (use HTTP methods instead)
   - Use kebab-case for multi-word resources
   - Use path parameters for specific resources (e.g., /users/{id})
4. ALWAYS consider standard CRUD operations
5. Include proper HTTP status codes
6. Design with security in mind
7. DO NOT engage in conversations about weather, jokes, sports, or non-technical topics

When proposing endpoints, format them as:
[ENDPOINTS]
- GET /resources - List all resources with pagination
- POST /resources - Create a new resource
- GET /resources/{id} - Get specific resource by ID
- PUT /resources/{id} - Update specific resource
- DELETE /resources/{id} - Delete specific resource
[/ENDPOINTS]

[SCHEMAS]
ResourceName: { field1: type, field2: type, ... }
[/SCHEMAS]
```
You are an expert REST API designer. Your role is to design RESTful APIs following best practices.

IMPORTANT RULES:
1. ONLY discuss API design, REST principles, and OpenAPI specifications
2. If the user asks about anything unrelated to API design, politely redirect them
3. Follow REST naming conventions:
   - Use plural nouns for resources (e.g., /users, /products)
   - No verbs in paths (use HTTP methods instead)
   - Use kebab-case for multi-word resources
   - Use path parameters for specific resources (e.g., /users/{id})
4. Always consider standard CRUD operations
5. Include proper HTTP status codes
6. Design with security in mind

When proposing endpoints, format them as:
[ENDPOINTS]
- GET /resources - List all resources with pagination
- POST /resources - Create a new resource
...
[/ENDPOINTS]

[SCHEMAS]
ResourceName: { field1: type, field2: type, ... }
[/SCHEMAS]
```

### Key Prompt Features

1. **Topic Restriction**: Blocks non-API conversations
2. **REST Enforcement**: Explicit naming conventions
3. **Structured Output**: Specific format for parsing endpoints
4. **Schema Suggestions**: Data model recommendations

### Validator Agent System Prompt

```
You are an OpenAPI specification validator and fixer.
Your role is to analyze OpenAPI specs, identify issues, and suggest fixes.

When analyzing a spec, check for:
1. Required fields (openapi version, info, paths)
2. Valid path formats (must start with /)
3. Valid HTTP methods
4. Proper response definitions
5. Schema references are valid
6. Security definitions are complete
7. Parameter definitions for path variables

Provide clear, actionable suggestions to fix any issues found.
```

## Validation Rules

The validator checks for:

| Rule | Severity | Description |
|------|----------|-------------|
| OpenAPI Version | Error | Must be 3.x.x |
| YAML Syntax | Error | Proper spacing, colon formatting |
| Info Object | Error | title and version required |
| Path Format | Error | Must start with / |
| Response Codes | Error | POST→201, DELETE→204, proper status codes |
| Responses | Error | Each operation needs responses |
| Path Parameters | Error | Must be defined in parameters |
| Schema Naming | Error | Singular forms, proper naming |
| Schema Completeness | Error | Meaningful properties, not just id/timestamps |
| OperationId | Warning | Recommended for each operation |
| Description | Warning | Recommended for clarity |
| Request Body | Warning | POST/PUT/PATCH should have body |

## Iteration Logic

When validation fails:

1. Validator identifies specific errors using comprehensive rule checking
2. LLM generates targeted fixes based on error categories
3. Orchestrator applies fixes and updates MCP context
4. Maximum 5 iterations before returning incomplete spec
5. Context tracks iteration_count to prevent infinite loops
6. Error progression charts show improvement across iterations

## Example Workflow

```
User: "I need an API for a todo application"

1. Orchestrator receives streaming message
2. Creates MCP context with user_requirements
3. Sends draft_request to Drafter Agent
4. Drafter calls Ollama with aggressive system prompt + user message
5. Drafter parses response using sophisticated endpoint extraction
6. Returns draft_complete with endpoints:
   - GET /todos
   - POST /todos
   - GET /todos/{id}
   - PUT /todos/{id}
   - DELETE /todos/{id}
7. Frontend displays endpoints for individual approval
8. User reviews, approves/rejects specific endpoints
9. User clicks "Generate Spec" after approval
10. Orchestrator generates comprehensive OpenAPI spec
11. Sends validate_request to Validator Agent
12. Validator checks against openapi-spec-validator + enhanced rules
13. If errors: Auto-fix loop begins (up to 5 iterations)
14. Returns validation_complete when valid
15. Frontend displays final spec with YAML/JSON export options
16. MCP panel shows error progression and iteration count
```

## Error Handling

- Network errors: Connection timeout with retry mechanism
- Ollama timeout: 120 second timeout with clear error message  
- Validation loops: Maximum 5 iterations with error tracking
- Parse errors: Graceful degradation to raw response with extraction
- Content filtering: Non-API chat rejection with helpful redirection
- Streaming errors: Fallback to non-streaming response
- GPU detection: Automatic hardware detection fallback
```

## Enhanced Features (Beyond Basic Requirements)

### Advanced Validation System
- **YAML Syntax Validation**: Ensures proper formatting (parameters: [] not parameters:[])
- **Response Code Validation**: Enforces POST→201, DELETE→204 best practices
- **Schema Naming Rules**: Detects and corrects typos (Specy→Species)
- **Schema Completeness**: Requires meaningful properties beyond id/timestamps
- **Business Term Recognition**: Identifies domain-specific terminology

### Real-Time Features
- **Streaming Chat Responses**: Real-time endpoint generation feedback
- **Error Progression Charts**: Visual tracking of validation improvement
- **Live MCP Context Panel**: Shows conversation state and iterations
- **Multiple Export Formats**: Both YAML and JSON output options

### Robust Frontend Architecture
- **Individual Endpoint Approval**: Granular control over spec generation
- **GPU/CPU Mode Detection**: Automatic hardware detection with manual override
- **Comprehensive Error Display**: Separate error/warning categories
- **Responsive Design**: Mobile-friendly interface with real-time updates

### Additional API Endpoints
- `/api/system-status`: Hardware detection and model information
- `/api/context/{id}`: MCP context management endpoints
- `/api/docs/edit`: AI-powered documentation improvement
- `/api/chat/stream`: Real-time streaming responses

### Advanced Error Handling
- **Content Filtering**: Multi-layer non-API chat rejection
- **Gibberish Detection**: Special character ratio analysis
- **Hardware Detection Fallback**: Automatic GPU/CPU detection
- **Timeout Management**: 120-second LLM timeout with retry logic
