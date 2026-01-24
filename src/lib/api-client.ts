import { Endpoint, OpenAPISpec, ValidationResult } from '@/types/api';

// API base URL - uses relative path in Docker, absolute in dev
const API_BASE = '/api';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  conversation_id: string;
  response: string;
  endpoints: Array<{
    id: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    summary: string;
    approved: boolean;
  }>;
  schemas: Record<string, string>;
  phase: string;
}

interface GenerateSpecResponse {
  spec: OpenAPISpec;
  validation: ValidationResult;
  yaml: string;
  json: string;
  phase: string;
  suggestions?: string;
}

/**
 * Send a chat message to the backend API
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  conversationId?: string
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      context: conversationId ? { conversation_id: conversationId } : undefined,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to send message');
  }

  return response.json();
}

/**
 * Stream chat response from the backend
 */
export async function streamChatMessage(
  messages: ChatMessage[],
  conversationId: string | undefined,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (error: Error) => void
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        context: conversationId ? { conversation_id: conversationId } : undefined,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to start stream');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              onChunk(data.content);
            }
            if (data.status === 'complete') {
              onDone();
              return;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    }

    onDone();
  } catch (error) {
    onError(error instanceof Error ? error : new Error('Stream error'));
  }
}

/**
 * Generate and validate OpenAPI specification
 */
export async function generateSpec(
  endpoints: Endpoint[],
  title: string = 'My API',
  version: string = '1.0.0',
  description?: string
): Promise<GenerateSpecResponse> {
  const response = await fetch(`${API_BASE}/generate-spec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoints: endpoints.map(ep => ({
        id: ep.id,
        method: ep.method,
        path: ep.path,
        summary: ep.summary,
        description: ep.description,
        approved: ep.approved,
      })),
      title,
      version,
      description,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to generate specification');
  }

  return response.json();
}

/**
 * Validate an OpenAPI specification
 */
export async function validateSpec(spec: OpenAPISpec): Promise<ValidationResult> {
  const response = await fetch(`${API_BASE}/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(spec),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to validate specification');
  }

  return response.json();
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export interface SystemStatus {
  compute_mode: 'cpu' | 'gpu-nvidia' | 'gpu-amd' | 'unknown';
  ollama_connected: boolean;
  model_name: string;
  model_loaded: boolean;
  model_loading: boolean;
  model_progress: number;
  gpu_info: {
    family?: string;
    parameter_size?: string;
    quantization?: string;
  } | null;
}

/**
 * Get system status including GPU/CPU mode and model availability
 */
export async function getSystemStatus(): Promise<SystemStatus | null> {
  try {
    const response = await fetch(`${API_BASE}/system-status`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

/**
 * Get conversation context state
 */
export async function getContextState(conversationId: string): Promise<{
  conversation_id: string;
  phase: string;
  endpoints_count: number;
  iteration_count: number;
  has_spec: boolean;
  validation: ValidationResult | null;
} | null> {
  try {
    const response = await fetch(`${API_BASE}/context/${conversationId}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export interface DocsEditRequest {
  section: string;
  element_id?: string;
  current_content: string;
  user_prompt: string;
}

export interface DocsEditResponse {
  updated_content: string;
  explanation: string;
}

/**
 * Use AI to edit/improve documentation
 */
export async function editDocs(request: DocsEditRequest): Promise<DocsEditResponse> {
  const response = await fetch(`${API_BASE}/docs/edit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || 'Failed to edit documentation');
  }

  return response.json();
}
