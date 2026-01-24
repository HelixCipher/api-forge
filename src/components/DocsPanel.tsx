import { useState, useCallback } from 'react';
import { 
  BookOpen, 
  Download, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronRight,
  Edit3,
  Sparkles,
  FileText,
  Code,
  Send,
  X,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { APIDocumentation, EndpointDocumentation } from '@/types/docs';
import { docsToMarkdown } from '@/lib/docs-generator';

interface DocsPanelProps {
  docs: APIDocumentation | null;
  isLoading: boolean;
  onUpdateDocs: (docs: APIDocumentation) => void;
  onAIEdit: (section: string, elementId: string | undefined, currentContent: string, prompt: string) => Promise<string>;
}

export function DocsPanel({ docs, isLoading, onUpdateDocs, onAIEdit }: DocsPanelProps) {
  const [format, setFormat] = useState<'visual' | 'markdown'>('visual');
  const [copied, setCopied] = useState(false);
  const [expandedEndpoints, setExpandedEndpoints] = useState<Set<string>>(new Set());
  const [editingSection, setEditingSection] = useState<{
    type: 'overview' | 'endpoint' | 'schema' | 'auth';
    id?: string;
    field?: string;
  } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAIEditing, setIsAIEditing] = useState(false);

  const toggleEndpoint = useCallback((id: string) => {
    setExpandedEndpoints(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleCopy = useCallback(async () => {
    if (!docs) return;
    const markdown = docsToMarkdown(docs);
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    toast({ title: 'Copied to clipboard', description: 'Documentation copied as Markdown' });
    setTimeout(() => setCopied(false), 2000);
  }, [docs]);

  const handleDownload = useCallback(() => {
    if (!docs) return;
    const markdown = docsToMarkdown(docs);
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docs.title.toLowerCase().replace(/\s+/g, '-')}-docs.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Downloaded', description: 'Documentation saved as Markdown' });
  }, [docs]);

  const startEdit = (type: 'overview' | 'endpoint' | 'schema' | 'auth', currentValue: string, id?: string, field?: string) => {
    setEditingSection({ type, id, field });
    setEditValue(currentValue);
    setAiPrompt('');
  };

  const cancelEdit = () => {
    setEditingSection(null);
    setEditValue('');
    setAiPrompt('');
  };

  const saveEdit = () => {
    if (!docs || !editingSection) return;
    
    const updatedDocs = { ...docs };
    
    if (editingSection.type === 'overview') {
      if (editingSection.field === 'description') {
        updatedDocs.description = editValue;
      } else if (editingSection.field === 'title') {
        updatedDocs.title = editValue;
      }
    } else if (editingSection.type === 'endpoint' && editingSection.id) {
      updatedDocs.endpoints = docs.endpoints.map(ep => 
        ep.id === editingSection.id 
          ? { ...ep, [editingSection.field || 'description']: editValue }
          : ep
      );
    } else if (editingSection.type === 'auth') {
      updatedDocs.authentication = {
        ...docs.authentication,
        description: editValue
      };
    }
    
    onUpdateDocs(updatedDocs);
    cancelEdit();
    toast({ title: 'Updated', description: 'Documentation updated successfully' });
  };

    const handleAIEdit = async () => {
    if (!aiPrompt.trim() || !editingSection) return;
    
    setIsAIEditing(true);
    try {
      const result = await onAIEdit(
        editingSection.type,
        editingSection.id,
        editValue,
        aiPrompt
      );
      setEditValue(result);
      setAiPrompt('');
      toast({ title: 'AI suggestion applied', description: 'Review and save when ready' });
    } catch (error: any) {
      // Improved debug info:
      console.error('AI edit error:', error);
      const msg =
        error?.message ||
        (error?.response && (await safeJsonMessage(error.response))) ||
        'Could not process your request. Try again.';
      toast({ 
        title: 'AI edit failed', 
        description: msg,
        variant: 'destructive'
      });
    } finally {
      setIsAIEditing(false);
    }
  };

  // helper to try to parse response body (used only for toast diagnostics)
  async function safeJsonMessage(response: any) {
    try {
      const body = await response.text?.() || JSON.stringify(response);
      // try parse
      try {
        const j = JSON.parse(body);
        return j.error || j.message || JSON.stringify(j);
      } catch {
        return body;
      }
    } catch (e) {
      return String(response);
    }
  }


  const markdownContent = docsToMarkdown(docs);

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">{docs.title} Documentation</h2>
            <p className="text-[10px] text-muted-foreground">
              v{docs.version} • {docs.endpoints.length} endpoints
            </p>
          </div>
        </div>

        {/* Format Toggle */}
        <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
          <button
            onClick={() => setFormat('visual')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5",
              format === 'visual' 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="w-3 h-3" />
            Visual
          </button>
          <button
            onClick={() => setFormat('markdown')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-all flex items-center gap-1.5",
              format === 'markdown' 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Code className="w-3 h-3" />
            Markdown
          </button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {format === 'visual' ? (
          <div className="p-4 space-y-6">
            {/* Overview Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Overview</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => startEdit('overview', docs.description, undefined, 'description')}
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              </div>
              
              {editingSection?.type === 'overview' && editingSection.field === 'description' ? (
                <EditSection
                  value={editValue}
                  onChange={setEditValue}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                  aiPrompt={aiPrompt}
                  onAiPromptChange={setAiPrompt}
                  onAIEdit={handleAIEdit}
                  isAIEditing={isAIEditing}
                />
              ) : (
                <p className="text-sm text-muted-foreground">{docs.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground mb-1">Base URL</p>
                  <code className="text-xs font-mono">{docs.baseUrl}</code>
                </div>
                <div className="p-3 rounded-lg bg-secondary/50">
                  <p className="text-[10px] text-muted-foreground mb-1">Authentication</p>
                  <p className="text-xs font-medium">{docs.authentication.type}</p>
                </div>
              </div>
            </section>

            {/* Authentication Section */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Authentication</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => startEdit('auth', docs.authentication.description)}
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              </div>
              
              {editingSection?.type === 'auth' ? (
                <EditSection
                  value={editValue}
                  onChange={setEditValue}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                  aiPrompt={aiPrompt}
                  onAiPromptChange={setAiPrompt}
                  onAIEdit={handleAIEdit}
                  isAIEditing={isAIEditing}
                />
              ) : (
                <div className="p-3 rounded-lg border border-border bg-secondary/30">
                  <p className="text-sm text-muted-foreground mb-2">{docs.authentication.description}</p>
                  {docs.authentication.headerName && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Header:</span>
                      <code className="px-1.5 py-0.5 rounded bg-secondary font-mono">
                        {docs.authentication.headerName}
                      </code>
                    </div>
                  )}
                  {docs.authentication.example && (
                    <code className="block mt-2 p-2 rounded bg-secondary text-xs font-mono break-all">
                      {docs.authentication.example}
                    </code>
                  )}
                </div>
              )}
            </section>

            {/* Endpoints Section */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Endpoints</h3>
              
              <div className="space-y-2">
                {docs.endpoints.map(endpoint => (
                  <EndpointDocCard
                    key={endpoint.id}
                    endpoint={endpoint}
                    isExpanded={expandedEndpoints.has(endpoint.id)}
                    onToggle={() => toggleEndpoint(endpoint.id)}
                    isEditing={editingSection?.type === 'endpoint' && editingSection.id === endpoint.id}
                    editValue={editingSection?.id === endpoint.id ? editValue : ''}
                    onStartEdit={(field) => startEdit('endpoint', endpoint[field as keyof EndpointDocumentation] as string || '', endpoint.id, field)}
                    onEditChange={setEditValue}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    aiPrompt={aiPrompt}
                    onAiPromptChange={setAiPrompt}
                    onAIEdit={handleAIEdit}
                    isAIEditing={isAIEditing}
                  />
                ))}
              </div>
            </section>

            {/* Schemas Section */}
            {docs.schemas.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Schemas</h3>
                
                <div className="space-y-2">
                  {docs.schemas.map(schema => (
                    <div key={schema.name} className="p-3 rounded-lg border border-border">
                      <h4 className="font-medium text-sm mb-1">{schema.name}</h4>
                      <p className="text-xs text-muted-foreground mb-3">{schema.description}</p>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-1.5 px-2 font-medium">Property</th>
                              <th className="text-left py-1.5 px-2 font-medium">Type</th>
                              <th className="text-left py-1.5 px-2 font-medium">Required</th>
                              <th className="text-left py-1.5 px-2 font-medium">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {schema.properties.map(prop => (
                              <tr key={prop.name} className="border-b border-border/50">
                                <td className="py-1.5 px-2 font-mono">{prop.name}</td>
                                <td className="py-1.5 px-2 text-muted-foreground">{prop.type}</td>
                                <td className="py-1.5 px-2">
                                  {prop.required ? (
                                    <span className="text-primary">Yes</span>
                                  ) : (
                                    <span className="text-muted-foreground">No</span>
                                  )}
                                </td>
                                <td className="py-1.5 px-2 text-muted-foreground">{prop.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="p-4">
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {markdownContent}
            </pre>
          </div>
        )}
      </ScrollArea>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-gradient-card">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1"
          onClick={handleCopy}
        >
          {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        <Button
          variant="default"
          size="sm"
          className="flex-1"
          onClick={handleDownload}
        >
          <Download className="w-4 h-4 mr-2" />
          Download
        </Button>
      </div>
    </div>
  );
}

interface EditSectionProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  aiPrompt: string;
  onAiPromptChange: (value: string) => void;
  onAIEdit: () => void;
  isAIEditing: boolean;
}

function EditSection({ 
  value, 
  onChange, 
  onSave, 
  onCancel, 
  aiPrompt, 
  onAiPromptChange, 
  onAIEdit,
  isAIEditing 
}: EditSectionProps) {
  return (
    <div className="space-y-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-[80px] text-sm"
        placeholder="Enter content..."
      />
      
      {/* AI Edit Input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary" />
          <Input
            value={aiPrompt}
            onChange={(e) => onAiPromptChange(e.target.value)}
            placeholder="Ask AI to improve this..."
            className="pl-8 pr-10 h-8 text-xs"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onAIEdit()}
          />
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
            onClick={onAIEdit}
            disabled={!aiPrompt.trim() || isAIEditing}
          >
            {isAIEditing ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Send className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={onCancel} className="flex-1">
          <X className="w-3 h-3 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={onSave} className="flex-1">
          <Check className="w-3 h-3 mr-1" />
          Save
        </Button>
      </div>
    </div>
  );
}

interface EndpointDocCardProps {
  endpoint: EndpointDocumentation;
  isExpanded: boolean;
  onToggle: () => void;
  isEditing: boolean;
  editValue: string;
  onStartEdit: (field: string) => void;
  onEditChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  aiPrompt: string;
  onAiPromptChange: (value: string) => void;
  onAIEdit: () => void;
  isAIEditing: boolean;
}

function EndpointDocCard({ 
  endpoint, 
  isExpanded, 
  onToggle,
  isEditing,
  editValue,
  onStartEdit,
  onEditChange,
  onSave,
  onCancel,
  aiPrompt,
  onAiPromptChange,
  onAIEdit,
  isAIEditing
}: EndpointDocCardProps) {
  const methodColors: Record<string, string> = {
    GET: 'bg-success/20 text-success border-success/30',
    POST: 'bg-primary/20 text-primary border-primary/30',
    PUT: 'bg-warning/20 text-warning border-warning/30',
    PATCH: 'bg-accent/20 text-accent-foreground border-accent/30',
    DELETE: 'bg-destructive/20 text-destructive border-destructive/30',
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-lg border border-border overflow-hidden">
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            <span className={cn(
              "px-2 py-0.5 rounded text-[10px] font-bold border",
              methodColors[endpoint.method] || 'bg-secondary'
            )}>
              {endpoint.method}
            </span>
            <code className="text-xs font-mono flex-1 text-left">{endpoint.path}</code>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              {endpoint.summary}
            </span>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 space-y-4 border-t border-border bg-secondary/20">
            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h5 className="text-xs font-medium text-muted-foreground">Description</h5>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-6 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEdit('description');
                  }}
                >
                  <Edit3 className="w-3 h-3 mr-1" />
                  Edit
                </Button>
              </div>
              
              {isEditing ? (
                <EditSection
                  value={editValue}
                  onChange={onEditChange}
                  onSave={onSave}
                  onCancel={onCancel}
                  aiPrompt={aiPrompt}
                  onAiPromptChange={onAiPromptChange}
                  onAIEdit={onAIEdit}
                  isAIEditing={isAIEditing}
                />
              ) : (
                <p className="text-sm text-foreground">{endpoint.description}</p>
              )}
            </div>
            
            {/* Parameters */}
            {endpoint.parameters.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-muted-foreground">Parameters</h5>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-1.5 px-2 font-medium">Name</th>
                        <th className="text-left py-1.5 px-2 font-medium">In</th>
                        <th className="text-left py-1.5 px-2 font-medium">Type</th>
                        <th className="text-left py-1.5 px-2 font-medium">Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {endpoint.parameters.map(param => (
                        <tr key={param.name} className="border-b border-border/50">
                          <td className="py-1.5 px-2 font-mono">{param.name}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{param.in}</td>
                          <td className="py-1.5 px-2 text-muted-foreground">{param.type}</td>
                          <td className="py-1.5 px-2">
                            {param.required ? (
                              <span className="text-primary">Yes</span>
                            ) : (
                              <span className="text-muted-foreground">No</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Responses */}
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground">Responses</h5>
              <div className="space-y-1">
                {endpoint.responses.map(response => (
                  <div 
                    key={response.statusCode}
                    className="flex items-center gap-2 p-2 rounded bg-secondary/50"
                  >
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold",
                      response.statusCode.startsWith('2') 
                        ? 'bg-success/20 text-success'
                        : response.statusCode.startsWith('4')
                        ? 'bg-warning/20 text-warning'
                        : 'bg-destructive/20 text-destructive'
                    )}>
                      {response.statusCode}
                    </span>
                    <span className="text-xs text-muted-foreground">{response.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
