from typing import Optional, List, Dict, Any
import yaml
import json
import re
from openapi_spec_validator import validate
from openapi_spec_validator.validation.exceptions import OpenAPIValidationError
from .base import BaseAgent
from ..models import MCPContext, AgentMessage, ValidationResult, ValidationError


class ValidatorAgent(BaseAgent):
    """Agent responsible for validating OpenAPI specifications."""
    
    def __init__(self):
        super().__init__("validator")
    
    def get_system_prompt(self) -> str:
        return """You are an OpenAPI specification validator and fixer.
Your role is to analyze OpenAPI specs, identify issues, and suggest fixes.

When analyzing a spec, check for:
1. Required fields (openapi version, info, paths)
2. Valid path formats (must start with /)
3. Valid HTTP methods
4. Proper response definitions
5. Schema references are valid
6. Security definitions are complete
7. Parameter definitions for path variables
8. Proper singularization of schema names
9. Complete schema properties (not just id/createdAt/updatedAt)
10. Canonical response codes (POST→201, DELETE→204)

Provide clear, actionable suggestions to fix any issues found."""

    def validate_yaml_syntax(self, yaml_string: str) -> List[ValidationError]:
        """Validate YAML syntax separately."""
        errors = []
        
        # Check for common YAML syntax errors
        # Pattern 1: Missing space after colon for empty collections
        bad_empty_array = re.findall(r'(\w+):\[\]', yaml_string)
        for match in bad_empty_array:
            errors.append(ValidationError(
                path=f"/{match}",
                message=f"Invalid YAML syntax: '{match}:[]' should be '{match}: []' (missing space)",
                severity="error"
            ))
        
        bad_empty_object = re.findall(r'(\w+):\{\}', yaml_string)
        for match in bad_empty_object:
            errors.append(ValidationError(
                path=f"/{match}",
                message=f"Invalid YAML syntax: '{match}:{{}}' should be '{match}: {{}}' (missing space)",
                severity="error"
            ))
        
        # Pattern 2: Check for document terminator being used incorrectly
        if '\n...\n' in yaml_string and not yaml_string.strip().endswith('...'):
            errors.append(ValidationError(
                path="/",
                message="YAML document terminator '...' found in middle of document",
                severity="error"
            ))
        
        # Try parsing the YAML
        try:
            yaml.safe_load(yaml_string)
        except yaml.YAMLError as e:
            errors.append(ValidationError(
                path="/",
                message=f"YAML parse error: {str(e)}",
                severity="error"
            ))
        
        return errors

    def validate_schema_completeness(self, schemas: Dict[str, Any]) -> List[ValidationError]:
        """Check that schemas are complete and meaningful."""
        errors = []
        warnings = []
        
        # Skip utility schemas
        utility_schemas = {"Error", "PaginationMeta"}
        
        for name, schema in schemas.items():
            if name in utility_schemas:
                continue
            
            properties = schema.get("properties", {})
            
            # Check for minimal schemas (only id, createdAt, updatedAt)
            prop_names = set(properties.keys())
            minimal_fields = {"id", "createdAt", "updatedAt"}
            
            if prop_names == minimal_fields or prop_names.issubset(minimal_fields):
                errors.append(ValidationError(
                    path=f"/components/schemas/{name}",
                    message=f"Schema '{name}' is incomplete - only has basic fields. Add domain-specific properties.",
                    severity="warning"
                ))
            
            # Check required fields exist in properties
            required = schema.get("required", [])
            for req_field in required:
                if req_field not in properties:
                    errors.append(ValidationError(
                        path=f"/components/schemas/{name}/required",
                        message=f"Required field '{req_field}' not found in properties",
                        severity="error"
                    ))
        
        return errors

    def validate_response_codes(self, paths: Dict[str, Any]) -> List[ValidationError]:
        """Validate canonical HTTP response codes."""
        warnings = []
        
        for path, path_item in paths.items():
            for method in ["get", "post", "put", "patch", "delete"]:
                if method not in path_item:
                    continue
                
                operation = path_item[method]
                responses = operation.get("responses", {})
                response_codes = set(responses.keys())
                
                # POST should primarily use 201
                if method == "post":
                    if "200" in response_codes and "201" in response_codes:
                        warnings.append(ValidationError(
                            path=f"/paths{path}/{method}/responses",
                            message=f"POST {path} has both 200 and 201. Use 201 for resource creation.",
                            severity="warning"
                        ))
                    elif "200" in response_codes and "201" not in response_codes:
                        warnings.append(ValidationError(
                            path=f"/paths{path}/{method}/responses",
                            message=f"POST {path} should return 201 Created, not 200 OK.",
                            severity="warning"
                        ))
                
                # DELETE should primarily use 204
                if method == "delete":
                    if "200" in response_codes and "204" not in response_codes:
                        warnings.append(ValidationError(
                            path=f"/paths{path}/{method}/responses",
                            message=f"DELETE {path} should return 204 No Content.",
                            severity="warning"
                        ))
        
        return warnings

    def validate_schema_naming(self, schemas: Dict[str, Any]) -> List[ValidationError]:
        """Check schema naming conventions."""
        warnings = []
        
        # Common misspellings and naming issues
        suspicious_names = {
            "Specy": "Species",
            "Specie": "Species",
            "Datas": "Data",
            "Informations": "Information",
            "Personnels": "Personnel",
        }
        
        for name in schemas.keys():
            if name in suspicious_names:
                warnings.append(ValidationError(
                    path=f"/components/schemas/{name}",
                    message=f"Schema name '{name}' appears incorrect. Did you mean '{suspicious_names[name]}'?",
                    severity="warning"
                ))
            
            # Check for plural schema names (resources should be singular)
            if name.endswith('s') and name not in ["Status", "Address", "Species", "Series", "News"]:
                # Check if it looks like a plural
                if not name.endswith('ss') and not name.endswith('us') and not name.endswith('is'):
                    warnings.append(ValidationError(
                        path=f"/components/schemas/{name}",
                        message=f"Schema name '{name}' appears to be plural. Consider using singular form.",
                        severity="warning"
                    ))
        
        return warnings

    def validate_spec(self, spec: dict) -> ValidationResult:
        """Validate an OpenAPI specification comprehensively."""
        errors = []
        warnings = []
        
        # Basic structure validation
        if not spec.get("openapi"):
            errors.append(ValidationError(
                path="/openapi",
                message="OpenAPI version is required",
                severity="error"
            ))
        elif not spec["openapi"].startswith("3."):
            errors.append(ValidationError(
                path="/openapi",
                message="OpenAPI version must be 3.x.x",
                severity="error"
            ))
        
        if not spec.get("info"):
            errors.append(ValidationError(
                path="/info",
                message="Info object is required",
                severity="error"
            ))
        else:
            if not spec["info"].get("title"):
                errors.append(ValidationError(
                    path="/info/title",
                    message="API title is required",
                    severity="error"
                ))
            if not spec["info"].get("version"):
                errors.append(ValidationError(
                    path="/info/version",
                    message="API version is required",
                    severity="error"
                ))
            if not spec["info"].get("description"):
                warnings.append(ValidationError(
                    path="/info/description",
                    message="API description is recommended",
                    severity="warning"
                ))
        
        if not spec.get("paths"):
            errors.append(ValidationError(
                path="/paths",
                message="At least one path is required",
                severity="error"
            ))
        else:
            # Validate each path
            for path, path_item in spec["paths"].items():
                if not path.startswith("/"):
                    errors.append(ValidationError(
                        path=f"/paths/{path}",
                        message="Path must start with /",
                        severity="error"
                    ))
                
                # Check path parameters
                path_params = set()
                for match in re.finditer(r'\{([^}]+)\}', path):
                    path_params.add(match.group(1))
                
                # Validate operations
                for method in ["get", "post", "put", "patch", "delete"]:
                    if method in path_item:
                        operation = path_item[method]
                        
                        # Check responses
                        if not operation.get("responses"):
                            errors.append(ValidationError(
                                path=f"/paths/{path}/{method}/responses",
                                message=f"Responses are required for {method.upper()} {path}",
                                severity="error"
                            ))
                        
                        # Check operationId
                        if not operation.get("operationId"):
                            warnings.append(ValidationError(
                                path=f"/paths/{path}/{method}/operationId",
                                message=f"operationId is recommended for {method.upper()} {path}",
                                severity="warning"
                            ))
                        
                        # Check path parameters are defined
                        defined_params = set()
                        for param in operation.get("parameters", []):
                            if param.get("in") == "path":
                                defined_params.add(param.get("name"))
                        
                        for param in path_item.get("parameters", []):
                            if param.get("in") == "path":
                                defined_params.add(param.get("name"))
                        
                        missing_params = path_params - defined_params
                        for param in missing_params:
                            errors.append(ValidationError(
                                path=f"/paths/{path}/{method}/parameters",
                                message=f"Path parameter '{param}' is not defined",
                                severity="error"
                            ))
            
            # Additional validations
            warnings.extend(self.validate_response_codes(spec["paths"]))
        
        # Validate schemas
        if spec.get("components", {}).get("schemas"):
            schemas = spec["components"]["schemas"]
            warnings.extend(self.validate_schema_naming(schemas))
            warnings.extend(self.validate_schema_completeness(schemas))
        
        # Use openapi-spec-validator for comprehensive validation
        if not errors:  # Only run if basic validation passes
            try:
                validate(spec)
            except OpenAPIValidationError as e:
                errors.append(ValidationError(
                    path=str(e.schema_path) if hasattr(e, 'schema_path') else "/",
                    message=str(e.message) if hasattr(e, 'message') else str(e),
                    severity="error"
                ))
            except Exception as e:
                errors.append(ValidationError(
                    path="/",
                    message=f"Validation error: {str(e)}",
                    severity="error"
                ))
        
        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )

    async def process(self, message: AgentMessage) -> AgentMessage:
        """Process a validation request."""
        context = message.context
        spec = message.payload.get("spec", {})
        
        # Validate the spec
        result = self.validate_spec(spec)
        
        # Update context with MCP pattern
        context.validation_results = result
        if result.valid:
            context.phase = "complete"
        else:
            context.iteration_count += 1
        
        # If invalid, ask drafter to fix issues (with iteration limit)
        if not result.valid and context.iteration_count < 3:
            # Generate fix suggestions using LLM
            error_summary = "\n".join([f"- {e.path}: {e.message}" for e in result.errors[:10]])
            warning_summary = "\n".join([f"- {w.path}: {w.message}" for w in result.warnings[:5]])
            
            fix_prompt = f"""The following OpenAPI specification has validation errors:

## Errors (must fix):
{error_summary}

## Warnings (should fix):
{warning_summary}

## MCP Context:
- Iteration: {context.iteration_count} of 3
- Phase: {context.phase}
- Endpoints: {len(context.proposed_endpoints)}

Please suggest specific fixes for each error. Focus on:
1. YAML syntax issues (spaces after colons)
2. Schema naming (singular, properly capitalized)
3. Missing path parameters
4. Response code conventions"""
            
            suggestions = await self.call_ollama(fix_prompt)
            
            return self.create_response(
                to_agent="orchestrator",
                action="validation_failed",
                payload={
                    "result": result.model_dump(),
                    "suggestions": suggestions,
                    "needs_iteration": True,
                    "mcp_context": {
                        "iteration": context.iteration_count,
                        "max_iterations": 3,
                        "errors_count": len(result.errors),
                        "warnings_count": len(result.warnings)
                    }
                },
                context=context
            )
        
        return self.create_response(
            to_agent="orchestrator",
            action="validation_complete",
            payload={
                "result": result.model_dump(),
                "needs_iteration": False,
                "mcp_context": {
                    "iteration": context.iteration_count,
                    "phase": context.phase,
                    "valid": result.valid
                }
            },
            context=context
        )
