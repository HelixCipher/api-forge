import { Check, X, Edit2, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Endpoint } from '@/types/api';
import { cn } from '@/lib/utils';

interface EndpointReviewPanelProps {
  endpoints: Endpoint[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onApproveAll: () => void;
  onGenerateSpec: () => void;
  isLoading: boolean;
}

export function EndpointReviewPanel({
  endpoints,
  onApprove,
  onReject,
  onApproveAll,
  onGenerateSpec,
  isLoading
}: EndpointReviewPanelProps) {
  const approvedCount = endpoints.filter(e => e.approved).length;
  const allApproved = endpoints.length > 0 && approvedCount === endpoints.length;

  if (endpoints.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
            <Edit2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">No Endpoints Yet</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Start describing your API in the chat, and I'll propose endpoints for your review.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Review Endpoints</h2>
          <div className="text-xs text-muted-foreground">
            {approvedCount}/{endpoints.length} approved
          </div>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-primary transition-all duration-300"
            style={{ width: `${(approvedCount / endpoints.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Endpoints List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
        {endpoints.map((endpoint) => (
          <EndpointCard
            key={endpoint.id}
            endpoint={endpoint}
            onApprove={() => onApprove(endpoint.id)}
            onReject={() => onReject(endpoint.id)}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border bg-gradient-card space-y-2">
        {!allApproved && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={onApproveAll}
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Approve All Endpoints
          </Button>
        )}
        <Button
          variant="gradient"
          className="w-full"
          onClick={onGenerateSpec}
          disabled={approvedCount === 0 || isLoading}
        >
          <Zap className="w-4 h-4 mr-2" />
          {isLoading ? 'Generating...' : 'Generate OpenAPI Spec'}
        </Button>
      </div>
    </div>
  );
}

interface EndpointCardProps {
  endpoint: Endpoint;
  onApprove: () => void;
  onReject: () => void;
}

function EndpointCard({ endpoint, onApprove, onReject }: EndpointCardProps) {
  const methodColors: Record<string, string> = {
    GET: 'bg-success/20 text-success border-success/30',
    POST: 'bg-primary/20 text-primary border-primary/30',
    PUT: 'bg-warning/20 text-warning border-warning/30',
    PATCH: 'bg-accent/20 text-accent border-accent/30',
    DELETE: 'bg-destructive/20 text-destructive border-destructive/30'
  };

  return (
    <div
      className={cn(
        "group rounded-lg border p-3 transition-all duration-200",
        endpoint.approved
          ? "bg-success/5 border-success/30"
          : "bg-card border-border hover:border-primary/30"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold border",
                methodColors[endpoint.method]
              )}
            >
              {endpoint.method}
            </span>
            <code className="text-xs font-mono text-foreground truncate">
              {endpoint.path}
            </code>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {endpoint.summary}
          </p>
        </div>

        {!endpoint.approved ? (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-success hover:bg-success/20"
              onClick={onApprove}
            >
              <Check className="w-4 h-4" />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/20"
              onClick={onReject}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-success">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-[10px] font-medium">Approved</span>
          </div>
        )}
      </div>
    </div>
  );
}
