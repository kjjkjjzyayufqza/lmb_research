import React, { useCallback, useMemo } from "react";
import {
  Play,
  Pause,
  Square,
  SkipBack,
  SkipForward,
  Repeat,
  Undo2,
  Redo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEditorState, useEditorDispatch } from "@/lib/editor/state";
import { type TimelinePlayer, getLabelSections } from "@/lib/lmb/player";

interface TimelineBarProps {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}

/**
 * TimelineBar: playback controls, section selector, frame scrubber,
 * undo/redo buttons.  Sits at the bottom of the application.
 */
export function TimelineBar({ playerRef, onRender }: TimelineBarProps) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();

  const player = playerRef.current;
  const totalPlayable = player?.getTotalFrames() ?? 0;
  const currentLabel = state.currentFrame?.label;

  const sections = useMemo(() => {
    if (!state.currentSprite) return [];
    return getLabelSections(state.currentSprite);
  }, [state.currentSprite]);

  const handlePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    p.setLoop(state.loop);
    p.play();
    dispatch({ type: "SET_PLAYING", playing: true });
  }, [playerRef, state.loop, dispatch]);

  const handlePause = useCallback(() => {
    playerRef.current?.pause();
    dispatch({ type: "SET_PLAYING", playing: false });
  }, [playerRef, dispatch]);

  const handleStop = useCallback(() => {
    playerRef.current?.stop();
    dispatch({ type: "SET_PLAYING", playing: false });
    onRender();
  }, [playerRef, dispatch, onRender]);

  const handlePrevFrame = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    p.pause();
    dispatch({ type: "SET_PLAYING", playing: false });
    p.stepBackward();
    onRender();
  }, [playerRef, dispatch, onRender]);

  const handleNextFrame = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    p.pause();
    dispatch({ type: "SET_PLAYING", playing: false });
    p.stepForward();
    onRender();
  }, [playerRef, dispatch, onRender]);

  const handleScrub = useCallback(
    (value: number[]) => {
      const p = playerRef.current;
      if (!p) return;
      p.pause();
      dispatch({ type: "SET_PLAYING", playing: false });
      p.scrubToFrame(value[0]);
      onRender();
    },
    [playerRef, dispatch, onRender]
  );

  const handleToggleLoop = useCallback(() => {
    const newLoop = !state.loop;
    dispatch({ type: "SET_LOOP", loop: newLoop });
    playerRef.current?.setLoop(newLoop);
  }, [state.loop, dispatch, playerRef]);

  /**
   * Play a specific labeled section.  This clears the old section
   * restriction, sets the new one, and starts playback.
   */
  const handlePlaySection = useCallback(
    (label: string) => {
      const p = playerRef.current;
      if (!p) return;
      p.setLoop(state.loop);
      p.playSection(label);
      dispatch({ type: "SET_PLAYING", playing: true });
    },
    [playerRef, state.loop, dispatch]
  );

  /**
   * Clear section restriction and return to full-range mode.
   */
  const handleClearSection = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    p.clearSection();
  }, [playerRef]);

  const handleUndo = useCallback(() => {
    dispatch({ type: "UNDO" });
    const p = playerRef.current;
    if (p) {
      p.scrubToFrame(state.frameIndex);
      onRender();
    }
  }, [dispatch, playerRef, state.frameIndex, onRender]);

  const handleRedo = useCallback(() => {
    dispatch({ type: "REDO" });
    const p = playerRef.current;
    if (p) {
      p.scrubToFrame(state.frameIndex);
      onRender();
    }
  }, [dispatch, playerRef, state.frameIndex, onRender]);

  const isLoaded = totalPlayable > 0;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card border-t border-border">
      {/* Playback controls */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handlePrevFrame}
              disabled={!isLoaded}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous Frame</TooltipContent>
        </Tooltip>

        {state.playing ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handlePause}
                disabled={!isLoaded}
              >
                <Pause className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pause</TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handlePlay}
                disabled={!isLoaded}
              >
                <Play className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Play</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleStop}
              disabled={!isLoaded}
            >
              <Square className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleNextFrame}
              disabled={!isLoaded}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next Frame</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={state.loop ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={handleToggleLoop}
              disabled={!isLoaded}
            >
              <Repeat className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle Loop</TooltipContent>
        </Tooltip>
      </div>

      {/* Section selector (only when labels exist) */}
      {sections.length > 0 && (
        <Select
          value=""
          onValueChange={(val) => {
            if (val === "__clear__") {
              handleClearSection();
            } else {
              handlePlaySection(val);
            }
          }}
        >
          <SelectTrigger className="w-[140px] h-7 text-xs">
            <SelectValue placeholder="Play Section..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__clear__">Full Range</SelectItem>
            {sections.map((sec) => (
              <SelectItem key={sec.label} value={sec.label}>
                {sec.label} ({sec.startFrame}-{sec.endFrame})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Frame scrubber */}
      <div className="flex-1 mx-4">
        <Slider
          value={[state.frameIndex]}
          min={0}
          max={Math.max(0, totalPlayable - 1)}
          step={1}
          onValueChange={handleScrub}
          disabled={!isLoaded}
        />
      </div>

      {/* Frame info */}
      <div className="flex items-center gap-2 min-w-[200px] justify-end">
        <span className="text-sm text-muted-foreground tabular-nums">
          {state.frameIndex} / {Math.max(0, totalPlayable - 1)}
        </span>
        {currentLabel && (
          <Badge variant="secondary" className="text-xs">
            {currentLabel}
          </Badge>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-6 bg-border mx-2" />

      {/* Undo/Redo */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleUndo}
              disabled={state.undoStack.length === 0}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Undo
            {state.undoStack.length > 0 &&
              ` (${state.undoStack[state.undoStack.length - 1].description})`}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRedo}
              disabled={state.redoStack.length === 0}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            Redo
            {state.redoStack.length > 0 &&
              ` (${state.redoStack[state.redoStack.length - 1].description})`}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
