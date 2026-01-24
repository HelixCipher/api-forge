import { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Loader2,
  ArrowRight,
  Cpu,
  GitBranch
} from 'lucide-react';
import { MCPContext } from '@/types/api';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface MCPContextPanelProps {
  context: MCPContext | null;
  isAutoFixing?: boolean;
}

const PHASE_CONFIG: Record<MCPContext['phase'], { label: string; color: string; icon: React.ReactNode }> = {
  gathering: { 
    label: 'Gathering Requirements', 
    color: 'text-muted-foreground',
    icon: <GitBranch className="w-4 h-4" />
  },
  proposing: { 
    label: 'Proposing Endpoints', 
    color: 'text-blue-500',
    icon: <Cpu className="w-4 h-4" />
  },
  reviewing: { 
    label: 'Human Review', 
    color: 'text-amber-500',
    icon: <AlertTriangle className="w-4 h-4" />
  },
  generating: { 
    label: 'Generating Spec', 
    color: 'text-purple-500',
    icon: <RefreshCw className="w-4 h-4 animate-spin" />
  },
  validating: { 
    label: 'Validating & Fixing', 
    color: 'text-orange-500',
    icon: <RefreshCw className="w-4 h-4 animate-spin" />
  },
  complete: { 
    label: 'Complete', 
    color: 'text-success',
    icon: <CheckCircle2 className="w-4 h-4" />
  }
};

const PHASES_ORDER: MCPContext['phase'][] = [
  'gathering', 'proposing', 'reviewing', 'generating', 'validating', 'complete'
];

export function MCPContextPanel({ context, isAutoFixing }: MCPContextPanelProps) {
  const [errorHistory, setErrorHistory] = useState<Array<{ iteration: number; errors: number; warnings: number }>>([]);

  // Track error history
  useEffect(() => {
    if (context && context.iteration_count > 0) {
      setErrorHistory(prev => {
        const exists = prev.some(h => h.iteration === context.iteration_count);
        if (exists) return prev;
        return [...prev, {
          iteration: context.iteration_count,
          errors: context.errors_count,
          warnings: context.warnings_count
        }].slice(-10); // Keep last 10 iterations
      });
    }
  }, [context?.iteration_count, context?.errors_count, context?.warnings_count]);

  // Reset history when phase changes to gathering
  useEffect(() => {
    if (context?.phase === 'gathering') {
      setErrorHistory([]);
    }
  }, [context?.phase]);

  if (!context) {
    return (
      <div className="p-4 rounded-lg border border-border bg-card/50">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Cpu className="w-4 h-4" />
          <span className="text-sm">MCP context will appear here when processing</span>
        </div>
      </div>
    );
  }

  const currentPhaseIndex = PHASES_ORDER.indexOf(context.phase);
  const progressPercent = ((currentPhaseIndex + 1) / PHASES_ORDER.length) * 100;
  const phaseConfig = PHASE_CONFIG[context.phase];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">MCP Context</h3>
            <p className="text-[10px] text-muted-foreground">Model Context Protocol State</p>
          </div>
        </div>
        {isAutoFixing && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
            <Loader2 className="w-3 h-3 text-orange-500 animate-spin" />
            <span className="text-[10px] font-medium text-orange-500">Auto-fixing...</span>
          </div>
        )}
      </div>

      {/* Phase Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <div className={cn("flex items-center gap-1.5", phaseConfig.color)}>
            {phaseConfig.icon}
            <span className="font-medium">{phaseConfig.label}</span>
          </div>
          <span className="text-muted-foreground">{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} className="h-1.5" />
        
        {/* Phase Steps */}
        <div className="flex items-center justify-between text-[10px] mt-2">
          {PHASES_ORDER.map((phase, index) => {
            const isActive = phase === context.phase;
            const isComplete = index < currentPhaseIndex;
            const config = PHASE_CONFIG[phase];
            
            return (
              <div 
                key={phase}
                className={cn(
                  "flex items-center gap-0.5",
                  isActive && config.color,
                  isComplete && "text-success",
                  !isActive && !isComplete && "text-muted-foreground/50"
                )}
              >
                {isComplete ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : isActive ? (
                  <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                ) : (
                  <div className="w-2 h-2 rounded-full border border-current" />
                )}
                {index < PHASES_ORDER.length - 1 && (
                  <ArrowRight className="w-2 h-2 mx-0.5 opacity-30" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <div className="text-lg font-bold text-foreground">{context.iteration_count}</div>
          <div className="text-[10px] text-muted-foreground">Iterations</div>
        </div>
        <div className={cn(
          "p-3 rounded-lg border",
          context.errors_count > 0 
            ? "bg-destructive/10 border-destructive/20" 
            : "bg-success/10 border-success/20"
        )}>
          <div className={cn(
            "text-lg font-bold flex items-center gap-1",
            context.errors_count > 0 ? "text-destructive" : "text-success"
          )}>
            {context.errors_count > 0 ? (
              <XCircle className="w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {context.errors_count}
          </div>
          <div className="text-[10px] text-muted-foreground">Errors</div>
        </div>
        <div className={cn(
          "p-3 rounded-lg border",
          context.warnings_count > 0 
            ? "bg-warning/10 border-warning/20" 
            : "bg-muted/30 border-border"
        )}>
          <div className={cn(
            "text-lg font-bold flex items-center gap-1",
            context.warnings_count > 0 ? "text-warning" : "text-muted-foreground"
          )}>
            {context.warnings_count > 0 && <AlertTriangle className="w-4 h-4" />}
            {context.warnings_count}
          </div>
          <div className="text-[10px] text-muted-foreground">Warnings</div>
        </div>
      </div>

      {/* Error Progression Chart */}
      {errorHistory.length > 1 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">Error Progression</h4>
          <div className="h-16 flex items-end gap-1 px-2 py-2 rounded-lg bg-muted/20 border border-border">
            {errorHistory.map((entry, index) => {
              const maxErrors = Math.max(...errorHistory.map(h => h.errors), 1);
              const height = (entry.errors / maxErrors) * 100;
              const isLast = index === errorHistory.length - 1;
              
              return (
                <div 
                  key={entry.iteration}
                  className="flex-1 flex flex-col items-center gap-0.5"
                >
                  <div 
                    className={cn(
                      "w-full rounded-t transition-all duration-300",
                      entry.errors === 0 ? "bg-success" : "bg-destructive/70",
                      isLast && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                    )}
                    style={{ height: `${Math.max(height, 8)}%` }}
                  />
                  <span className="text-[8px] text-muted-foreground">
                    #{entry.iteration}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            {errorHistory[errorHistory.length - 1]?.errors === 0 
              ? "✅ All errors resolved!" 
              : `Fixing ${errorHistory[errorHistory.length - 1]?.errors} remaining errors...`
            }
          </p>
        </div>
      )}

      {/* Conversation ID */}
      {context.conversation_id && (
        <div className="pt-2 border-t border-border">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">Session ID</span>
            <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-muted-foreground">
              {context.conversation_id.slice(0, 8)}...
            </code>
          </div>
        </div>
      )}
    </div>
  );
}
