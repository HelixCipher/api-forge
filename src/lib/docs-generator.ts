import { OpenAPISpec, Endpoint } from '@/types/api';
import {
  APIDocumentation,
  EndpointDocumentation,
  ParameterDoc,
  RequestBodyDoc,
  ResponseDoc,
  AuthenticationDoc,
  SchemaDoc,
  PropertyDoc,
} from '@/types/docs';

/**
 * Generate human-readable API documentation from OpenAPI spec
 */
export function generateDocsFromSpec(spec: OpenAPISpec): APIDocumentation {
  const endpoints: EndpointDocumentation[] = [];
  
  // Process all paths and operations
  Object.entries(spec.paths).forEach(([path, pathItem]) => {
    const methods = ['get', 'post', 'put', 'patch', 'delete'] as const;
    
    methods.forEach(method => {
      const operation = pathItem[method];
      if (!operation) return;
      
      const endpointDoc: EndpointDocumentation = {
        id: operation.operationId || `${method}-${path.replace(/[^a-zA-Z0-9]/g, '-')}`,
        method: method.toUpperCase(),
        path,
        summary: operation.summary || `${method.toUpperCase()} ${path}`,
        description: operation.description || generateDefaultDescription(method, path),
        parameters: extractParameters(operation.parameters || [], pathItem.parameters || []),
        requestBody: extractRequestBody(operation.requestBody),
        responses: extractResponses(operation.responses),
        examples: generateExamples(method, path, operation),
        notes: '',
      };
      
      endpoints.push(endpointDoc);
    });
  });
  
  // Extract schemas
  const schemas: SchemaDoc[] = [];
  if (spec.components?.schemas) {
    Object.entries(spec.components.schemas).forEach(([name, schema]) => {
      schemas.push({
        name,
        description: schema.description || `The ${name} object`,
        properties: extractSchemaProperties(schema),
      });
    });
  }
  
  // Extract authentication
  const authentication = extractAuthentication(spec);
  
  return {
    title: spec.info.title,
    version: spec.info.version,
    description: spec.info.description || 'API Documentation',
    baseUrl: spec.servers?.[0]?.url || 'https://api.example.com',
    authentication,
    endpoints,
    schemas,
    changelog: [
      {
        version: spec.info.version,
        date: new Date().toISOString().split('T')[0],
        changes: ['Initial API documentation generated'],
      },
    ],
  };
}

function generateDefaultDescription(method: string, path: string): string {
  const resource = extractResourceName(path);
  const descriptions: Record<string, string> = {
    get: path.includes('{') 
      ? `Retrieves a specific ${resource} by its identifier.`
      : `Retrieves a list of ${resource}s.`,
    post: `Creates a new ${resource}.`,
    put: `Replaces an existing ${resource} with new data.`,
    patch: `Partially updates an existing ${resource}.`,
    delete: `Removes a ${resource} from the system.`,
  };
  return descriptions[method] || `Performs a ${method.toUpperCase()} operation on ${path}`;
}

function extractResourceName(path: string): string {
  const segments = path.split('/').filter(s => s && !s.startsWith('{'));
  const resource = segments[segments.length - 1] || 'resource';
  // Singularize if it ends with 's'
  return resource.endsWith('s') ? resource.slice(0, -1) : resource;
}

function extractParameters(
  operationParams: any[],
  pathParams: any[]
): ParameterDoc[] {
  const allParams = [...(pathParams || []), ...(operationParams || [])];
  
  return allParams.map(param => ({
    name: param.name,
    in: param.in,
    required: param.required || param.in === 'path',
    type: param.schema?.type || 'string',
    description: param.description || `The ${param.name} parameter`,
    example: param.schema?.example || param.example || generateExampleValue(param.name, param.schema?.type),
  }));
}

function extractRequestBody(requestBody: any): RequestBodyDoc | undefined {
  if (!requestBody) return undefined;
  
  const contentType = Object.keys(requestBody.content || {})[0] || 'application/json';
  const content = requestBody.content?.[contentType];
  
  return {
    contentType,
    description: requestBody.description || 'Request body',
    schema: content?.schema?.$ref?.replace('#/components/schemas/', '') || 
            JSON.stringify(content?.schema || {}, null, 2),
    example: content?.example ? JSON.stringify(content.example, null, 2) : '{}',
  };
}

function extractResponses(responses: Record<string, any>): ResponseDoc[] {
  return Object.entries(responses).map(([statusCode, response]) => {
    const contentType = Object.keys(response.content || {})[0];
    const content = response.content?.[contentType];
    
    return {
      statusCode,
      description: response.description || getStatusDescription(statusCode),
      contentType,
      schema: content?.schema?.$ref?.replace('#/components/schemas/', '') ||
              (content?.schema ? JSON.stringify(content.schema, null, 2) : undefined),
      example: content?.example ? JSON.stringify(content.example, null, 2) : undefined,
    };
  });
}

function getStatusDescription(code: string): string {
  const descriptions: Record<string, string> = {
    '200': 'Successful response',
    '201': 'Resource created successfully',
    '204': 'No content',
    '400': 'Bad request - invalid input',
    '401': 'Unauthorized - authentication required',
    '403': 'Forbidden - insufficient permissions',
    '404': 'Resource not found',
    '500': 'Internal server error',
  };
  return descriptions[code] || 'Response';
}

function generateExamples(method: string, path: string, operation: any): any[] {
  const baseUrl = 'https://api.example.com';
  const examplePath = path.replace(/\{([^}]+)\}/g, (_, param) => `example-${param}`);
  
  return [{
    title: `${method.toUpperCase()} ${path}`,
    description: `Example request for ${operation.summary || path}`,
    request: {
      method: method.toUpperCase(),
      url: `${baseUrl}${examplePath}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer <your-token>',
      },
      body: ['post', 'put', 'patch'].includes(method) ? '{\n  "example": "data"\n}' : undefined,
    },
    response: {
      statusCode: method === 'post' ? 201 : 200,
      body: '{\n  "success": true\n}',
    },
  }];
}

function extractSchemaProperties(schema: any): PropertyDoc[] {
  if (!schema.properties) return [];
  
  const required = schema.required || [];
  
  return Object.entries(schema.properties).map(([name, prop]: [string, any]) => ({
    name,
    type: prop.type || 'object',
    required: required.includes(name),
    description: prop.description || `The ${name} field`,
    example: prop.example || generateExampleValue(name, prop.type),
  }));
}

function extractAuthentication(spec: OpenAPISpec): AuthenticationDoc {
  if (!spec.components?.securitySchemes) {
    return {
      type: 'none',
      description: 'No authentication required',
    };
  }
  
  const schemes = spec.components.securitySchemes;
  const firstScheme = Object.entries(schemes)[0];
  
  if (!firstScheme) {
    return {
      type: 'none',
      description: 'No authentication required',
    };
  }
  
  const [name, scheme] = firstScheme;
  
  if (scheme.type === 'http' && scheme.scheme === 'bearer') {
    return {
      type: 'Bearer Token',
      description: scheme.description || 'JWT Bearer token authentication',
      headerName: 'Authorization',
      example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    };
  }
  
  if (scheme.type === 'apiKey') {
    return {
      type: 'API Key',
      description: scheme.description || 'API Key authentication',
      headerName: scheme.name || 'X-API-Key',
      example: 'your-api-key-here',
    };
  }
  
  return {
    type: scheme.type,
    description: scheme.description || 'Authentication required',
  };
}

function generateExampleValue(name: string, type?: string): string {
  const lowerName = name.toLowerCase();
  
  // Common field patterns
  if (lowerName.includes('id')) return '"abc123"';
  if (lowerName.includes('email')) return '"user@example.com"';
  if (lowerName.includes('name')) return '"Example Name"';
  if (lowerName.includes('date') || lowerName.includes('time')) return '"2024-01-15T10:30:00Z"';
  if (lowerName.includes('url') || lowerName.includes('link')) return '"https://example.com"';
  if (lowerName.includes('phone')) return '"+1-555-123-4567"';
  if (lowerName.includes('price') || lowerName.includes('amount')) return '99.99';
  if (lowerName.includes('count') || lowerName.includes('quantity')) return '10';
  if (lowerName.includes('active') || lowerName.includes('enabled')) return 'true';
  
  // Type-based defaults
  switch (type) {
    case 'integer':
    case 'number':
      return '42';
    case 'boolean':
      return 'true';
    case 'array':
      return '[]';
    case 'object':
      return '{}';
    default:
      return '"example"';
  }
}

/**
 * Convert documentation to Markdown format
 */
export function docsToMarkdown(docs: APIDocumentation): string {
  const lines: string[] = [];
  
  // Title and overview
  lines.push(`# ${docs.title}`);
  lines.push('');
  lines.push(`**Version:** ${docs.version}`);
  lines.push('');
  lines.push(docs.description);
  lines.push('');
  lines.push(`**Base URL:** \`${docs.baseUrl}\``);
  lines.push('');
  
  // Authentication
  lines.push('## Authentication');
  lines.push('');
  lines.push(`**Type:** ${docs.authentication.type}`);
  lines.push('');
  lines.push(docs.authentication.description);
  if (docs.authentication.headerName) {
    lines.push('');
    lines.push(`**Header:** \`${docs.authentication.headerName}\``);
  }
  if (docs.authentication.example) {
    lines.push('');
    lines.push('```');
    lines.push(docs.authentication.example);
    lines.push('```');
  }
  lines.push('');
  
  // Endpoints
  lines.push('## Endpoints');
  lines.push('');
  
  docs.endpoints.forEach(endpoint => {
    lines.push(`### ${endpoint.method} ${endpoint.path}`);
    lines.push('');
    lines.push(`**${endpoint.summary}**`);
    lines.push('');
    lines.push(endpoint.description);
    lines.push('');
    
    if (endpoint.parameters.length > 0) {
      lines.push('#### Parameters');
      lines.push('');
      lines.push('| Name | In | Type | Required | Description |');
      lines.push('|------|-----|------|----------|-------------|');
      endpoint.parameters.forEach(param => {
        lines.push(`| ${param.name} | ${param.in} | ${param.type} | ${param.required ? 'Yes' : 'No'} | ${param.description} |`);
      });
      lines.push('');
    }
    
    if (endpoint.requestBody) {
      lines.push('#### Request Body');
      lines.push('');
      lines.push(`**Content-Type:** \`${endpoint.requestBody.contentType}\``);
      lines.push('');
      lines.push(endpoint.requestBody.description);
      lines.push('');
      lines.push('```json');
      lines.push(endpoint.requestBody.example);
      lines.push('```');
      lines.push('');
    }
    
    lines.push('#### Responses');
    lines.push('');
    endpoint.responses.forEach(response => {
      lines.push(`**${response.statusCode}** - ${response.description}`);
      if (response.example) {
        lines.push('');
        lines.push('```json');
        lines.push(response.example);
        lines.push('```');
      }
      lines.push('');
    });
  });
  
  // Schemas
  if (docs.schemas.length > 0) {
    lines.push('## Schemas');
    lines.push('');
    
    docs.schemas.forEach(schema => {
      lines.push(`### ${schema.name}`);
      lines.push('');
      lines.push(schema.description);
      lines.push('');
      lines.push('| Property | Type | Required | Description |');
      lines.push('|----------|------|----------|-------------|');
      schema.properties.forEach(prop => {
        lines.push(`| ${prop.name} | ${prop.type} | ${prop.required ? 'Yes' : 'No'} | ${prop.description} |`);
      });
      lines.push('');
    });
  }
  
  return lines.join('\n');
}
