import { OpenAPISpec, Endpoint, SchemaObject, PathItem, Operation, ReferenceObject, MediaType, Response } from '@/types/api';

// Resource-specific schema definitions for common domain objects
const RESOURCE_SCHEMAS: Record<string, (name: string) => SchemaObject> = {
  zoo: () => ({
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique identifier for the zoo' },
      name: { type: 'string', description: 'Name of the zoo' },
      location: { type: 'string', description: 'Physical location or address' },
      description: { type: 'string', description: 'Description of the zoo' },
      openingHours: { type: 'string', description: 'Operating hours' },
      capacity: { type: 'integer', description: 'Maximum visitor capacity' },
      createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
    },
    required: ['id', 'name', 'location']
  }),
  animal: () => ({
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique identifier for the animal' },
      name: { type: 'string', description: 'Name of the animal' },
      speciesId: { type: 'string', format: 'uuid', description: 'Reference to species' },
      zooId: { type: 'string', format: 'uuid', description: 'Reference to zoo where animal resides' },
      age: { type: 'integer', description: 'Age of the animal in years' },
      weight: { type: 'number', format: 'float', description: 'Weight in kilograms' },
      gender: { type: 'string', enum: ['male', 'female', 'unknown'], description: 'Gender of the animal' },
      dateOfBirth: { type: 'string', format: 'date', description: 'Date of birth' },
      healthStatus: { type: 'string', description: 'Current health status' },
      createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
    },
    required: ['id', 'name', 'speciesId', 'zooId']
  }),
  species: () => ({
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique identifier for the species' },
      name: { type: 'string', description: 'Common name of the species' },
      scientificName: { type: 'string', description: 'Scientific/Latin name' },
      classification: { type: 'string', description: 'Taxonomic classification' },
      conservationStatus: { 
        type: 'string', 
        enum: ['LC', 'NT', 'VU', 'EN', 'CR', 'EW', 'EX'],
        description: 'IUCN conservation status'
      },
      habitat: { type: 'string', description: 'Natural habitat description' },
      diet: { type: 'string', description: 'Dietary requirements' },
      averageLifespan: { type: 'integer', description: 'Average lifespan in years' },
      createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
    },
    required: ['id', 'name', 'scientificName']
  }),
  enclosure: () => ({
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique identifier for the enclosure' },
      name: { type: 'string', description: 'Name of the enclosure' },
      zooId: { type: 'string', format: 'uuid', description: 'Reference to the zoo' },
      type: { type: 'string', description: 'Type of enclosure (aquarium, aviary, etc.)' },
      size: { type: 'number', description: 'Size in square meters' },
      capacity: { type: 'integer', description: 'Maximum number of animals' },
      climate: { type: 'string', description: 'Climate control settings' },
      createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
    },
    required: ['id', 'name', 'zooId']
  }),
  user: () => ({
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique identifier for the user' },
      email: { type: 'string', format: 'email', description: 'User email address' },
      username: { type: 'string', description: 'Username' },
      firstName: { type: 'string', description: 'First name' },
      lastName: { type: 'string', description: 'Last name' },
      role: { type: 'string', description: 'User role' },
      createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
    },
    required: ['id', 'email', 'username']
  }),
  product: () => ({
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique identifier for the product' },
      name: { type: 'string', description: 'Product name' },
      description: { type: 'string', description: 'Product description' },
      price: { type: 'number', format: 'float', description: 'Price in base currency' },
      sku: { type: 'string', description: 'Stock keeping unit' },
      category: { type: 'string', description: 'Product category' },
      inStock: { type: 'boolean', description: 'Availability status' },
      createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
    },
    required: ['id', 'name', 'price']
  }),
  order: () => ({
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Unique identifier for the order' },
      userId: { type: 'string', format: 'uuid', description: 'Reference to user' },
      status: { type: 'string', enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], description: 'Order status' },
      totalAmount: { type: 'number', format: 'float', description: 'Total order amount' },
      shippingAddress: { type: 'string', description: 'Shipping address' },
      createdAt: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      updatedAt: { type: 'string', format: 'date-time', description: 'Last update timestamp' }
    },
    required: ['id', 'userId', 'status', 'totalAmount']
  })
};

// Irregular plural to singular mappings
const IRREGULAR_PLURALS: Record<string, string> = {
  'species': 'Species',  // species is both singular and plural
  'people': 'Person',
  'children': 'Child',
  'men': 'Man',
  'women': 'Woman',
  'mice': 'Mouse',
  'geese': 'Goose',
  'teeth': 'Tooth',
  'feet': 'Foot',
  'data': 'Data',
  'media': 'Media',
  'criteria': 'Criterion',
  'phenomena': 'Phenomenon',
  'analyses': 'Analysis',
  'diagnoses': 'Diagnosis',
  'theses': 'Thesis',
  'crises': 'Crisis',
  'indices': 'Index',
  'appendices': 'Appendix',
  'matrices': 'Matrix',
  'vertices': 'Vertex'
};

export function generateSpecFromEndpoints(
  endpoints: Endpoint[],
  title: string,
  version: string,
  description?: string
): OpenAPISpec {
  const paths: Record<string, PathItem> = {};
  const schemas: Record<string, SchemaObject> = {};

  // Generate standard error schema
  schemas['Error'] = {
    type: 'object',
    properties: {
      code: { type: 'integer', description: 'Error code' },
      message: { type: 'string', description: 'Error message' }
    },
    required: ['code', 'message']
  };

  // Generate pagination schema
  schemas['PaginationMeta'] = {
    type: 'object',
    properties: {
      page: { type: 'integer', description: 'Current page number' },
      limit: { type: 'integer', description: 'Items per page' },
      total: { type: 'integer', description: 'Total number of items' },
      totalPages: { type: 'integer', description: 'Total number of pages' }
    }
  };

  endpoints.forEach(endpoint => {
    const method = endpoint.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    
    if (!paths[endpoint.path]) {
      paths[endpoint.path] = {};
    }

    const errorRef: ReferenceObject = { $ref: '#/components/schemas/Error' };
    const schemaName = generateSchemaName(endpoint.path);

    // Build operation
    const operation: Operation = {
      operationId: generateOperationId(endpoint.method, endpoint.path),
      summary: endpoint.summary,
      description: endpoint.description || endpoint.summary,
      tags: [extractTag(endpoint.path)],
      parameters: [],
      responses: {}
    };

    // Add path parameters
    const pathParams = endpoint.path.match(/\{([^}]+)\}/g) || [];
    pathParams.forEach(param => {
      const paramName = param.slice(1, -1);
      operation.parameters!.push({
        name: paramName,
        in: 'path',
        required: true,
        description: `The ${paramName} identifier`,
        schema: { type: 'string', format: 'uuid' }
      });
    });

    // Create schema if needed
    if (!schemas[schemaName]) {
      schemas[schemaName] = generateResourceSchema(schemaName);
    }
    const schemaRef: ReferenceObject = { $ref: `#/components/schemas/${schemaName}` };
    const paginationRef: ReferenceObject = { $ref: '#/components/schemas/PaginationMeta' };

    // Method-specific handling with canonical response codes
    switch (method) {
      case 'get':
        // Add query parameters for list endpoints
        if (!endpoint.path.includes('{')) {
          operation.parameters!.push(
            {
              name: 'page',
              in: 'query',
              required: false,
              description: 'Page number for pagination',
              schema: { type: 'integer', example: 1 }
            },
            {
              name: 'limit',
              in: 'query',
              required: false,
              description: 'Number of items per page',
              schema: { type: 'integer', example: 20 }
            }
          );
          // List endpoint - returns array with pagination
          operation.responses = {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: schemaRef },
                      meta: paginationRef
                    }
                  } as SchemaObject
                } as MediaType
              }
            } as Response
          };
        } else {
          // Single item endpoint
          operation.responses = {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': { schema: schemaRef } as MediaType
              }
            } as Response
          };
        }
        break;

      case 'post':
        operation.requestBody = {
          required: true,
          description: `${schemaName} data`,
          content: {
            'application/json': { schema: schemaRef } as MediaType
          }
        };
        // POST should return 201 Created (not 200)
        operation.responses = {
          '201': {
            description: 'Created successfully',
            content: {
              'application/json': { schema: schemaRef } as MediaType
            }
          } as Response
        };
        break;

      case 'put':
      case 'patch':
        operation.requestBody = {
          required: true,
          description: `${schemaName} data`,
          content: {
            'application/json': { schema: schemaRef } as MediaType
          }
        };
        // PUT/PATCH should return 200 OK
        operation.responses = {
          '200': {
            description: 'Updated successfully',
            content: {
              'application/json': { schema: schemaRef } as MediaType
            }
          } as Response
        };
        break;

      case 'delete':
        // DELETE should return 204 No Content
        operation.responses = {
          '204': {
            description: 'Deleted successfully'
          } as Response
        };
        break;
    }

    // Add common error responses
    operation.responses = {
      ...operation.responses,
      '400': {
        description: 'Bad Request',
        content: { 'application/json': { schema: errorRef } }
      } as Response,
      '401': {
        description: 'Unauthorized',
        content: { 'application/json': { schema: errorRef } }
      } as Response,
      '404': {
        description: 'Not Found',
        content: { 'application/json': { schema: errorRef } }
      } as Response,
      '500': {
        description: 'Internal Server Error',
        content: { 'application/json': { schema: errorRef } }
      } as Response
    };

    paths[endpoint.path][method] = operation;
  });

  return {
    openapi: '3.0.3',
    info: {
      title,
      version,
      description: description || `API specification for ${title}`
    },
    servers: [
      {
        url: 'https://api.example.com/v1',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3000/v1',
        description: 'Development server'
      }
    ],
    paths,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Authorization header'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key authorization'
        }
      }
    },
    security: [
      { bearerAuth: [] }
    ]
  };
}

function generateOperationId(method: string, path: string): string {
  const parts = path.split('/').filter(Boolean);
  
  const cleanParts = parts.map(p => {
    if (p.startsWith('{') && p.endsWith('}')) {
      return 'ById';
    }
    return p.charAt(0).toUpperCase() + p.slice(1);
  });

  const methodPrefix = {
    GET: parts.length === 1 || !path.includes('{') ? 'list' : 'get',
    POST: 'create',
    PUT: 'update',
    PATCH: 'patch',
    DELETE: 'delete'
  }[method] || method.toLowerCase();

  return `${methodPrefix}${cleanParts.join('')}`;
}

function extractTag(path: string): string {
  const firstSegment = path.split('/').filter(Boolean)[0] || 'default';
  return firstSegment.charAt(0).toUpperCase() + firstSegment.slice(1);
}

function generateSchemaName(path: string): string {
  const segments = path.split('/').filter(p => p && !p.startsWith('{'));
  const resource = segments[segments.length - 1] || segments[0] || 'Resource';
  const resourceLower = resource.toLowerCase();
  
  // Check irregular plurals first
  if (IRREGULAR_PLURALS[resourceLower]) {
    return IRREGULAR_PLURALS[resourceLower];
  }
  
  // Handle regular plurals
  let singular: string;
  if (resource.endsWith('ies')) {
    // countries -> Country
    singular = resource.slice(0, -3) + 'y';
  } else if (resource.endsWith('es') && !resource.endsWith('ses') && !resource.endsWith('xes')) {
    // Only for -es that aren't -ses or -xes (those need the e)
    singular = resource.slice(0, -2);
  } else if (resource.endsWith('s') && !resource.endsWith('ss')) {
    // Regular plural: remove trailing s
    singular = resource.slice(0, -1);
  } else {
    singular = resource;
  }
  
  return singular.charAt(0).toUpperCase() + singular.slice(1).toLowerCase();
}

function generateResourceSchema(name: string): SchemaObject {
  const nameLower = name.toLowerCase();
  
  // Check if we have a predefined schema for this resource
  if (RESOURCE_SCHEMAS[nameLower]) {
    return RESOURCE_SCHEMAS[nameLower](name);
  }
  
  // Generate a generic but complete schema
  return {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        format: 'uuid',
        description: `Unique identifier for the ${nameLower}`
      },
      name: {
        type: 'string',
        description: `Name of the ${nameLower}`
      },
      description: {
        type: 'string',
        description: `Description of the ${nameLower}`
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'pending'],
        description: 'Current status'
      },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Creation timestamp'
      },
      updatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'Last update timestamp'
      }
    },
    required: ['id', 'name']
  };
}

export function parseAIResponse(response: string): { endpoints: Endpoint[] } {
  const endpoints: Endpoint[] = [];
  
  // Parse [ENDPOINTS] block
  const endpointsMatch = response.match(/\[ENDPOINTS\]([\s\S]*?)\[\/ENDPOINTS\]/);
  if (endpointsMatch) {
    const lines = endpointsMatch[1].split('\n').filter(l => l.trim().startsWith('-'));
    
    lines.forEach((line, index) => {
      const match = line.match(/- (GET|POST|PUT|PATCH|DELETE) ([^\s]+) - (.+)/);
      if (match) {
        endpoints.push({
          id: `ep-${Date.now()}-${index}`,
          method: match[1] as Endpoint['method'],
          path: match[2],
          summary: match[3].trim(),
          responses: {},
          approved: false
        });
      }
    });
  }

  return { endpoints };
}

/**
 * Convert OpenAPI spec to valid YAML string.
 * Uses proper YAML formatting with correct spacing and indentation.
 */
export function specToYaml(spec: OpenAPISpec): string {
  return convertToYaml(spec, 0);
}

function convertToYaml(obj: unknown, indent: number): string {
  const spaces = '  '.repeat(indent);
  
  if (obj === null || obj === undefined) {
    return 'null';
  }
  
  if (typeof obj === 'string') {
    // Quote strings that contain special characters or look like other types
    if (
      obj.includes('\n') || 
      obj.includes(':') || 
      obj.includes('#') ||
      obj.includes("'") ||
      obj.includes('"') ||
      obj.startsWith(' ') ||
      obj.endsWith(' ') ||
      obj === '' ||
      obj === 'true' ||
      obj === 'false' ||
      obj === 'null' ||
      obj === 'yes' ||
      obj === 'no' ||
      /^\d+(\.\d+)?$/.test(obj)
    ) {
      return `"${obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return obj;
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return String(obj);
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return '[]';  // CRITICAL: Empty array syntax is correct
    }
    
    return obj.map(item => {
      const value = convertToYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null) {
        // For objects in arrays, format the first key on the same line as dash
        const lines = value.trim().split('\n');
        if (lines.length > 0) {
          const firstLine = lines[0].replace(/^\s+/, '');
          const restLines = lines.slice(1).map(l => `${spaces}  ${l.trim()}`).join('\n');
          return `\n${spaces}- ${firstLine}${restLines ? '\n' + restLines : ''}`;
        }
      }
      return `\n${spaces}- ${value}`;
    }).join('');
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return '{}';  // CRITICAL: Empty object syntax is correct
    }
    
    return entries.map(([key, value]) => {
      // Handle keys that need quoting
      const safeKey = key.includes(':') || key.includes('#') || key.includes('/') || key.startsWith('{')
        ? `"${key}"`
        : key;
        
      const yamlValue = convertToYaml(value, indent + 1);
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0) {
        // Non-empty object: key on its own line, value indented
        return `\n${spaces}${safeKey}:${yamlValue}`;
      }
      if (Array.isArray(value) && value.length > 0) {
        // Non-empty array: key on its own line, items indented
        return `\n${spaces}${safeKey}:${yamlValue}`;
      }
      // CRITICAL FIX: Always add space after colon for scalars and empty collections
      return `\n${spaces}${safeKey}: ${yamlValue}`;
    }).join('');
  }
  
  return String(obj);
}
