import { useEffect, useRef } from 'react';

interface BrowserPreviewProps {
  frame: string | null;
  isRunning: boolean;
}

export function BrowserPreview({ frame, isRunning }: BrowserPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!frame || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/jpeg;base64,${frame}`;
  }, [frame]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b">
        <div className="flex gap-1">
          <span className="size-2.5 rounded-full bg-red-400" />
          <span className="size-2.5 rounded-full bg-yellow-400" />
          <span className="size-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-muted rounded px-2 py-0.5 text-[10px] text-muted-foreground font-mono truncate">
          {isRunning ? 'Navigating...' : 'Ready'}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-white">
        {frame ? (
          <canvas ref={canvasRef} className="w-full h-full object-contain" />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            <div className="text-center">
              <p>{isRunning ? 'Starting browser...' : 'Click Run to start'}</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 py-1 bg-muted/50 border-t text-[9px] text-muted-foreground">
        <span>1280x720 viewport</span>
        <span>CDP Screencast</span>
      </div>
    </div>
  );
}
