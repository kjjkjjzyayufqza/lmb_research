import React, { useEffect, useRef } from 'react';
import { WebGlRenderer } from '../lib/preview_renderer_webgl';

interface CanvasViewProps {
  onRendererReady: (renderer: WebGlRenderer) => void;
  textOverlayRef?: React.RefObject<HTMLDivElement>;
}

export const CanvasView: React.FC<CanvasViewProps> = ({ onRendererReady, textOverlayRef }) => {
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
      border: '1px solid #444',
      position: 'relative' // Needed for absolute positioning of overlay
    }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <canvas
          ref={canvasRef}
          style={{
            // Let the canvas scale down with its container while
            // preserving the internal resolution defined by meta.
            // This keeps the LMB stage coordinates unchanged while
            // allowing the UI (especially the Meta Info panel) to
            // remain visible on smaller viewports.
            width: '100%',
            height: 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'block',
          }}
        />
        <div 
            ref={textOverlayRef} 
            style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                pointerEvents: 'none',
                overflow: 'hidden'
            }} 
        />
      </div>
    </div>
  );
};

