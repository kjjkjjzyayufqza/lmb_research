import React, { useRef, useEffect, useCallback } from "react";
import { WebGlRenderer } from "@/lib/render/webgl";
import { useEditorState, useEditorDispatch } from "@/lib/editor/state";

interface StageProps {
  onRendererReady: (renderer: WebGlRenderer) => void;
}

/**
 * Stage component: WebGL canvas for rendering the LMB scene.
 * Handles canvas initialization, resize, and selection highlight overlay.
 */
export function Stage({ onRendererReady }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGlRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const state = useEditorState();
  const dispatch = useEditorDispatch();

  useEffect(() => {
    if (!canvasRef.current || rendererRef.current) return;
    try {
      const renderer = new WebGlRenderer(canvasRef.current);
      rendererRef.current = renderer;
      onRendererReady(renderer);
    } catch (e) {
      console.error("Failed to initialize WebGL:", e);
    }
  }, [onRendererReady]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!state.resourceStore || !state.displayInstances.length) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      // Convert click position to stage coordinates (centered origin)
      const clickX = (e.clientX - rect.left) * scaleX - canvas.width / 2;
      const clickY = (e.clientY - rect.top) * scaleY - canvas.height / 2;

      // Find the topmost instance whose bounds contain the click point
      // Iterate in reverse depth order (topmost first)
      const sorted = [...state.displayInstances].sort(
        (a, b) => b.depth - a.depth
      );

      for (const inst of sorted) {
        if (!inst.bounds) continue;
        const t = inst.transform;
        // Approximate hit test: inverse-transform the click point
        // and check against the local bounds.
        const det = t.a * t.d - t.b * t.c;
        if (Math.abs(det) < 1e-6) continue;

        const invDet = 1 / det;
        const localX =
          (t.d * (clickX - t.x) - t.c * (clickY - t.y)) * invDet;
        const localY =
          (-t.b * (clickX - t.x) + t.a * (clickY - t.y)) * invDet;

        const bx = inst.bounds.x;
        const by = inst.bounds.y;
        const bw = inst.bounds.width;
        const bh = inst.bounds.height;

        if (
          localX >= bx &&
          localX <= bx + bw &&
          localY >= by &&
          localY <= by + bh
        ) {
          dispatch({ type: "SELECT_DEPTH", depth: inst.depth });
          return;
        }
      }

      // Click on empty area: deselect
      dispatch({ type: "SELECT_DEPTH", depth: null });
    },
    [state.resourceStore, state.displayInstances, dispatch]
  );

  const meta = state.json?.meta;
  const stageWidth = meta?.width || 512;
  const stageHeight = meta?.height || 256;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex items-center justify-center bg-neutral-900 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="max-w-full max-h-full cursor-crosshair"
        style={{
          width: `${stageWidth}px`,
          height: `${stageHeight}px`,
          imageRendering: "pixelated",
        }}
      />
      {/* Checkerboard background for transparency visualization */}
      <div
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          backgroundImage:
            "repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%)",
          backgroundSize: "20px 20px",
        }}
      />
    </div>
  );
}
