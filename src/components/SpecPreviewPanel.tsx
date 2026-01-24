import { useState } from 'react';
import { Copy, Download, CheckCircle2, AlertCircle, FileJson, FileCode, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OpenAPISpec, ValidationResult } from '@/types/api';
import { specToYaml } from '@/lib/spec-generator';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface SpecPreviewPanelProps {
  spec: OpenAPISpec | null;
  validationResult: ValidationResult | null;
}

export function SpecPreviewPanel({ spec, validationResult }: SpecPreviewPanelProps) {
  const [format, setFormat] = useState<'yaml' | 'json'>('yaml');
  const [copied, setCopied] = useState(false);

  if (!spec) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto mb-4">
            <FileCode className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg mb-2">OpenAPI Specification</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Your generated specification will appear here after you approve endpoints and generate the spec.
          </p>
        </div>
      </div>
    );
  }

  const specContent = format === 'json' 
    ? JSON.stringify(spec, null, 2)
    : specToYaml(spec).trim();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(specContent);
    setCopied(true);
    toast({
      title: "Copied to clipboard",
      description: `OpenAPI spec copied as ${format.toUpperCase()}`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([specContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `openapi-spec.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded",
      description: `Saved as openapi-spec.${format}`,
    });
  };

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-gradient-card">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-accent flex items-center justify-center">
            <FileCode className="w-4 h-4 text-accent-foreground" />
          </div>
          <div>
            <h2 className="font-semibold text-sm">{spec.info.title}</h2>
            <p className="text-[10px] text-muted-foreground">v{spec.info.version} • OpenAPI {spec.openapi}</p>
          </div>
        </div>

        {/* Format Toggle */}
        <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
          <button
            onClick={() => setFormat('yaml')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-all",
              format === 'yaml' 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            YAML
          </button>
          <button
            onClick={() => setFormat('json')}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded transition-all",
              format === 'json' 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            JSON
          </button>
        </div>
      </div>

      {/* Validation Status */}
      {validationResult && (
        <div
          className={cn(
            "px-4 py-2 flex items-center gap-2 text-sm border-b",
            validationResult.valid
              ? "bg-success/10 border-success/20 text-success"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          )}
        >
          {validationResult.valid ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Specification is valid</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>{validationResult.errors.length} validation error(s)</span>
            </>
          )}
          {validationResult.warnings.length > 0 && (
            <span className="text-warning ml-2">
              • {validationResult.warnings.length} warning(s)
            </span>
          )}
        </div>
      )}

      {/* Code Preview */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <pre className="font-mono text-xs leading-relaxed">
          <HighlightedCode code={specContent} format={format} />
        </pre>
      </div>

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

function HighlightedCode({ code, format }: { code: string; format: 'yaml' | 'json' }) {
  const lines = code.split('\n');
  
  return (
    <>
      {lines.map((line, index) => (
        <div key={index} className="flex">
          <span className="w-8 text-right pr-4 text-muted-foreground/50 select-none">
            {index + 1}
          </span>
          <span className="flex-1">
            {highlightLine(line, format)}
          </span>
        </div>
      ))}
    </>
  );
}

function highlightLine(line: string, format: 'yaml' | 'json'): React.ReactNode {
  if (format === 'yaml') {
    // YAML highlighting
    if (line.trim().startsWith('#')) {
      return <span className="text-code-comment">{line}</span>;
    }
    
    const keyMatch = line.match(/^(\s*)([^:]+)(:)(.*)/);
    if (keyMatch) {
      const [, indent, key, colon, value] = keyMatch;
      return (
        <>
          {indent}
          <span className="text-code-property">{key}</span>
          <span className="text-muted-foreground">{colon}</span>
          {highlightValue(value.trim())}
        </>
      );
    }
    
    if (line.trim().startsWith('-')) {
      const dashMatch = line.match(/^(\s*)(- )(.*)/);
      if (dashMatch) {
        const [, indent, dash, rest] = dashMatch;
        return (
          <>
            {indent}
            <span className="text-muted-foreground">{dash}</span>
            {highlightValue(rest)}
          </>
        );
      }
    }
    
    return line;
  } else {
    // JSON highlighting
    const keyMatch = line.match(/^(\s*)"([^"]+)"(:)(.*)/);
    if (keyMatch) {
      const [, indent, key, colon, rest] = keyMatch;
      return (
        <>
          {indent}
          <span className="text-code-property">"{key}"</span>
          <span className="text-muted-foreground">{colon}</span>
          {highlightValue(rest.trim())}
        </>
      );
    }
    
    return highlightValue(line);
  }
}

function highlightValue(value: string): React.ReactNode {
  if (!value) return null;
  
  // String
  if (value.match(/^["'].*["'],?$/)) {
    return <span className="text-code-string"> {value}</span>;
  }
  
  // Number
  if (value.match(/^\d+,?$/)) {
    return <span className="text-code-number"> {value}</span>;
  }
  
  // Boolean/null
  if (value.match(/^(true|false|null),?$/)) {
    return <span className="text-code-keyword"> {value}</span>;
  }
  
  // Brackets
  if (value.match(/^[\[\]{}],?$/)) {
    return <span className="text-muted-foreground"> {value}</span>;
  }
  
  return <span> {value}</span>;
}
