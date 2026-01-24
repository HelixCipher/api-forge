import { useEffect, useState } from 'react';
import { Cpu, Zap, Loader2, CheckCircle2, XCircle, HardDrive } from 'lucide-react';
import { getSystemStatus, SystemStatus } from '@/lib/api-client';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function SystemStatusIndicator() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      const result = await getSystemStatus();
      setStatus(result);
      setLoading(false);
    };

    fetchStatus();
    
    // Poll every 3 seconds
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-muted text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Checking...</span>
      </div>
    );
  }

  if (!status || !status.ollama_connected) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-destructive/20 text-destructive cursor-help">
              <XCircle className="w-3 h-3" />
              <span>Offline</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium">Ollama Not Connected</p>
            <p className="text-xs text-muted-foreground mt-1">
              Make sure Docker Compose is running with the Ollama service.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const computeIcon = status.compute_mode.includes('gpu') 
    ? <Zap className="w-3 h-3" /> 
    : <Cpu className="w-3 h-3" />;

  const computeLabel = status.compute_mode === 'gpu-nvidia' 
    ? 'NVIDIA GPU' 
    : status.compute_mode === 'gpu-amd' 
    ? 'AMD GPU' 
    : 'CPU';

  const computeColor = status.compute_mode.includes('gpu')
    ? 'bg-success/20 text-success'
    : 'bg-warning/20 text-warning';

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {/* Compute Mode Badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs cursor-help ${computeColor}`}>
              {computeIcon}
              <span>{computeLabel}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium">Compute Mode: {computeLabel}</p>
            {status.gpu_info && (
              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                {status.gpu_info.family && <p>Family: {status.gpu_info.family}</p>}
                {status.gpu_info.parameter_size && <p>Size: {status.gpu_info.parameter_size}</p>}
                {status.gpu_info.quantization && <p>Quantization: {status.gpu_info.quantization}</p>}
              </div>
            )}
            {!status.compute_mode.includes('gpu') && (
              <p className="text-xs text-muted-foreground mt-1">
                Running on CPU. Use GPU profiles for faster inference: docker compose --profile gpu-nvidia up or docker compose --profile gpu-amd up
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {/* Model Status */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs bg-primary/20 text-primary cursor-help">
              {status.model_loaded ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{status.model_name}</span>
                </>
              ) : status.model_loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <HardDrive className="w-3 h-3" />
                  <span>Ready</span>
                </>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="font-medium">Model: {status.model_name}</p>
            {status.model_loaded ? (
              <p className="text-xs text-muted-foreground mt-1">
                Model is loaded and ready for inference.
              </p>
            ) : status.model_loading ? (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Loading model... {status.model_progress}%
                </p>
                <Progress value={status.model_progress} className="h-1" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Model available. Will load on first request.
              </p>
            )}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
