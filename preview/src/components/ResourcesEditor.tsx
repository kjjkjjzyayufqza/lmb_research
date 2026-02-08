import React, { useCallback, useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEditorState, useEditorCommand } from "@/lib/editor/state";
import type { TimelinePlayer } from "@/lib/lmb/player";

interface ResourcesEditorProps {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}

/**
 * ResourcesEditor: inline-edit resource tables (colors, transforms,
 * positions, bounds, textureAtlases, symbols).
 */
export function ResourcesEditor({ playerRef, onRender }: ResourcesEditorProps) {
  const state = useEditorState();
  const [subTab, setSubTab] = useState("colors");

  if (!state.json) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        Load a JSON file to view resources.
      </div>
    );
  }

  const res = state.json.resources;

  return (
    <Tabs value={subTab} onValueChange={setSubTab} className="flex flex-col h-full">
      <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-1">
        <TabsTrigger value="colors" className="text-[10px]">
          Colors ({res.colors.length})
        </TabsTrigger>
        <TabsTrigger value="transforms" className="text-[10px]">
          Transforms ({res.transforms.length})
        </TabsTrigger>
        <TabsTrigger value="positions" className="text-[10px]">
          Positions ({res.positions.length})
        </TabsTrigger>
        <TabsTrigger value="bounds" className="text-[10px]">
          Bounds ({res.bounds.length})
        </TabsTrigger>
        <TabsTrigger value="atlases" className="text-[10px]">
          Atlases ({res.textureAtlases.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="colors" className="flex-1 overflow-hidden mt-0">
        <ColorsTable playerRef={playerRef} onRender={onRender} />
      </TabsContent>
      <TabsContent value="transforms" className="flex-1 overflow-hidden mt-0">
        <TransformsTable playerRef={playerRef} onRender={onRender} />
      </TabsContent>
      <TabsContent value="positions" className="flex-1 overflow-hidden mt-0">
        <PositionsTable playerRef={playerRef} onRender={onRender} />
      </TabsContent>
      <TabsContent value="bounds" className="flex-1 overflow-hidden mt-0">
        <BoundsTable playerRef={playerRef} onRender={onRender} />
      </TabsContent>
      <TabsContent value="atlases" className="flex-1 overflow-hidden mt-0">
        <AtlasesTable />
      </TabsContent>
    </Tabs>
  );
}

// ============================================================
// Virtual-scroll-lite: only render visible range
// ============================================================

const ROW_HEIGHT = 32;
const OVERSCAN = 5;

function useVirtualList<T>(items: T[], containerHeight: number) {
  const [scrollTop, setScrollTop] = useState(0);
  const totalHeight = items.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + OVERSCAN
  );
  const visibleItems = items.slice(startIndex, endIndex);
  return { totalHeight, startIndex, visibleItems, setScrollTop };
}

// ============================================================
// Colors
// ============================================================

function ColorsTable({
  playerRef,
  onRender,
}: {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}) {
  const state = useEditorState();
  const executeCmd = useEditorCommand();
  const colors = state.json?.resources.colors ?? [];
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    if (!filter) return colors.map((c, i) => ({ ...c, _index: i }));
    return colors
      .map((c, i) => ({ ...c, _index: i }))
      .filter((_, i) => String(i).includes(filter));
  }, [colors, filter]);

  const handleUpdate = useCallback(
    (index: number, field: string, value: number) => {
      executeCmd({
        type: "UPDATE_COLOR",
        index,
        patch: { [field]: value },
      });
      playerRef.current?.scrubToFrame(state.frameIndex);
      onRender();
    },
    [executeCmd, playerRef, state.frameIndex, onRender]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-2 py-1">
        <Input
          placeholder="Filter by index..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-7 text-xs"
        />
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 space-y-px">
          {filtered.slice(0, 200).map((c) => (
            <div
              key={c._index}
              className="flex items-center gap-1 text-xs py-0.5"
            >
              <span className="w-8 text-muted-foreground text-right font-mono">
                {c._index}
              </span>
              <div
                className="w-5 h-5 rounded border border-border"
                style={{
                  backgroundColor: `rgba(${Math.min(255, c.r)}, ${Math.min(255, c.g)}, ${Math.min(255, c.b)}, ${Math.min(255, c.a) / 255})`,
                }}
              />
              <InlineNumberInput
                value={c.r}
                onCommit={(v) => handleUpdate(c._index, "r", v)}
                className="w-12"
              />
              <InlineNumberInput
                value={c.g}
                onCommit={(v) => handleUpdate(c._index, "g", v)}
                className="w-12"
              />
              <InlineNumberInput
                value={c.b}
                onCommit={(v) => handleUpdate(c._index, "b", v)}
                className="w-12"
              />
              <InlineNumberInput
                value={c.a}
                onCommit={(v) => handleUpdate(c._index, "a", v)}
                className="w-12"
              />
            </div>
          ))}
          {filtered.length > 200 && (
            <div className="text-xs text-muted-foreground py-2 text-center">
              Showing 200 of {filtered.length}. Use filter to narrow.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================
// Transforms
// ============================================================

function TransformsTable({
  playerRef,
  onRender,
}: {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}) {
  const state = useEditorState();
  const executeCmd = useEditorCommand();
  const transforms = state.json?.resources.transforms ?? [];

  const handleUpdate = useCallback(
    (index: number, field: string, value: number) => {
      executeCmd({
        type: "UPDATE_TRANSFORM",
        index,
        patch: { [field]: value },
      });
      playerRef.current?.scrubToFrame(state.frameIndex);
      onRender();
    },
    [executeCmd, playerRef, state.frameIndex, onRender]
  );

  return (
    <ScrollArea className="h-full">
      <div className="px-2 space-y-px">
        {transforms.slice(0, 200).map((t, i) => (
          <div key={i} className="flex items-center gap-1 text-xs py-0.5">
            <span className="w-8 text-muted-foreground text-right font-mono">
              {i}
            </span>
            {(["a", "b", "c", "d", "x", "y"] as const).map((f) => (
              <InlineNumberInput
                key={f}
                value={t[f]}
                onCommit={(v) => handleUpdate(i, f, v)}
                className="w-14"
                step={f === "x" || f === "y" ? 1 : 0.01}
              />
            ))}
          </div>
        ))}
        {transforms.length > 200 && (
          <div className="text-xs text-muted-foreground py-2 text-center">
            Showing 200 of {transforms.length}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ============================================================
// Positions
// ============================================================

function PositionsTable({
  playerRef,
  onRender,
}: {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}) {
  const state = useEditorState();
  const executeCmd = useEditorCommand();
  const positions = state.json?.resources.positions ?? [];

  const handleUpdate = useCallback(
    (index: number, field: string, value: number) => {
      executeCmd({
        type: "UPDATE_POSITION",
        index,
        patch: { [field]: value },
      });
      playerRef.current?.scrubToFrame(state.frameIndex);
      onRender();
    },
    [executeCmd, playerRef, state.frameIndex, onRender]
  );

  return (
    <ScrollArea className="h-full">
      <div className="px-2 space-y-px">
        {positions.slice(0, 300).map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-xs py-0.5">
            <span className="w-8 text-muted-foreground text-right font-mono">
              {i}
            </span>
            <Label className="text-[10px] text-muted-foreground">X</Label>
            <InlineNumberInput
              value={p.x}
              onCommit={(v) => handleUpdate(i, "x", v)}
              className="w-20"
            />
            <Label className="text-[10px] text-muted-foreground">Y</Label>
            <InlineNumberInput
              value={p.y}
              onCommit={(v) => handleUpdate(i, "y", v)}
              className="w-20"
            />
          </div>
        ))}
        {positions.length > 300 && (
          <div className="text-xs text-muted-foreground py-2 text-center">
            Showing 300 of {positions.length}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

// ============================================================
// Bounds
// ============================================================

function BoundsTable({
  playerRef,
  onRender,
}: {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}) {
  const state = useEditorState();
  const executeCmd = useEditorCommand();
  const bounds = state.json?.resources.bounds ?? [];

  const handleUpdate = useCallback(
    (index: number, field: string, value: number) => {
      executeCmd({
        type: "UPDATE_BOUNDS",
        index,
        patch: { [field]: value },
      });
      playerRef.current?.scrubToFrame(state.frameIndex);
      onRender();
    },
    [executeCmd, playerRef, state.frameIndex, onRender]
  );

  return (
    <ScrollArea className="h-full">
      <div className="px-2 space-y-px">
        {bounds.map((b, i) => (
          <div key={i} className="flex items-center gap-1 text-xs py-0.5">
            <span className="w-8 text-muted-foreground text-right font-mono">
              {b.id}
            </span>
            {(["x", "y", "width", "height"] as const).map((f) => (
              <InlineNumberInput
                key={f}
                value={b[f]}
                onCommit={(v) => handleUpdate(i, f, v)}
                className="w-16"
              />
            ))}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============================================================
// Atlases (read-only display)
// ============================================================

function AtlasesTable() {
  const state = useEditorState();
  const atlases = state.json?.resources.textureAtlases ?? [];

  return (
    <ScrollArea className="h-full">
      <div className="px-2 space-y-1">
        {atlases.map((atlas) => (
          <div
            key={atlas.id}
            className="flex items-center gap-2 text-xs py-1 px-1 bg-muted rounded"
          >
            <Badge variant="outline" className="text-[10px]">
              #{atlas.id}
            </Badge>
            <span className="font-mono">{atlas.name || `Atlas ${atlas.id}`}</span>
            <span className="text-muted-foreground">
              {atlas.width}x{atlas.height}
            </span>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

// ============================================================
// Inline number input
// ============================================================

function InlineNumberInput({
  value,
  onCommit,
  className = "",
  step = 1,
}: {
  value: number;
  onCommit: (v: number) => void;
  className?: string;
  step?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState("");

  const displayValue =
    Number.isInteger(value) ? String(value) : value.toFixed(2);

  const handleCommit = () => {
    setEditing(false);
    const parsed = Number(localValue);
    if (!isNaN(parsed) && parsed !== value) {
      onCommit(parsed);
    }
  };

  if (editing) {
    return (
      <Input
        type="number"
        step={step}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCommit();
          if (e.key === "Escape") setEditing(false);
        }}
        className={`h-6 text-xs px-1 ${className}`}
        autoFocus
      />
    );
  }

  return (
    <span
      className={`font-mono cursor-pointer hover:bg-accent rounded px-1 ${className}`}
      onClick={() => {
        setLocalValue(String(value));
        setEditing(true);
      }}
    >
      {displayValue}
    </span>
  );
}
