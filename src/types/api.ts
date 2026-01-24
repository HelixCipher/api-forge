export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  type?: 'chat' | 'spec-proposal' | 'validation-result';
}

export interface Endpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  approved?: boolean;
}

export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema: SchemaObject;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface MediaType {
  schema: SchemaObject | ReferenceObject;
  example?: unknown;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

export interface SchemaObject {
  type: string;
  format?: string;
  properties?: Record<string, SchemaObject | ReferenceObject>;
  items?: SchemaObject | ReferenceObject;
  required?: string[];
  description?: string;
  example?: unknown;
  enum?: string[];
}

export interface ReferenceObject {
  $ref: string;
}

export type Schema = SchemaObject | ReferenceObject;

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  security?: Array<Record<string, string[]>>;
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  parameters?: Parameter[];
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: Array<Record<string, string[]>>;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
}

export interface ValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export interface MCPContext {
  conversation_id: string;
  phase: 'gathering' | 'proposing' | 'reviewing' | 'generating' | 'validating' | 'complete';
  iteration_count: number;
  errors_count: number;
  warnings_count: number;
  is_auto_fixing?: boolean;
}

export interface ConversationState {
  phase: 'gathering' | 'proposing' | 'reviewing' | 'generating' | 'validating' | 'complete';
  currentSpec?: OpenAPISpec;
  proposedEndpoints?: Endpoint[];
  validationResult?: ValidationResult;
  mcpContext?: MCPContext;
}
