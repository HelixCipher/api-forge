from typing import Optional, Dict
import re
import yaml
import json
from .models import Endpoint


# Resource-specific schema definitions for common domain objects
RESOURCE_SCHEMAS: Dict[str, dict] = {
    "zoo": {
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid", "description": "Unique identifier for the zoo"},
            "name": {"type": "string", "description": "Name of the zoo"},
            "location": {"type": "string", "description": "Physical location or address"},
            "description": {"type": "string", "description": "Description of the zoo"},
            "openingHours": {"type": "string", "description": "Operating hours"},
            "capacity": {"type": "integer", "description": "Maximum visitor capacity"},
            "createdAt": {"type": "string", "format": "date-time", "description": "Creation timestamp"},
            "updatedAt": {"type": "string", "format": "date-time", "description": "Last update timestamp"}
        },
        "required": ["id", "name", "location"]
    },
    "animal": {
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid", "description": "Unique identifier for the animal"},
            "name": {"type": "string", "description": "Name of the animal"},
            "speciesId": {"type": "string", "format": "uuid", "description": "Reference to species"},
            "zooId": {"type": "string", "format": "uuid", "description": "Reference to zoo where animal resides"},
            "age": {"type": "integer", "description": "Age of the animal in years"},
            "weight": {"type": "number", "format": "float", "description": "Weight in kilograms"},
            "gender": {"type": "string", "enum": ["male", "female", "unknown"], "description": "Gender of the animal"},
            "dateOfBirth": {"type": "string", "format": "date", "description": "Date of birth"},
            "healthStatus": {"type": "string", "description": "Current health status"},
            "createdAt": {"type": "string", "format": "date-time", "description": "Creation timestamp"},
            "updatedAt": {"type": "string", "format": "date-time", "description": "Last update timestamp"}
        },
        "required": ["id", "name", "speciesId", "zooId"]
    },
    "species": {
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid", "description": "Unique identifier for the species"},
            "name": {"type": "string", "description": "Common name of the species"},
            "scientificName": {"type": "string", "description": "Scientific/Latin name"},
            "classification": {"type": "string", "description": "Taxonomic classification"},
            "conservationStatus": {
                "type": "string",
                "enum": ["LC", "NT", "VU", "EN", "CR", "EW", "EX"],
                "description": "IUCN conservation status"
            },
            "habitat": {"type": "string", "description": "Natural habitat description"},
            "diet": {"type": "string", "description": "Dietary requirements"},
            "averageLifespan": {"type": "integer", "description": "Average lifespan in years"},
            "createdAt": {"type": "string", "format": "date-time", "description": "Creation timestamp"},
            "updatedAt": {"type": "string", "format": "date-time", "description": "Last update timestamp"}
        },
        "required": ["id", "name", "scientificName"]
    },
    "enclosure": {
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid", "description": "Unique identifier for the enclosure"},
            "name": {"type": "string", "description": "Name of the enclosure"},
            "zooId": {"type": "string", "format": "uuid", "description": "Reference to the zoo"},
            "type": {"type": "string", "description": "Type of enclosure (aquarium, aviary, etc.)"},
            "size": {"type": "number", "description": "Size in square meters"},
            "capacity": {"type": "integer", "description": "Maximum number of animals"},
            "climate": {"type": "string", "description": "Climate control settings"},
            "createdAt": {"type": "string", "format": "date-time", "description": "Creation timestamp"},
            "updatedAt": {"type": "string", "format": "date-time", "description": "Last update timestamp"}
        },
        "required": ["id", "name", "zooId"]
    },
    "user": {
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid", "description": "Unique identifier for the user"},
            "email": {"type": "string", "format": "email", "description": "User email address"},
            "username": {"type": "string", "description": "Username"},
            "firstName": {"type": "string", "description": "First name"},
            "lastName": {"type": "string", "description": "Last name"},
            "role": {"type": "string", "description": "User role"},
            "createdAt": {"type": "string", "format": "date-time", "description": "Creation timestamp"},
            "updatedAt": {"type": "string", "format": "date-time", "description": "Last update timestamp"}
        },
        "required": ["id", "email", "username"]
    },
    "product": {
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid", "description": "Unique identifier for the product"},
            "name": {"type": "string", "description": "Product name"},
            "description": {"type": "string", "description": "Product description"},
            "price": {"type": "number", "format": "float", "description": "Price in base currency"},
            "sku": {"type": "string", "description": "Stock keeping unit"},
            "category": {"type": "string", "description": "Product category"},
            "inStock": {"type": "boolean", "description": "Availability status"},
            "createdAt": {"type": "string", "format": "date-time", "description": "Creation timestamp"},
            "updatedAt": {"type": "string", "format": "date-time", "description": "Last update timestamp"}
        },
        "required": ["id", "name", "price"]
    },
    "order": {
        "type": "object",
        "properties": {
            "id": {"type": "string", "format": "uuid", "description": "Unique identifier for the order"},
            "userId": {"type": "string", "format": "uuid", "description": "Reference to user"},
            "status": {"type": "string", "enum": ["pending", "processing", "shipped", "delivered", "cancelled"], "description": "Order status"},
            "totalAmount": {"type": "number", "format": "float", "description": "Total order amount"},
            "shippingAddress": {"type": "string", "description": "Shipping address"},
            "createdAt": {"type": "string", "format": "date-time", "description": "Creation timestamp"},
            "updatedAt": {"type": "string", "format": "date-time", "description": "Last update timestamp"}
        },
        "required": ["id", "userId", "status", "totalAmount"]
    }
}

# Irregular plural to singular mappings
IRREGULAR_PLURALS: Dict[str, str] = {
    "species": "Species",
    "people": "Person",
    "children": "Child",
    "men": "Man",
    "women": "Woman",
    "mice": "Mouse",
    "geese": "Goose",
    "teeth": "Tooth",
    "feet": "Foot",
    "data": "Data",
    "media": "Media",
    "criteria": "Criterion",
    "phenomena": "Phenomenon",
    "analyses": "Analysis",
    "diagnoses": "Diagnosis",
    "theses": "Thesis",
    "crises": "Crisis",
    "indices": "Index",
    "appendices": "Appendix",
    "matrices": "Matrix",
    "vertices": "Vertex"
}


def generate_openapi_spec(
    endpoints: list[Endpoint],
    title: str = "My API",
    version: str = "1.0.0",
    description: Optional[str] = None
) -> dict:
    """Generate a complete OpenAPI 3.0 specification from endpoints."""
    
    paths = {}
    schemas = {
        "Error": {
            "type": "object",
            "properties": {
                "code": {"type": "integer", "description": "Error code"},
                "message": {"type": "string", "description": "Error message"}
            },
            "required": ["code", "message"]
        },
        "PaginationMeta": {
            "type": "object",
            "properties": {
                "page": {"type": "integer", "description": "Current page number"},
                "limit": {"type": "integer", "description": "Items per page"},
                "total": {"type": "integer", "description": "Total number of items"},
                "totalPages": {"type": "integer", "description": "Total number of pages"}
            }
        }
    }
    
    for endpoint in endpoints:
        if not endpoint.approved:
            continue
            
        method = endpoint.method.lower()
        path = endpoint.path
        
        if path not in paths:
            paths[path] = {}
        
        # Generate schema for resource
        schema_name = generate_schema_name(path)
        if schema_name not in schemas:
            schemas[schema_name] = generate_resource_schema(schema_name)
        
        schema_ref = {"$ref": f"#/components/schemas/{schema_name}"}
        pagination_ref = {"$ref": "#/components/schemas/PaginationMeta"}
        error_ref = {"$ref": "#/components/schemas/Error"}
        
        # Generate operation
        operation = {
            "operationId": generate_operation_id(method, path),
            "summary": endpoint.summary,
            "description": endpoint.description or endpoint.summary,
            "tags": [extract_tag(path)],
            "responses": {}
        }
        
        # Add path parameters
        path_params = re.findall(r'\{([^}]+)\}', path)
        if path_params:
            operation["parameters"] = []
            for param in path_params:
                operation["parameters"].append({
                    "name": param,
                    "in": "path",
                    "required": True,
                    "description": f"The {param} identifier",
                    "schema": {"type": "string", "format": "uuid"}
                })
        
        # Method-specific handling with canonical response codes
        if method == "get":
            # Add query parameters for list endpoints
            if "{" not in path:
                if "parameters" not in operation:
                    operation["parameters"] = []
                operation["parameters"].extend([
                    {
                        "name": "page",
                        "in": "query",
                        "required": False,
                        "description": "Page number for pagination",
                        "schema": {"type": "integer", "default": 1}
                    },
                    {
                        "name": "limit",
                        "in": "query",
                        "required": False,
                        "description": "Number of items per page",
                        "schema": {"type": "integer", "default": 20}
                    }
                ])
                # List endpoint - returns array with pagination
                operation["responses"]["200"] = {
                    "description": "Successful response",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "data": {
                                        "type": "array",
                                        "items": schema_ref
                                    },
                                    "meta": pagination_ref
                                }
                            }
                        }
                    }
                }
            else:
                # Single item endpoint
                operation["responses"]["200"] = {
                    "description": "Successful response",
                    "content": {
                        "application/json": {
                            "schema": schema_ref
                        }
                    }
                }
        
        elif method == "post":
            operation["requestBody"] = {
                "required": True,
                "description": f"{schema_name} data",
                "content": {
                    "application/json": {
                        "schema": schema_ref
                    }
                }
            }
            # POST returns 201 Created (canonical)
            operation["responses"]["201"] = {
                "description": "Created successfully",
                "content": {
                    "application/json": {
                        "schema": schema_ref
                    }
                }
            }
        
        elif method in ["put", "patch"]:
            operation["requestBody"] = {
                "required": True,
                "description": f"{schema_name} data",
                "content": {
                    "application/json": {
                        "schema": schema_ref
                    }
                }
            }
            # PUT/PATCH returns 200 OK (canonical)
            operation["responses"]["200"] = {
                "description": "Updated successfully",
                "content": {
                    "application/json": {
                        "schema": schema_ref
                    }
                }
            }
        
        elif method == "delete":
            # DELETE returns 204 No Content (canonical)
            operation["responses"]["204"] = {
                "description": "Deleted successfully"
            }
        
        # Add common error responses
        operation["responses"]["400"] = {
            "description": "Bad Request",
            "content": {
                "application/json": {
                    "schema": error_ref
                }
            }
        }
        operation["responses"]["401"] = {
            "description": "Unauthorized",
            "content": {
                "application/json": {
                    "schema": error_ref
                }
            }
        }
        operation["responses"]["404"] = {
            "description": "Not Found",
            "content": {
                "application/json": {
                    "schema": error_ref
                }
            }
        }
        operation["responses"]["500"] = {
            "description": "Internal Server Error",
            "content": {
                "application/json": {
                    "schema": error_ref
                }
            }
        }
        
        paths[path][method] = operation
    
    return {
        "openapi": "3.0.3",
        "info": {
            "title": title,
            "version": version,
            "description": description or f"API specification for {title}"
        },
        "servers": [
            {
                "url": "https://api.example.com/v1",
                "description": "Production server"
            },
            {
                "url": "http://localhost:3000/v1",
                "description": "Development server"
            }
        ],
        "paths": paths,
        "components": {
            "schemas": schemas,
            "securitySchemes": {
                "bearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT",
                    "description": "JWT Authorization header"
                },
                "apiKey": {
                    "type": "apiKey",
                    "in": "header",
                    "name": "X-API-Key",
                    "description": "API key authorization"
                }
            }
        },
        "security": [
            {"bearerAuth": []}
        ]
    }


def generate_operation_id(method: str, path: str) -> str:
    """Generate a unique operation ID."""
    parts = path.split('/')
    parts = [p for p in parts if p]
    
    clean_parts = []
    for p in parts:
        if p.startswith('{') and p.endswith('}'):
            clean_parts.append('ById')
        else:
            clean_parts.append(p.capitalize())
    
    prefix_map = {
        "get": "list" if "{" not in path else "get",
        "post": "create",
        "put": "update",
        "patch": "patch",
        "delete": "delete"
    }
    
    prefix = prefix_map.get(method, method)
    return f"{prefix}{''.join(clean_parts)}"


def extract_tag(path: str) -> str:
    """Extract tag from path."""
    parts = path.split('/')
    parts = [p for p in parts if p and not p.startswith('{')]
    if parts:
        return parts[0].capitalize()
    return "Default"


def generate_schema_name(path: str) -> str:
    """Generate schema name from path with proper singularization."""
    parts = path.split('/')
    parts = [p for p in parts if p and not p.startswith('{')]
    
    if parts:
        resource = parts[-1] if parts else parts[0]
        resource_lower = resource.lower()
        
        # Check irregular plurals first
        if resource_lower in IRREGULAR_PLURALS:
            return IRREGULAR_PLURALS[resource_lower]
        
        # Handle regular plurals
        if resource.endswith('ies'):
            # countries -> Country
            singular = resource[:-3] + 'y'
        elif resource.endswith('es') and not resource.endswith('ses') and not resource.endswith('xes'):
            # Only for -es that aren't -ses or -xes
            singular = resource[:-2]
        elif resource.endswith('s') and not resource.endswith('ss'):
            # Regular plural: remove trailing s
            singular = resource[:-1]
        else:
            singular = resource
        
        return singular[0].upper() + singular[1:].lower() if len(singular) > 1 else singular.upper()
    
    return "Resource"


def generate_resource_schema(name: str) -> dict:
    """Generate a complete resource schema."""
    name_lower = name.lower()
    
    # Check if we have a predefined schema for this resource
    if name_lower in RESOURCE_SCHEMAS:
        return RESOURCE_SCHEMAS[name_lower].copy()
    
    # Generate a generic but complete schema
    return {
        "type": "object",
        "properties": {
            "id": {
                "type": "string",
                "format": "uuid",
                "description": f"Unique identifier for the {name_lower}"
            },
            "name": {
                "type": "string",
                "description": f"Name of the {name_lower}"
            },
            "description": {
                "type": "string",
                "description": f"Description of the {name_lower}"
            },
            "status": {
                "type": "string",
                "enum": ["active", "inactive", "pending"],
                "description": "Current status"
            },
            "createdAt": {
                "type": "string",
                "format": "date-time",
                "description": "Creation timestamp"
            },
            "updatedAt": {
                "type": "string",
                "format": "date-time",
                "description": "Last update timestamp"
            }
        },
        "required": ["id", "name"]
    }


def spec_to_yaml(spec: dict) -> str:
    """Convert spec to valid YAML string using PyYAML."""
    return yaml.dump(spec, default_flow_style=False, sort_keys=False, allow_unicode=True)


def spec_to_json(spec: dict) -> str:
    """Convert spec to JSON string."""
    return json.dumps(spec, indent=2)
