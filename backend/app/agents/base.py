from abc import ABC, abstractmethod
from typing import Optional
import httpx
import json
from ..config import settings
from ..models import MCPContext, AgentMessage


class BaseAgent(ABC):
    """Base class for all agents in the A2A protocol."""
    
    def __init__(self, name: str):
        self.name = name
        self.ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        self.model = settings.OLLAMA_MODEL
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Return the system prompt for this agent."""
        pass
    
    @abstractmethod
    async def process(self, message: AgentMessage) -> AgentMessage:
        """Process an incoming message and return a response."""
        pass
    
    async def call_ollama(self, prompt: str, system_prompt: Optional[str] = None) -> str:
        """Call Ollama API and return the response."""
        system = system_prompt or self.get_system_prompt()
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
            }
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(self.ollama_url, json=payload)
                response.raise_for_status()
                result = response.json()
                return result.get("response", "")
            except httpx.HTTPError as e:
                print(f"Ollama API error: {e}")
                raise
    
    async def call_ollama_streaming(self, prompt: str, system_prompt: Optional[str] = None):
        """Call Ollama API with streaming and yield chunks."""
        system = system_prompt or self.get_system_prompt()
        
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system,
            "stream": True,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
            }
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", self.ollama_url, json=payload) as response:
                async for line in response.aiter_lines():
                    if line:
                        try:
                            data = json.loads(line)
                            if "response" in data:
                                yield data["response"]
                            if data.get("done", False):
                                break
                        except json.JSONDecodeError:
                            continue
    
    def create_response(
        self,
        to_agent: str,
        action: str,
        payload: dict,
        context: MCPContext
    ) -> AgentMessage:
        """Create a response message."""
        return AgentMessage(
            from_agent=self.name,
            to_agent=to_agent,
            action=action,
            payload=payload,
            context=context
        )
