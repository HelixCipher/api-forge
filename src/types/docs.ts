import { OpenAPISpec, Endpoint } from './api';

export interface EndpointDocumentation {
  id: string;
  method: string;
  path: string;
  summary: string;
  description: string;
  parameters: ParameterDoc[];
  requestBody?: RequestBodyDoc;
  responses: ResponseDoc[];
  examples: ExampleDoc[];
  notes: string;
}

export interface ParameterDoc {
  name: string;
  in: string;
  required: boolean;
  type: string;
  description: string;
  example?: string;
}

export interface RequestBodyDoc {
  contentType: string;
  description: string;
  schema: string;
  example: string;
}

export interface ResponseDoc {
  statusCode: string;
  description: string;
  contentType?: string;
  schema?: string;
  example?: string;
}

export interface ExampleDoc {
  title: string;
  description: string;
  request?: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string;
  };
  response?: {
    statusCode: number;
    body: string;
  };
}

export interface APIDocumentation {
  title: string;
  version: string;
  description: string;
  baseUrl: string;
  authentication: AuthenticationDoc;
  endpoints: EndpointDocumentation[];
  schemas: SchemaDoc[];
  changelog: ChangelogEntry[];
}

export interface AuthenticationDoc {
  type: string;
  description: string;
  headerName?: string;
  example?: string;
}

export interface SchemaDoc {
  name: string;
  description: string;
  properties: PropertyDoc[];
}

export interface PropertyDoc {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export interface DocsEditRequest {
  section: 'overview' | 'endpoint' | 'schema' | 'auth';
  elementId?: string;
  currentContent: string;
  userPrompt: string;
}

export interface DocsEditResponse {
  updatedContent: string;
  explanation: string;
}
