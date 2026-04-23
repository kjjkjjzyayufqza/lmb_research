import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  CornerDownLeft,
  X,
  Gamepad2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditorState } from "@/lib/editor/state";
import type { TimelinePlayer } from "@/lib/lmb/player";
import type { SpriteDef } from "@/lib/lmb/types";

interface GameControlPanelProps {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}

interface LabelGroup {
  name: string;
  labels: { label: string; frameIdx: number; hasFocus: boolean }[];
}

function groupLabels(sprite: SpriteDef): LabelGroup[] {
  const entries = Object.entries(sprite.frameLabels).sort(
    (a, b) => a[1] - b[1]
  );
  if (entries.length === 0) return [];

  const mainLabels: LabelGroup["labels"] = [];
  const subLabels: LabelGroup["labels"] = [];
  const otherLabels: LabelGroup["labels"] = [];

  const focusSet = new Set(
    entries.filter(([l]) => l.endsWith("_FOCUS")).map(([l]) => l)
  );

  for (const [label, frameIdx] of entries) {
    if (label.endsWith("_FOCUS")) continue;

    const hasFocus = focusSet.has(`${label}_FOCUS`);

    if (label.startsWith("LM_MENU_MAIN_")) {
      mainLabels.push({
        label,
        frameIdx,
        hasFocus,
      });
    } else if (label.startsWith("LM_MENU_SUB_")) {
      subLabels.push({ label, frameIdx, hasFocus });
    } else {
      otherLabels.push({ label, frameIdx, hasFocus });
    }
  }

  const groups: LabelGroup[] = [];
  if (mainLabels.length > 0) groups.push({ name: "Main Menu", labels: mainLabels });
  if (subLabels.length > 0) groups.push({ name: "Sub Menu", labels: subLabels });
  if (otherLabels.length > 0) groups.push({ name: "Animation", labels: otherLabels });
  return groups;
}

function getShortLabel(label: string): string {
  return label
    .replace("LM_MENU_MAIN_", "")
    .replace("LM_MENU_SUB_", "")
    .replace(/_/g, " ");
}

export function GameControlPanel({ playerRef, onRender }: GameControlPanelProps) {
  const state = useEditorState();
  const [selectedSpriteId, setSelectedSpriteId] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [activeGroup, setActiveGroup] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const sprites = state.json?.definitions.sprites ?? [];
  const scene = state.scene;
  const resourceStore = state.resourceStore;

  const labeledSprites = useMemo(
    () => sprites.filter((s) => Object.keys(s.frameLabels).length > 0),
    [sprites]
  );

  const currentSprite = useMemo(
    () =>
      selectedSpriteId !== null
        ? labeledSprites.find((s) => s.characterId === selectedSpriteId)
        : labeledSprites[0],
    [selectedSpriteId, labeledSprites]
  );

  const labelGroups = useMemo(
    () => (currentSprite ? groupLabels(currentSprite) : []),
    [currentSprite]
  );

  const currentGroup = labelGroups[activeGroup] ?? labelGroups[0];
  const currentLabels = currentGroup?.labels ?? [];

  const addLog = useCallback((msg: string) => {
    setLogMessages((prev) => [...prev.slice(-19), msg]);
  }, []);

  const triggerLabel = useCallback(
    (label: string, andPlay: boolean = true) => {
      if (!scene || !resourceStore || !currentSprite) return;

      const nested = scene.getNestedSpriteTree();
      let found = false;

      const findAndExecute = (nodes: typeof nested): boolean => {
        for (const node of nodes) {
          if (node.characterId === currentSprite.characterId) {
            const method = andPlay ? "gotoAndPlay" : "gotoAndStop";
            scene.executeOnNestedSprite(
              node.placementId,
              method,
              label,
              resourceStore
            );
            addLog(`${method}("${label}") on Sprite ${node.characterId}`);
            return true;
          }
          if (findAndExecute(node.children)) return true;
        }
        return false;
      };

      found = findAndExecute(nested);

      if (!found && currentSprite.characterId === state.currentSprite?.characterId) {
        const p = playerRef.current;
        if (p) {
          const targetFrame = currentSprite.frameLabels[label];
          if (targetFrame !== undefined) {
            if (andPlay) {
              p.scrubToFrame(targetFrame);
              p.play();
            } else {
              p.scrubToFrame(targetFrame);
            }
            addLog(`Root: ${andPlay ? "gotoAndPlay" : "gotoAndStop"}("${label}")`);
            found = true;
          }
        }
      }

      if (!found) {
        addLog(`Label "${label}" not found in active sprites`);
      }

      onRender();
    },
    [scene, resourceStore, currentSprite, state.currentSprite, playerRef, onRender, addLog]
  );

  const navigateUp = useCallback(() => {
    if (currentLabels.length === 0) return;
    const newIdx = (focusedIndex - 1 + currentLabels.length) % currentLabels.length;
    setFocusedIndex(newIdx);
    const item = currentLabels[newIdx];
    if (item.hasFocus) {
      triggerLabel(`${item.label}_FOCUS`, true);
    }
    addLog(`↑ ${getShortLabel(item.label)}`);
  }, [focusedIndex, currentLabels, triggerLabel, addLog]);

  const navigateDown = useCallback(() => {
    if (currentLabels.length === 0) return;
    const newIdx = (focusedIndex + 1) % currentLabels.length;
    setFocusedIndex(newIdx);
    const item = currentLabels[newIdx];
    if (item.hasFocus) {
      triggerLabel(`${item.label}_FOCUS`, true);
    }
    addLog(`↓ ${getShortLabel(item.label)}`);
  }, [focusedIndex, currentLabels, triggerLabel, addLog]);

  const navigateLeft = useCallback(() => {
    if (labelGroups.length === 0) return;
    const newGroup = (activeGroup - 1 + labelGroups.length) % labelGroups.length;
    setActiveGroup(newGroup);
    setFocusedIndex(0);
    addLog(`← Group: ${labelGroups[newGroup]?.name}`);
  }, [activeGroup, labelGroups, addLog]);

  const navigateRight = useCallback(() => {
    if (labelGroups.length === 0) return;
    const newGroup = (activeGroup + 1) % labelGroups.length;
    setActiveGroup(newGroup);
    setFocusedIndex(0);
    addLog(`→ Group: ${labelGroups[newGroup]?.name}`);
  }, [activeGroup, labelGroups, addLog]);

  const confirmAction = useCallback(() => {
    if (currentLabels.length === 0) return;
    const item = currentLabels[focusedIndex];
    triggerLabel(item.label, true);
    addLog(`✓ Confirm: ${getShortLabel(item.label)}`);
  }, [currentLabels, focusedIndex, triggerLabel, addLog]);

  const cancelAction = useCallback(() => {
    const cancelLabels = ["Cancel", "End", "View_Close", "Live_Close"];
    for (const label of cancelLabels) {
      if (currentSprite?.frameLabels[label] !== undefined) {
        triggerLabel(label, true);
        addLog(`✕ Cancel: ${label}`);
        return;
      }
    }
    addLog("✕ No cancel label found");
  }, [currentSprite, triggerLabel, addLog]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowUp":
        case "w":
          e.preventDefault();
          navigateUp();
          break;
        case "ArrowDown":
        case "s":
          e.preventDefault();
          navigateDown();
          break;
        case "ArrowLeft":
        case "a":
          e.preventDefault();
          navigateLeft();
          break;
        case "ArrowRight":
        case "d":
          e.preventDefault();
          navigateRight();
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          confirmAction();
          break;
        case "Escape":
        case "Backspace":
          e.preventDefault();
          cancelAction();
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [navigateUp, navigateDown, navigateLeft, navigateRight, confirmAction, cancelAction]);

  if (!state.json || labeledSprites.length === 0) return null;

  return (
    <div className="border-t border-border bg-card">
      {/* Header */}
      <button
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        <Gamepad2 className="h-3.5 w-3.5 text-green-400" />
        <span className="font-semibold">Game Controls</span>
        <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
          ↑↓←→ Enter Esc
        </Badge>
      </button>

      {!collapsed && (
        <div className="px-3 pb-2 space-y-2">
          {/* Sprite selector + group tabs */}
          <div className="flex items-center gap-2">
            <Select
              value={String(currentSprite?.characterId ?? "")}
              onValueChange={(v) => {
                setSelectedSpriteId(Number(v));
                setActiveGroup(0);
                setFocusedIndex(0);
              }}
            >
              <SelectTrigger className="w-[180px] h-7 text-xs">
                <SelectValue placeholder="Target Sprite..." />
              </SelectTrigger>
              <SelectContent>
                {labeledSprites.map((s) => (
                  <SelectItem key={s.characterId} value={String(s.characterId)}>
                    {s.name || `Sprite ${s.characterId}`} ({Object.keys(s.frameLabels).length} labels)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {labelGroups.map((g, i) => (
              <button
                key={g.name}
                className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                  i === activeGroup
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => {
                  setActiveGroup(i);
                  setFocusedIndex(0);
                }}
              >
                {g.name}
              </button>
            ))}
          </div>

          <div className="flex gap-3">
            {/* Label list */}
            <ScrollArea className="flex-1 max-h-[120px]">
              <div className="space-y-0.5">
                {currentLabels.map((item, idx) => (
                  <button
                    key={item.label}
                    className={`flex items-center gap-2 w-full px-2 py-1 rounded text-xs transition-colors ${
                      idx === focusedIndex
                        ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-yellow-500/40"
                        : "hover:bg-muted text-muted-foreground"
                    }`}
                    onClick={() => {
                      setFocusedIndex(idx);
                      triggerLabel(item.label, true);
                    }}
                    onDoubleClick={() => {
                      triggerLabel(item.label, false);
                    }}
                  >
                    <span className="font-mono truncate">{getShortLabel(item.label)}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                      f{item.frameIdx}
                    </span>
                    {item.hasFocus && (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 text-green-400 border-green-400/30">
                        FOCUS
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>

            {/* Virtual D-pad */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="h-7 w-7"
                    onClick={navigateUp}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Up (↑/W)</TooltipContent>
              </Tooltip>
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={navigateLeft}
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Left (←/A)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      className="h-7 w-7 text-green-400"
                      onClick={confirmAction}
                    >
                      <CornerDownLeft className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Confirm (Enter/Space)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={navigateRight}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Right (→/D)</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={navigateDown}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Down (↓/S)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      className="h-7 w-7"
                      onClick={cancelAction}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Cancel (Esc)</TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Action log */}
            <div className="w-[160px] shrink-0">
              <div className="text-[10px] text-muted-foreground font-semibold mb-0.5">
                Action Log
              </div>
              <ScrollArea className="h-[100px] bg-black/30 rounded px-1.5 py-1">
                {logMessages.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/50 italic">
                    Press keys to interact...
                  </div>
                ) : (
                  logMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`text-[10px] font-mono leading-tight ${
                        i === logMessages.length - 1
                          ? "text-foreground"
                          : "text-muted-foreground/60"
                      }`}
                    >
                      {msg}
                    </div>
                  ))
                )}
              </ScrollArea>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
