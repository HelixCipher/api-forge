from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sse_starlette.sse import EventSourceResponse
import json
import asyncio

from .config import settings
from .models import ChatRequest, ChatResponse, GenerateSpecRequest, ValidationResult, Endpoint
from .agents.orchestrator import orchestrator
from .spec_generator import spec_to_yaml, spec_to_json

app = FastAPI(
    title="API Forge Backend",
    description="Backend service for OpenAPI specification generation with multi-agent architecture",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "api-forge-backend"}


@app.get("/api/system-status")
async def system_status():
    """
    Get system status including GPU/CPU mode and model availability.
    """
    import httpx
    import os
    
    status = {
        "compute_mode": "unknown",
        "ollama_connected": False,
        "model_name": settings.OLLAMA_MODEL,
        "model_loaded": False,
        "model_loading": False,
        "model_progress": 0,
        "gpu_info": None
    }
    
    # Detect compute mode from environment and Ollama URL
    compose_profile = os.environ.get("COMPOSE_PROFILES", "").lower()
    docker_profile = os.environ.get("DOCKER_PROFILE", "").lower()
    ollama_url = settings.OLLAMA_BASE_URL.lower()
    
    # Check Ollama URL first - it's the most reliable indicator
    if "ollama-gpu-nvidia" in ollama_url:
        status["compute_mode"] = "gpu-nvidia"
    elif "ollama-gpu-amd" in ollama_url:
        status["compute_mode"] = "gpu-amd"
    elif "ollama-cpu" in ollama_url:
        status["compute_mode"] = "cpu"
    else:
        # Fallback to environment variables
        if ("nvidia" in compose_profile or "nvidia" in docker_profile or 
            "gpu-nvidia" in compose_profile or "gpu-nvidia" in docker_profile):
            status["compute_mode"] = "gpu-nvidia"
        elif ("amd" in compose_profile or "amd" in docker_profile or 
              "gpu-amd" in compose_profile or "gpu-amd" in docker_profile):
            status["compute_mode"] = "gpu-amd"
        else:
            # Try to detect GPU availability by checking for NVIDIA runtime or AMD devices
            try:
                import subprocess
                # Check for NVIDIA GPUs
                result = subprocess.run(['nvidia-smi'], capture_output=True, text=True, timeout=5)
                if result.returncode == 0:
                    status["compute_mode"] = "gpu-nvidia"
                else:
                    # Check for AMD GPUs (ROCm)
                    result = subprocess.run(['rocm-smi'], capture_output=True, text=True, timeout=5)
                    if result.returncode == 0:
                        status["compute_mode"] = "gpu-amd"
                    else:
                        status["compute_mode"] = "cpu"
            except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
                # Fallback to CPU if detection fails
                status["compute_mode"] = "cpu"
    
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Check Ollama connection
            try:
                response = await client.get(f"{settings.OLLAMA_URL}/api/tags")
                if response.status_code == 200:
                    status["ollama_connected"] = True
                    data = response.json()
                    models = data.get("models", [])
                    
                    # Check if our model is loaded
                    for model in models:
                        if settings.OLLAMA_MODEL in model.get("name", ""):
                            status["model_loaded"] = True
                            status["model_progress"] = 100
                            break
            except:
                pass
            
            # Check running models for GPU info
            if status["ollama_connected"]:
                try:
                    ps_response = await client.get(f"{settings.OLLAMA_URL}/api/ps")
                    if ps_response.status_code == 200:
                        ps_data = ps_response.json()
                        running_models = ps_data.get("models", [])
                        for model in running_models:
                            if settings.OLLAMA_MODEL in model.get("name", ""):
                                status["model_loading"] = False
                                status["model_loaded"] = True
                                # Extract GPU info if available
                                details = model.get("details", {})
                                if details:
                                    status["gpu_info"] = {
                                        "family": details.get("family"),
                                        "parameter_size": details.get("parameter_size"),
                                        "quantization": details.get("quantization_level")
                                    }
                except:
                    pass
    except:
        pass
    
    return status


@app.post("/api/chat", response_model=dict)
async def chat(request: ChatRequest):
    """
    Handle chat messages for API design.
    Uses the multi-agent A2A protocol with MCP context sharing.
    """
    try:
        # Get conversation ID from context if provided
        conversation_id = request.context.get("conversation_id") if request.context else None
        
        # Build history from messages
        history = [{"role": msg.role.value, "content": msg.content} for msg in request.messages[:-1]]
        
        # Get the latest user message
        user_message = request.messages[-1].content if request.messages else ""
        
        # Process through orchestrator
        result = await orchestrator.handle_user_message(
            user_message=user_message,
            conversation_id=conversation_id,
            history=history
        )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream chat responses for real-time feedback.
    """
    conversation_id = request.context.get("conversation_id") if request.context else None
    history = [{"role": msg.role.value, "content": msg.content} for msg in request.messages[:-1]]
    user_message = request.messages[-1].content if request.messages else ""
    
    async def generate():
        try:
            async for chunk in orchestrator.handle_user_message_streaming(
                user_message=user_message,
                conversation_id=conversation_id,
                history=history
            ):
                yield {
                    "event": "message",
                    "data": json.dumps({"content": chunk})
                }
            yield {
                "event": "done",
                "data": json.dumps({"status": "complete"})
            }
        except Exception as e:
            yield {
                "event": "error",
                "data": json.dumps({"error": str(e)})
            }
    
    return EventSourceResponse(generate())


@app.post("/api/generate-spec")
async def generate_spec(request: GenerateSpecRequest):
    """
    Generate and validate OpenAPI specification from approved endpoints.
    """
    try:
        endpoints = [Endpoint(**ep.model_dump()) for ep in request.endpoints]
        
        result = await orchestrator.generate_and_validate_spec(
            endpoints=endpoints,
            title=request.title,
            version=request.version,
            description=request.description
        )
        
        # Add formatted output
        if result.get("spec"):
            result["yaml"] = spec_to_yaml(result["spec"])
            result["json"] = spec_to_json(result["spec"])
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/validate")
async def validate_spec(spec: dict):
    """
    Validate an OpenAPI specification.
    """
    try:
        from .agents.validator import ValidatorAgent
        validator = ValidatorAgent()
        result = validator.validate_spec(spec)
        return result.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/docs/edit")
async def edit_docs(request: dict):
    """
    Use AI to edit/improve documentation sections.
    """
    try:
        section = request.get("section", "")
        element_id = request.get("element_id")
        current_content = request.get("current_content", "")
        user_prompt = request.get("user_prompt", "")
        
        # Use Ollama to improve the content
        import httpx
        
        system_prompt = """You are a technical documentation writer. 
Your task is to improve API documentation based on user requests.
Keep the content clear, concise, and professional.
Only output the improved content, nothing else."""

        prompt = f"""Section: {section}
Current content:
{current_content}

User request: {user_prompt}

Provide the improved content:"""

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.OLLAMA_URL}/api/generate",
                json={
                    "model": settings.OLLAMA_MODEL,
                    "prompt": prompt,
                    "system": system_prompt,
                    "stream": False,
                }
            )
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "updated_content": result.get("response", current_content).strip(),
                    "explanation": "Content updated based on your request."
                }
            else:
                raise HTTPException(status_code=500, detail="Failed to generate improved content")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="AI request timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/context/{conversation_id}")
async def get_context(conversation_id: str):
    """
    Get the current MCP context state for a conversation.
    """
    state = orchestrator.get_context_state(conversation_id)
    if not state:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return state


@app.delete("/api/context/{conversation_id}")
async def clear_context(conversation_id: str):
    """
    Clear the context for a conversation.
    """
    if conversation_id in orchestrator.contexts:
        del orchestrator.contexts[conversation_id]
        return {"status": "cleared"}
    raise HTTPException(status_code=404, detail="Conversation not found")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True
    )
