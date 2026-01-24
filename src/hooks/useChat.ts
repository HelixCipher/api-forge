import { useState, useCallback, useRef } from 'react';
import { Message, ConversationState, OpenAPISpec, Endpoint, ValidationResult, MCPContext } from '@/types/api';
import { validateOpenAPISpec } from '@/lib/openapi-validator';
import { generateSpecFromEndpoints, parseAIResponse } from '@/lib/spec-generator';
import { sendChatMessage, generateSpec as apiGenerateSpec, checkHealth } from '@/lib/api-client';
import { toast } from '@/hooks/use-toast';

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `# Welcome to API Forge! 🚀

I'm your AI assistant for designing REST APIs. Tell me about the API you want to build, and I'll help you:

- **Design** endpoints following REST best practices
- **Generate** OpenAPI/Swagger specifications
- **Validate** your spec for completeness and correctness

**Example prompts:**
- "I need an API for managing employee records"
- "Design a blog API with posts, comments, and users"
- "Create an e-commerce API with products and orders"

What would you like to build today?`,
      timestamp: new Date(),
      type: 'chat'
    }
  ]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>({
    phase: 'gathering'
  });
  const [proposedEndpoints, setProposedEndpoints] = useState<Endpoint[]>([]);
  const [currentSpec, setCurrentSpec] = useState<OpenAPISpec | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [mcpContext, setMCPContext] = useState<MCPContext | null>(null);
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, []);

  // Fallback mock response for when backend is unavailable
  const generateMockResponse = useCallback((userMessage: string): { response: string; endpoints: Endpoint[] } => {
    const lowerMessage = userMessage.toLowerCase();
    
    // Check for non-API related queries
    const nonApiKeywords = ['weather', 'joke', 'story', 'recipe', 'news', 'sports', 'music', 'movie'];
    const isNonApiQuery = nonApiKeywords.some(keyword => 
      lowerMessage.includes(keyword) && !lowerMessage.includes('api')
    );

    if (isNonApiQuery) {
      return {
        response: `I appreciate your curiosity, but I'm specifically designed to help with API design and OpenAPI specifications. 

Let's focus on building great APIs! What kind of API would you like to design today?`,
        endpoints: []
      };
    }

    if (lowerMessage.includes('employee') || lowerMessage.includes('staff') || lowerMessage.includes('hr')) {
      return {
        response: `Great! An Employee Management API is a classic example. Let me propose some endpoints:

[ENDPOINTS]
- GET /employees - List all employees with pagination
- POST /employees - Create a new employee
- GET /employees/{id} - Get employee details
- PUT /employees/{id} - Update employee information
- DELETE /employees/{id} - Remove an employee
- GET /departments - List all departments
- POST /departments - Create a department
[/ENDPOINTS]

[SCHEMAS]
Employee: { id: string, firstName: string, lastName: string, email: string, departmentId: string, position: string }
Department: { id: string, name: string, managerId: string }
[/SCHEMAS]

Would you like me to modify any of these endpoints or proceed to generate the specification?`,
        endpoints: parseAIResponse(`[ENDPOINTS]
- GET /employees - List all employees with pagination
- POST /employees - Create a new employee
- GET /employees/{id} - Get employee details
- PUT /employees/{id} - Update employee information
- DELETE /employees/{id} - Remove an employee
- GET /departments - List all departments
- POST /departments - Create a department
[/ENDPOINTS]`).endpoints
      };
    }

    return {
      response: `I understand you want to design an API. Could you provide more details about:

1. **What resources** will your API manage? (e.g., users, products, orders)
2. **Who will use it?** (internal service, public API, mobile app)
3. **Any specific requirements?** (authentication, rate limiting)

The more context you provide, the better I can design your API!`,
      endpoints: []
    };
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    addMessage({ role: 'user', content, type: 'chat' });
    setIsLoading(true);

    // Check if this is a non-API query that should be handled locally
    const lowerMessage = content.toLowerCase();
    const nonApiKeywords = ['weather', 'joke', 'story', 'recipe', 'news', 'sports', 'music', 'movie'];
    const isNonApiQuery = nonApiKeywords.some(keyword => 
      lowerMessage.includes(keyword) && !lowerMessage.includes('api')
    );

    // For non-API queries or gibberish, skip backend check and use mock directly
    if (isNonApiQuery || /^[^a-zA-Z]*$/.test(content)) {
      try {
        const mockResult = generateMockResponse(content);
        addMessage({ role: 'assistant', content: mockResult.response, type: 'chat' });
        
        if (mockResult.endpoints.length > 0) {
          setProposedEndpoints(prev => [...prev, ...mockResult.endpoints]);
          setConversationState(prev => ({ ...prev, phase: 'proposing' }));
          
          setMCPContext({
            conversation_id: 'local',
            phase: 'proposing',
            iteration_count: 0,
            errors_count: 0,
            warnings_count: 0
          });
        }
        
        // Simulate network delay for consistency
        await new Promise(resolve => setTimeout(resolve, 800));
      } catch (error) {
        console.error('Mock response error:', error);
        addMessage({ role: 'assistant', content: 'I apologize, but I encountered an error processing your request.', type: 'chat' });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      // Only check backend for API-related queries
      const isHealthy = await checkHealth();
      setBackendAvailable(isHealthy);

      let response: string;
      let newEndpoints: Endpoint[] = [];

      if (isHealthy) {
        // Use real backend
        const chatHistory = messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content
        }));
        chatHistory.push({ role: 'user', content });

        const result = await sendChatMessage(chatHistory, conversationIdRef.current);
        conversationIdRef.current = result.conversation_id;
        response = result.response;
        
        // Convert backend endpoints to our format
        if (result.endpoints && result.endpoints.length > 0) {
          newEndpoints = result.endpoints.map(ep => ({
            ...ep,
            responses: {},
            approved: false
          }));
        }
      } else {
        // Use mock response for API queries when backend is unavailable
        const mockResult = generateMockResponse(content);
        response = mockResult.response;
        newEndpoints = mockResult.endpoints;
        
        // Using offline mode - no notification needed
        // toast({
        //   title: "Using offline mode",
        //   description: "Backend unavailable",
        //   variant: "destructive"
        // });
        
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      // Parse for endpoints if not already parsed
      if (newEndpoints.length === 0) {
        const parsed = parseAIResponse(response);
        newEndpoints = parsed.endpoints;
      }

      if (newEndpoints.length > 0) {
        setProposedEndpoints(prev => [...prev, ...newEndpoints]);
        setConversationState(prev => ({ ...prev, phase: 'proposing' }));
        
        // Update MCP context
        setMCPContext({
          conversation_id: conversationIdRef.current || 'local',
          phase: 'proposing',
          iteration_count: 0,
          errors_count: 0,
          warnings_count: 0
        });
      }

      addMessage({ role: 'assistant', content: response, type: 'chat' });
    } catch (error) {
      console.error('Chat error:', error);
      
      // Fallback to mock on error
      const mockResult = generateMockResponse(content);
      addMessage({ role: 'assistant', content: mockResult.response, type: 'chat' });
      
      if (mockResult.endpoints.length > 0) {
        setProposedEndpoints(prev => [...prev, ...mockResult.endpoints]);
        setConversationState(prev => ({ ...prev, phase: 'proposing' }));
      }

      // Offline mode notification removed
      // if (!isNonApiQuery) {
      //   toast({
      //     title: "Using offline mode",
      //     description: "Backend unavailable",
      //     variant: "destructive"
      //   });
      // }
    } finally {
      setIsLoading(false);
    }
  }, [messages, addMessage, generateMockResponse]);

  const approveEndpoint = useCallback((endpointId: string) => {
    setProposedEndpoints(prev => 
      prev.map(ep => ep.id === endpointId ? { ...ep, approved: true } : ep)
    );
  }, []);

  const rejectEndpoint = useCallback((endpointId: string) => {
    setProposedEndpoints(prev => prev.filter(ep => ep.id !== endpointId));
  }, []);

  const generateSpec = useCallback(async () => {
    const approvedEndpoints = proposedEndpoints.filter(ep => ep.approved);
    if (approvedEndpoints.length === 0) {
      addMessage({
        role: 'assistant',
        content: '⚠️ Please approve at least one endpoint before generating the specification.',
        type: 'chat'
      });
      return;
    }

    setConversationState(prev => ({ ...prev, phase: 'generating' }));
    setIsLoading(true);
    
    // Initialize MCP context for generation
    setMCPContext(prev => ({
      conversation_id: conversationIdRef.current || 'local',
      phase: 'generating',
      iteration_count: prev?.iteration_count || 0,
      errors_count: 0,
      warnings_count: 0
    }));

    try {
      let spec: OpenAPISpec;
      let validation: ValidationResult;
      let iterationCount = 0;
      const maxIterations = 5;

      if (backendAvailable) {
        // Use backend to generate and validate with auto-fix loop
        setIsAutoFixing(true);
        
        let result = await apiGenerateSpec(
          approvedEndpoints,
          'My API',
          '1.0.0',
          'Generated by API Forge'
        );
        
        spec = result.spec;
        validation = result.validation;
        iterationCount++;
        
        // Update MCP context after first generation
        setMCPContext({
          conversation_id: conversationIdRef.current || 'local',
          phase: 'validating',
          iteration_count: iterationCount,
          errors_count: validation.errors.length,
          warnings_count: validation.warnings.length,
          is_auto_fixing: !validation.valid
        });
        
        // Auto-fix loop: keep regenerating until valid or max iterations
        while (!validation.valid && iterationCount < maxIterations) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause for UI
          
          result = await apiGenerateSpec(
            approvedEndpoints,
            'My API',
            '1.0.0',
            'Generated by API Forge'
          );
          
          spec = result.spec;
          validation = result.validation;
          iterationCount++;
          
          // Update MCP context each iteration
          setMCPContext({
            conversation_id: conversationIdRef.current || 'local',
            phase: 'validating',
            iteration_count: iterationCount,
            errors_count: validation.errors.length,
            warnings_count: validation.warnings.length,
            is_auto_fixing: !validation.valid && iterationCount < maxIterations
          });
        }
        
        setIsAutoFixing(false);
      } else {
        // Use local generation
        spec = generateSpecFromEndpoints(approvedEndpoints, 'My API', '1.0.0');
        validation = validateOpenAPISpec(spec);
        iterationCount = 1;
        
        setMCPContext({
          conversation_id: 'local',
          phase: validation.valid ? 'complete' : 'validating',
          iteration_count: iterationCount,
          errors_count: validation.errors.length,
          warnings_count: validation.warnings.length
        });
      }

      setCurrentSpec(spec);
      setValidationResult(validation);

      if (validation.valid) {
        setConversationState(prev => ({ ...prev, phase: 'complete' }));
        setMCPContext(prev => prev ? { ...prev, phase: 'complete', is_auto_fixing: false } : null);
        addMessage({
          role: 'assistant',
          content: `✅ **OpenAPI Specification Generated Successfully!**

Your API specification is valid and ready to use. You can:
- **Copy** the YAML/JSON from the preview panel
- **Download** the specification file
- **Test** with Swagger UI or other tools

The spec includes ${approvedEndpoints.length} endpoints with full documentation.
${iterationCount > 1 ? `\n*Completed after ${iterationCount} validation iterations.*` : ''}`,
          type: 'chat'
        });
      } else {
        setConversationState(prev => ({ ...prev, phase: 'validating' }));
        addMessage({
          role: 'assistant',
          content: `⚠️ **Validation Issues Found** (after ${iterationCount} iterations)

${validation.errors.map(e => `- ❌ ${e.message}`).join('\n')}
${validation.warnings.map(w => `- ⚠️ ${w.message}`).join('\n')}

The specification has been generated but has some issues that should be addressed.`,
          type: 'validation-result'
        });
      }
    } catch (error) {
      console.error('Generate spec error:', error);
      setIsAutoFixing(false);
      addMessage({
        role: 'assistant',
        content: '❌ Failed to generate specification. Please try again.',
        type: 'chat'
      });
    } finally {
      setIsLoading(false);
    }
  }, [proposedEndpoints, addMessage, backendAvailable]);

  const updateEndpoint = useCallback((endpointId: string, updates: Partial<Endpoint>) => {
    setProposedEndpoints(prev =>
      prev.map(ep => ep.id === endpointId ? { ...ep, ...updates } : ep)
    );
  }, []);

  const approveAllEndpoints = useCallback(() => {
    setProposedEndpoints(prev => prev.map(ep => ({ ...ep, approved: true })));
  }, []);

  return {
    messages,
    isLoading,
    conversationState,
    proposedEndpoints,
    currentSpec,
    validationResult,
    mcpContext,
    isAutoFixing,
    backendAvailable,
    sendMessage,
    approveEndpoint,
    rejectEndpoint,
    approveAllEndpoints,
    generateSpec,
    updateEndpoint
  };
}
