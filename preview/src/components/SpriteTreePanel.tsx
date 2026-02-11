import React, { useCallback, useState } from "react";
import {
  Play,
  Square,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorState } from "@/lib/editor/state";
import type { NestedSpriteTreeNode } from "@/lib/lmb/scene";
import type { TimelinePlayer } from "@/lib/lmb/player";

interface SpriteTreePanelProps {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}

/**
 * SpriteTreePanel displays a tree of all nested sprite instances
 * and provides interactive controls for each (play/stop, goto label,
 * alpha slider, visibility toggle).
 *
 * A local version counter is incremented after every scene mutation
 * to guarantee the component re-reads the tree data even when no
 * external state (EditorState) changes.
 */
export function SpriteTreePanel({ playerRef, onRender }: SpriteTreePanelProps) {
  const state = useEditorState();
  const scene = state.scene;
  // Local counter to force re-render after mutating scene objects.
  const [version, setVersion] = useState(0);

  const forceUpdate = useCallback(() => {
    setVersion((v) => v + 1);
    onRender();
  }, [onRender]);

  if (!scene) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No scene loaded. Open a JSON file first.
      </div>
    );
  }

  const tree = scene.getNestedSpriteTree();

  if (tree.length === 0) {
    return (
      <div className="p-3 text-xs text-muted-foreground">
        No nested sprites in the current scene.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        <h3 className="text-sm font-semibold mb-2">
          Nested Sprites ({tree.length})
        </h3>
        {tree.map((node) => (
          <SpriteTreeNodeView
            key={node.placementId}
            node={node}
            playerRef={playerRef}
            forceUpdate={forceUpdate}
            depth={0}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface SpriteTreeNodeViewProps {
  node: NestedSpriteTreeNode;
  playerRef: React.RefObject<TimelinePlayer | null>;
  forceUpdate: () => void;
  depth: number;
}

function SpriteTreeNodeView({
  node,
  playerRef,
  forceUpdate,
  depth,
}: SpriteTreeNodeViewProps) {
  const [expanded, setExpanded] = useState(true);
  const state = useEditorState();
  const scene = state.scene;
  const resourceStore = state.resourceStore;

  const hasChildren = node.children.length > 0;
  const labelEntries = Object.entries(node.labels);

  const handleGotoLabel = useCallback(
    (label: string, andPlay: boolean) => {
      if (!scene || !resourceStore) return;
      const method = andPlay ? "gotoAndPlay" : "gotoAndStop";
      scene.executeOnNestedSprite(node.placementId, method, label, resourceStore);
      forceUpdate();
    },
    [scene, resourceStore, node.placementId, forceUpdate]
  );

  const handlePlay = useCallback(() => {
    if (!scene || !resourceStore) return;
    scene.executeOnNestedSprite(node.placementId, "play", undefined, resourceStore);
    forceUpdate();
  }, [scene, resourceStore, node.placementId, forceUpdate]);

  const handleStop = useCallback(() => {
    if (!scene || !resourceStore) return;
    scene.executeOnNestedSprite(node.placementId, "stop", undefined, resourceStore);
    forceUpdate();
  }, [scene, resourceStore, node.placementId, forceUpdate]);

  const handleAlphaChange = useCallback(
    (value: number[]) => {
      if (!scene) return;
      scene.setNestedAlpha(node.placementId, value[0]);
      forceUpdate();
    },
    [scene, node.placementId, forceUpdate]
  );

  const handleToggleVisible = useCallback(() => {
    if (!scene) return;
    const currentVisible = node.visibleOverride !== false;
    scene.setNestedVisible(node.placementId, !currentVisible);
    forceUpdate();
  }, [scene, node.placementId, node.visibleOverride, forceUpdate]);

  const currentAlpha = node.alphaOverride !== undefined ? node.alphaOverride : 100;
  const isVisible = node.visibleOverride !== false;

  return (
    <div style={{ paddingLeft: depth * 12 }}>
      {/* Node header */}
      <div className="flex items-center gap-1 py-1 rounded hover:bg-muted/50 px-1">
        {/* Expand/collapse toggle */}
        <button
          className="w-4 h-4 flex items-center justify-center text-muted-foreground shrink-0"
          onClick={() => setExpanded(!expanded)}
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )
          ) : (
            <span className="w-3" />
          )}
        </button>

        {/* Name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono font-medium truncate">
              {node.name}
            </span>
            <Badge variant="outline" className="text-[10px] px-1 py-0 shrink-0">
              Sprite {node.characterId}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="tabular-nums">
              frame {node.frameIndex}/{node.numFrames}
            </span>
            <span className={node.stopped ? "text-orange-400" : "text-green-400"}>
              {node.stopped ? "Stopped" : "Playing"}
            </span>
          </div>
        </div>

        {/* Play/Stop buttons */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-5 w-5"
              onClick={handlePlay}
            >
              <Play className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Play</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-5 w-5"
              onClick={handleStop}
            >
              <Square className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Stop</TooltipContent>
        </Tooltip>

        {/* Visibility toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isVisible ? "ghost" : "secondary"}
              size="icon-sm"
              className="h-5 w-5"
              onClick={handleToggleVisible}
            >
              {isVisible ? (
                <Eye className="h-3 w-3" />
              ) : (
                <EyeOff className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            {isVisible ? "Hide" : "Show"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="pl-5 space-y-1.5 pb-1">
          {/* Frame labels */}
          {labelEntries.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {labelEntries.map(([label, frameIdx]) => (
                <LabelButton
                  key={label}
                  label={label}
                  frameIdx={frameIdx}
                  onGoto={handleGotoLabel}
                />
              ))}
            </div>
          )}

          {/* Alpha slider */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground w-10 shrink-0">
              Alpha
            </span>
            <Slider
              value={[currentAlpha]}
              min={0}
              max={100}
              step={1}
              onValueChange={handleAlphaChange}
              className="flex-1"
            />
            <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">
              {currentAlpha}
            </span>
          </div>

          {/* Children */}
          {hasChildren &&
            node.children.map((child) => (
              <SpriteTreeNodeView
                key={child.placementId}
                node={child}
                playerRef={playerRef}
                forceUpdate={forceUpdate}
                depth={depth + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
}

interface LabelButtonProps {
  label: string;
  frameIdx: number;
  onGoto: (label: string, andPlay: boolean) => void;
}

function LabelButton({ label, frameIdx, onGoto }: LabelButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted hover:bg-accent hover:text-accent-foreground transition-colors"
          onClick={() => onGoto(label, false)}
          onDoubleClick={() => onGoto(label, true)}
        >
          {label}
          <span className="text-muted-foreground">:{frameIdx}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        Click: gotoAndStop &middot; Double-click: gotoAndPlay
      </TooltipContent>
    </Tooltip>
  );
}
