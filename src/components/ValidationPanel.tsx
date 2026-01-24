import { CheckCircle2, AlertTriangle, XCircle, Shield } from 'lucide-react';
import { ValidationResult } from '@/types/api';
import { cn } from '@/lib/utils';

interface ValidationPanelProps {
  result: ValidationResult | null;
}

export function ValidationPanel({ result }: ValidationPanelProps) {
  if (!result) {
    return (
      <div className="p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span className="text-sm">Validation results will appear here</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div
        className={cn(
          "p-4 rounded-lg border flex items-center gap-3",
          result.valid
            ? "bg-success/10 border-success/30"
            : "bg-destructive/10 border-destructive/30"
        )}
      >
        {result.valid ? (
          <CheckCircle2 className="w-5 h-5 text-success" />
        ) : (
          <XCircle className="w-5 h-5 text-destructive" />
        )}
        <div>
          <h3 className={cn(
            "font-semibold text-sm",
            result.valid ? "text-success" : "text-destructive"
          )}>
            {result.valid ? "Specification Valid" : "Validation Failed"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {result.errors.length} error(s), {result.warnings.length} warning(s)
          </p>
        </div>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-destructive uppercase tracking-wide flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            Errors
          </h4>
          {result.errors.map((error, index) => (
            <div
              key={index}
              className="p-3 rounded-lg bg-destructive/10 border border-destructive/20"
            >
              <code className="text-[10px] text-destructive/70 block mb-1">
                {error.path}
              </code>
              <p className="text-xs text-destructive">{error.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-warning uppercase tracking-wide flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Warnings
          </h4>
          {result.warnings.map((warning, index) => (
            <div
              key={index}
              className="p-3 rounded-lg bg-warning/10 border border-warning/20"
            >
              <code className="text-[10px] text-warning/70 block mb-1">
                {warning.path}
              </code>
              <p className="text-xs text-warning">{warning.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
