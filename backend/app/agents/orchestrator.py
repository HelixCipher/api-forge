import re
import uuid
import yaml
from typing import Optional, AsyncIterator, List
from .base import BaseAgent
from .drafter import DrafterAgent
from .validator import ValidatorAgent
from ..models import MCPContext, AgentMessage, Endpoint
from ..spec_generator import generate_openapi_spec


def extract_endpoints_from_text(text: str) -> List[dict]:
    """
    Robust extractor for endpoints from LLM text output.
    """
    endpoints: List[dict] = []
    if not text:
        return endpoints

    blocks = re.findall(
        r'\[ENDPOINTS\]([\s\S]*?)(?:\[\/ENDPOINTS\]|\[SCHEMAS\]|\[ENDPOINTS\]|\Z)',
        text,
        flags=re.IGNORECASE
    )
    if not blocks:
        blocks = [text]

    for block in blocks:
        for line in block.splitlines():
            line = line.strip()
            if not line:
                continue

            line = re.sub(r'^[\-\*\•\u2022]\s*', '', line)
            line = line.replace('`', '')
            line = line.replace('**', '')
            line = line.replace('*', '')
            line = re.sub(r'\s+', ' ', line).strip()

            m = re.match(
                r'^(GET|POST|PUT|PATCH|DELETE|OPTIONS)\s+([^\s\-\|\:\[\]]+)(?:\s*[:\-\|]\s*(.*))?',
                line,
                flags=re.IGNORECASE
            )
            if m:
                endpoints.append({
                    "method": m.group(1).upper(),
                    "path": m.group(2).strip(),
                    "summary": (m.group(3) or "").strip()
                })
                continue

            m2 = re.match(
                r'^(GET|POST|PUT|PATCH|DELETE|OPTIONS)\s+([^\s\-\|\:\[\]]+)\s+[—–]\s*(.*)',
                line,
                flags=re.IGNORECASE
            )
            if m2:
                endpoints.append({
                    "method": m2.group(1).upper(),
                    "path": m2.group(2).strip(),
                    "summary": (m2.group(3) or "").strip()
                })

    return endpoints


def _normalize_endpoint_raw(ep_raw) -> Optional[dict]:
    """Normalize endpoint to standard format."""
    try:
        if isinstance(ep_raw, dict):
            method = (ep_raw.get("method") or ep_raw.get("verb") or "").upper()
            path = ep_raw.get("path") or ep_raw.get("route") or ""
            summary = ep_raw.get("summary") or ep_raw.get("description") or ""
        else:
            method = (getattr(ep_raw, "method", None) or getattr(ep_raw, "verb", "")).upper()
            path = getattr(ep_raw, "path", "") or getattr(ep_raw, "route", "")
            summary = getattr(ep_raw, "summary", "") or getattr(ep_raw, "description", "")

        if not method or not path:
            return None

        return {
            "id": f"ep-{uuid.uuid4().hex}",
            "method": method,
            "path": path,
            "summary": summary or ""
        }
    except Exception:
        return None


class OrchestratorAgent(BaseAgent):
    """Orchestrator agent with REAL iteration loop for validation."""

    def __init__(self):
        super().__init__("orchestrator")
        self.drafter = DrafterAgent()
        self.validator = ValidatorAgent()
        self.contexts: dict[str, MCPContext] = {}

    def get_system_prompt(self) -> str:
        return """You are the orchestrator of an API design workflow.
Your role is to coordinate between the drafting agent and validation agent
to produce valid OpenAPI specifications."""

    def get_or_create_context(self, conversation_id: Optional[str] = None) -> MCPContext:
        """Get existing context or create new one."""
        if conversation_id and conversation_id in self.contexts:
            return self.contexts[conversation_id]

        new_id = conversation_id or str(uuid.uuid4())
        context = MCPContext(conversation_id=new_id)
        self.contexts[new_id] = context
        return context

    def update_context(self, context: MCPContext) -> None:
        """Update stored context."""
        self.contexts[context.conversation_id] = context

    async def process(self, message: AgentMessage) -> AgentMessage:
        """Process orchestrator messages."""
        action = message.action
        context = message.context

        if action in ("draft_complete", "validation_complete", "validation_failed"):
            self.update_context(context)
            return message

        return message

    async def handle_user_message(
        self,
        user_message: str,
        conversation_id: Optional[str] = None,
        history: list[dict] = None
    ) -> dict:
        """Handle a user message and return response with endpoints."""
        context = self.get_or_create_context(conversation_id)
        context.user_requirements += f"\n{user_message}"

        message = AgentMessage(
            from_agent="orchestrator",
            to_agent="drafter",
            action="draft_request",
            payload={
                "user_message": user_message,
                "history": history or []
            },
            context=context
        )

        response = await self.drafter.process(message)
        self.update_context(response.context)

        endpoints_raw = response.payload.get("endpoints") or []
        if not endpoints_raw:
            text_resp = response.payload.get("response", "") or ""
            endpoints_raw = extract_endpoints_from_text(text_resp)

        normalized = []
        for ep in endpoints_raw:
            epn = _normalize_endpoint_raw(ep)
            if epn:
                normalized.append(epn)

        return {
            "conversation_id": context.conversation_id,
            "response": response.payload.get("response", ""),
            "endpoints": normalized,
            "schemas": response.payload.get("schemas", {}),
            "phase": response.context.phase
        }

    async def handle_user_message_streaming(
        self,
        user_message: str,
        conversation_id: Optional[str] = None,
        history: list[dict] = None
    ) -> AsyncIterator[str]:
        """Handle a user message with streaming response."""
        context = self.get_or_create_context(conversation_id)
        context.user_requirements += f"\n{user_message}"

        message = AgentMessage(
            from_agent="orchestrator",
            to_agent="drafter",
            action="draft_request",
            payload={
                "user_message": user_message,
                "history": history or []
            },
            context=context
        )

        full_response = ""
        async for chunk in self.drafter.process_streaming(message):
            full_response += chunk
            yield chunk

        endpoints = []
        try:
            parsed = self.drafter.parse_endpoints(full_response)
            if parsed:
                endpoints = parsed
        except Exception:
            endpoints = []

        if not endpoints:
            endpoints = extract_endpoints_from_text(full_response)

        if endpoints:
            normalized = []
            for ep in endpoints:
                epn = _normalize_endpoint_raw(ep)
                if epn:
                    normalized.append(epn)
            context.proposed_endpoints.extend(normalized)
            context.phase = "proposing"

        self.update_context(context)

    async def fix_spec_with_llm(
        self, 
        spec: dict, 
        validation_errors: list, 
        iteration: int
    ) -> dict:
        """Use LLM to fix validation errors in the spec."""
        
        # Format errors for LLM
        error_list = []
        for err in validation_errors[:10]:  # Top 10 errors
            error_list.append(f"- {err.get('path', '/')}: {err.get('message', 'Unknown error')}")
        
        errors_text = "\n".join(error_list)
        
        # Convert spec to YAML for easier LLM editing
        spec_yaml = yaml.dump(spec, default_flow_style=False, sort_keys=False)
        
        fix_prompt = f"""You are an OpenAPI specification fixer. Fix the following YAML spec to resolve these validation errors:

## Current Iteration: {iteration} / 5

## Validation Errors:
{errors_text}

## Current Spec (YAML):
```yaml
{spec_yaml}
```

CRITICAL FIXES NEEDED:
1. Fix YAML syntax: ensure spaces after colons (e.g., 'parameters: []' not 'parameters:[]')
2. Fix schema naming: use singular forms (e.g., 'Employee' not 'Employees')
3. Add missing path parameters in parameter definitions
4. Use correct response codes: POST→201, DELETE→204
5. Ensure all schemas have meaningful properties (not just id/createdAt/updatedAt)

Return ONLY the fixed YAML spec, no explanations. Start with 'openapi: 3.0.0'"""

        # Call LLM to fix
        fixed_yaml = await self.call_ollama(fix_prompt)
        
        # Extract YAML from response (in case LLM added markdown)
        yaml_match = re.search(r'```ya?ml\n(.*?)\n```', fixed_yaml, re.DOTALL)
        if yaml_match:
            fixed_yaml = yaml_match.group(1)
        elif fixed_yaml.strip().startswith('openapi:'):
            fixed_yaml = fixed_yaml.strip()
        else:
            # LLM didn't return valid YAML, return original
            return spec
        
        try:
            fixed_spec = yaml.safe_load(fixed_yaml)
            return fixed_spec
        except yaml.YAMLError as e:
            print(f"LLM returned invalid YAML on iteration {iteration}: {e}")
            return spec  # Return original if fix failed

    async def generate_and_validate_spec(
        self,
        endpoints: list[Endpoint],
        title: str = "My API",
        version: str = "1.0.0",
        description: Optional[str] = None,
        conversation_id: Optional[str] = None
    ) -> dict:
        """
        Generate OpenAPI spec and validate it with REAL iteration loop.
        This will loop up to 5 times until the spec is 100% valid.
        """
        context = self.get_or_create_context(conversation_id)
        context.proposed_endpoints = endpoints
        context.phase = "generating"

        # Initial spec generation
        spec = generate_openapi_spec(endpoints, title, version, description)
        context.current_spec = spec

        # ITERATION LOOP - THIS WAS MISSING!
        MAX_ITERATIONS = 5
        iteration = 0
        all_iterations = []  # Track all validation attempts
        
        while iteration < MAX_ITERATIONS:
            iteration += 1
            context.iteration_count = iteration
            
            print(f"🔄 Validation iteration {iteration}/{MAX_ITERATIONS}")
            
            # Validate current spec
            message = AgentMessage(
                from_agent="orchestrator",
                to_agent="validator",
                action="validate_request",
                payload={"spec": spec},
                context=context
            )

            response = await self.validator.process(message)
            self.update_context(response.context)

            result = response.payload.get("result", {})
            validation_valid = result.get("valid", False)
            validation_errors = result.get("errors", [])
            validation_warnings = result.get("warnings", [])
            
            # Store this iteration's result
            all_iterations.append({
                "iteration": iteration,
                "valid": validation_valid,
                "error_count": len(validation_errors),
                "warning_count": len(validation_warnings),
                "errors": validation_errors[:5],  # First 5 errors
                "warnings": validation_warnings[:3]  # First 3 warnings
            })
            
            # SUCCESS - Spec is 100% valid!
            if validation_valid:
                print(f"✅ Spec is valid after {iteration} iteration(s)!")
                context.phase = "complete"
                self.update_context(context)
                
                return {
                    "spec": spec,
                    "validation": result,
                    "phase": "complete",
                    "conversation_id": context.conversation_id,
                    "iterations": all_iterations,
                    "final_iteration": iteration,
                    "success": True
                }
            
            # NOT VALID - Fix and try again
            print(f"❌ Spec has {len(validation_errors)} errors. Attempting to fix...")
            
            # Use LLM to fix the spec based on validation errors
            spec = await self.fix_spec_with_llm(spec, validation_errors, iteration)
            context.current_spec = spec
            self.update_context(context)
            
            # Small delay to avoid hammering Ollama
            import asyncio
            await asyncio.sleep(0.5)
        
        # MAX ITERATIONS REACHED - Return best attempt
        print(f"⚠️  Max iterations ({MAX_ITERATIONS}) reached. Spec still has errors.")
        context.phase = "validating"
        self.update_context(context)
        
        # Get final validation result
        final_message = AgentMessage(
            from_agent="orchestrator",
            to_agent="validator",
            action="validate_request",
            payload={"spec": spec},
            context=context
        )
        final_response = await self.validator.process(final_message)
        final_result = final_response.payload.get("result", {})
        
        return {
            "spec": spec,
            "validation": final_result,
            "phase": "incomplete",
            "conversation_id": context.conversation_id,
            "iterations": all_iterations,
            "final_iteration": MAX_ITERATIONS,
            "success": False,
            "message": f"Could not achieve 100% valid spec after {MAX_ITERATIONS} iterations"
        }

    def get_context_state(self, conversation_id: str) -> Optional[dict]:
        """Get the current state of a conversation context."""
        if conversation_id not in self.contexts:
            return None

        context = self.contexts[conversation_id]
        return {
            "conversation_id": context.conversation_id,
            "phase": context.phase,
            "endpoints_count": len(context.proposed_endpoints),
            "iteration_count": context.iteration_count,
            "has_spec": context.current_spec is not None,
            "validation": context.validation_results.model_dump() if context.validation_results else None
        }


# Global orchestrator instance
orchestrator = OrchestratorAgent()