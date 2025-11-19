import React, { useEffect, useRef } from 'react';
import { WebGlRenderer } from '../lib/preview_renderer_webgl';

interface CanvasViewProps {
  onRendererReady: (renderer: WebGlRenderer) => void;
}

export const CanvasView: React.FC<CanvasViewProps> = ({ onRendererReady }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGlRenderer | null>(null);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      const renderer = new WebGlRenderer(canvasRef.current);
      rendererRef.current = renderer;
      onRendererReady(renderer);
    }
  }, [onRendererReady]);

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      background: '#000', 
      overflow: 'hidden',
      border: '1px solid #444' 
    }}>
      <canvas ref={canvasRef} />
    </div>
  );
};

