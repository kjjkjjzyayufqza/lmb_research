import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { WebGlRenderer } from "@/lib/render/webgl";
import { useEditorState, useEditorDispatch } from "@/lib/editor/state";

interface StageProps {
  onRendererReady: (renderer: WebGlRenderer) => void;
}

type FitMode = "fit" | "actual" | "fill";

export function Stage({ onRendererReady }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textCanvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WebGlRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const [fitMode, setFitMode] = useState<FitMode>("fit");
  const [zoom, setZoom] = useState(1);
  const [containerSize, setContainerSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    if (!canvasRef.current || rendererRef.current) return;
    try {
      const renderer = new WebGlRenderer(canvasRef.current);
      if (textCanvasRef.current) {
        renderer.setTextCanvas(textCanvasRef.current);
      }
      rendererRef.current = renderer;
      onRendererReady(renderer);
    } catch (e) {
      console.error("Failed to initialize WebGL:", e);
    }
  }, [onRendererReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!state.resourceStore || !state.displayInstances.length) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      const instances = state.displayInstances;
      for (let idx = instances.length - 1; idx >= 0; idx--) {
        const inst = instances[idx];
        if (!inst.bounds) continue;
        const t = inst.transform;
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
          dispatch({ type: "SELECT_INSTANCE", placementId: inst.placementId });
          return;
        }
      }

      dispatch({ type: "SELECT_INSTANCE", placementId: null });
    },
    [state.resourceStore, state.displayInstances, dispatch]
  );

  const meta = state.json?.meta;
  const stageWidth = meta?.width || 512;
  const stageHeight = meta?.height || 256;

  const computedScale = (() => {
    if (fitMode === "actual") return zoom;
    const padding = 16;
    const availW = containerSize.w - padding * 2;
    const availH = containerSize.h - padding * 2;
    if (availW <= 0 || availH <= 0) return 1;
    const scaleW = availW / stageWidth;
    const scaleH = availH / stageHeight;
    if (fitMode === "fill") return Math.max(scaleW, scaleH) * zoom;
    return Math.min(scaleW, scaleH, 1) * zoom;
  })();

  const displayW = stageWidth * computedScale;
  const displayH = stageHeight * computedScale;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 flex items-center justify-center bg-neutral-900 overflow-hidden"
    >
      <div style={{ position: "relative", width: `${displayW}px`, height: `${displayH}px` }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="cursor-crosshair"
          style={{
            width: "100%",
            height: "100%",
            imageRendering: computedScale < 1 ? "auto" : "pixelated",
          }}
        />
        <canvas
          ref={textCanvasRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        />
      </div>

      <div
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          backgroundImage:
            "repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Stage controls overlay */}
      <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-md px-1 py-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={fitMode === "fit" ? "secondary" : "ghost"}
              size="icon-sm"
              className="h-6 w-6"
              onClick={() => { setFitMode("fit"); setZoom(1); }}
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit to Window</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={fitMode === "actual" ? "secondary" : "ghost"}
              size="icon-sm"
              className="h-6 w-6"
              onClick={() => { setFitMode("actual"); setZoom(1); }}
            >
              <span className="text-[9px] font-bold">1:1</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Actual Size (1:1)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={fitMode === "fill" ? "secondary" : "ghost"}
              size="icon-sm"
              className="h-6 w-6"
              onClick={() => { setFitMode("fill"); setZoom(1); }}
            >
              <Maximize2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fill Window</TooltipContent>
        </Tooltip>

        <div className="w-px h-4 bg-white/20 mx-0.5" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6"
              onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>

        <span className="text-[10px] text-white/70 tabular-nums w-8 text-center">
          {Math.round(computedScale * 100)}%
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6"
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6"
              onClick={() => setZoom(1)}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reset Zoom</TooltipContent>
        </Tooltip>
      </div>

      {/* Stage info overlay */}
      {!state.json && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-2 text-muted-foreground">
            <div className="text-lg font-semibold">LMB Preview</div>
            <div className="text-sm">
              Click <strong>Open JSON</strong> or <strong>Open folder</strong> to load an LMB animation
            </div>
            <div className="text-xs text-muted-foreground/60">
              Supports keyboard: ↑↓←→ Navigate | Enter Confirm | Esc Cancel
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
