import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Message } from '@/types/api';
import { cn } from '@/lib/utils';

interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
}

export function ChatPanel({ messages, isLoading, onSendMessage }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleUseExample = (event: CustomEvent) => {
      const query = event.detail;
      setInput(query);
      onSendMessage(query);
      
      // Focus on the input after setting the query
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    };

    // Add event listener for custom 'useExample' event
    window.addEventListener('useExample', handleUseExample as EventListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('useExample', handleUseExample as EventListener);
    };
  }, [onSendMessage]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-gradient-card">
        <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
          <Bot className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">API Design Assistant</h2>
          <p className="text-xs text-muted-foreground">Describe your API requirements</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3 animate-slide-up",
              message.role === 'user' ? 'flex-row-reverse' : ''
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                message.role === 'user'
                  ? 'bg-primary/20'
                  : 'bg-gradient-primary'
              )}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-primary" />
              ) : (
                <Bot className="w-4 h-4 text-primary-foreground" />
              )}
            </div>
            <div
              className={cn(
                "flex-1 rounded-xl px-4 py-3 max-w-[85%]",
                message.role === 'user'
                  ? 'bg-primary/10 border border-primary/20 ml-auto'
                  : 'bg-secondary/50 border border-border'
              )}
            >
              <div className="text-sm prose prose-invert prose-sm max-w-none">
                <MessageContent content={message.content} />
              </div>
              <div className="text-[10px] text-muted-foreground mt-2">
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3 animate-slide-up">
            <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div className="bg-secondary/50 border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Designing your API...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-gradient-card">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your API requirements..."
              className="w-full bg-secondary/50 border border-border rounded-lg px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
              rows={2}
              disabled={isLoading}
            />
          </div>
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isLoading}
            className="h-auto aspect-square"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">
          Press Enter to send • Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  // Parse markdown-like content
  const parts = content.split(/(\[ENDPOINTS\][\s\S]*?\[\/ENDPOINTS\]|\[SCHEMAS\][\s\S]*?\[\/SCHEMAS\])/);
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('[ENDPOINTS]')) {
          const endpoints = part
            .replace('[ENDPOINTS]', '')
            .replace('[/ENDPOINTS]', '')
            .trim()
            .split('\n')
            .filter(l => l.trim());
          
          return (
            <div key={index} className="my-3 p-3 bg-secondary/50 rounded-lg border border-border">
              <div className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">
                Proposed Endpoints
              </div>
              <div className="space-y-1.5 font-mono text-xs">
                {endpoints.map((ep, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <MethodBadge method={ep} />
                    <span className="text-muted-foreground">{ep.replace(/^- (GET|POST|PUT|PATCH|DELETE) /, '')}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
        
        if (part.startsWith('[SCHEMAS]')) {
          const schemas = part
            .replace('[SCHEMAS]', '')
            .replace('[/SCHEMAS]', '')
            .trim();
          
          return (
            <div key={index} className="my-3 p-3 bg-secondary/50 rounded-lg border border-border">
              <div className="text-xs font-semibold text-accent mb-2 uppercase tracking-wide">
                Proposed Schemas
              </div>
              <pre className="font-mono text-xs text-code-property whitespace-pre-wrap">{schemas}</pre>
            </div>
          );
        }
        
        // Regular markdown parsing
        return (
          <div key={index} dangerouslySetInnerHTML={{ __html: parseMarkdown(part) }} />
        );
      })}
    </>
  );
}

function MethodBadge({ method }: { method: string }) {
  const methodMatch = method.match(/^- (GET|POST|PUT|PATCH|DELETE)/);
  if (!methodMatch) return null;
  
  const m = methodMatch[1];
  const colors: Record<string, string> = {
    GET: 'bg-success/20 text-success',
    POST: 'bg-primary/20 text-primary',
    PUT: 'bg-warning/20 text-warning',
    PATCH: 'bg-accent/20 text-accent',
    DELETE: 'bg-destructive/20 text-destructive'
  };
  
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold", colors[m])}>
      {m}
    </span>
  );
}

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-secondary px-1.5 py-0.5 rounded text-xs font-mono text-primary">$1</code>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold mb-2">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold mb-2">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mb-1">$1</h3>')
    .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
    .replace(/\n/g, '<br/>');
}
