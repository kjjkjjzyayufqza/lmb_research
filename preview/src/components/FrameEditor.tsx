import React, { useCallback, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useEditorState, useEditorCommand } from "@/lib/editor/state";
import type { PlaceObjectAction, RemoveObjectAction, DoAction } from "@/lib/lmb/types";
import type { TimelinePlayer } from "@/lib/lmb/player";

interface FrameEditorProps {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}

/**
 * FrameEditor: edit the current frame's displayList, removeList, and actions.
 */
export function FrameEditor({ playerRef, onRender }: FrameEditorProps) {
  const state = useEditorState();
  const executeCmd = useEditorCommand();
  const frame = state.currentFrame;
  const spriteId = state.currentSprite?.characterId;

  if (!frame || spriteId === undefined) {
    return (
      <div className="p-3 text-sm text-muted-foreground">
        No frame selected. Load a JSON file first.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">
            Frame {frame.frameIndex}
            {frame.isKeyframe && (
              <Badge variant="secondary" className="ml-2 text-[10px]">
                Keyframe
              </Badge>
            )}
            {frame.label && (
              <Badge variant="outline" className="ml-1 text-[10px]">
                {frame.label}
              </Badge>
            )}
          </h3>
        </div>

        {/* Display List */}
        <DisplayListSection
          displayList={frame.displayList}
          spriteId={spriteId}
          frameIndex={frame.frameIndex}
          executeCmd={executeCmd}
          playerRef={playerRef}
          onRender={onRender}
        />

        <Separator />

        {/* Remove List */}
        <RemoveListSection
          removeList={frame.removeList}
          spriteId={spriteId}
          frameIndex={frame.frameIndex}
          executeCmd={executeCmd}
          playerRef={playerRef}
          onRender={onRender}
        />

        <Separator />

        {/* Actions */}
        <ActionsSection
          actions={frame.actions}
          spriteId={spriteId}
          frameIndex={frame.frameIndex}
          executeCmd={executeCmd}
          playerRef={playerRef}
          onRender={onRender}
        />
      </div>
    </ScrollArea>
  );
}

interface SectionProps {
  spriteId: number;
  frameIndex: number;
  executeCmd: (cmd: import("@/lib/editor/commands").EditorCommand) => void;
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}

function DisplayListSection({
  displayList,
  spriteId,
  frameIndex,
  executeCmd,
  playerRef,
  onRender,
}: SectionProps & { displayList: PlaceObjectAction[] }) {
  const handleDelete = useCallback(
    (index: number) => {
      executeCmd({
        type: "DELETE_PLACE_OBJECT",
        spriteCharacterId: spriteId,
        frameIndex,
        placeIndex: index,
      });
      playerRef.current?.scrubToFrame(frameIndex);
      onRender();
    },
    [executeCmd, spriteId, frameIndex, playerRef, onRender]
  );

  const handleAdd = useCallback(() => {
    const newPo: PlaceObjectAction = {
      type: "placeObject",
      characterId: 0,
      placementId: 0,
      depth: 0,
      nameId: -1,
      placementMode: "PLACE",
      blendMode: "NORMAL",
      positionId: -1,
      positionFlags: 0xffff,
      colorMultId: -1,
      colorAddId: -1,
      hasColorMatrix: false,
      hasUnknownF014: false,
    };
    executeCmd({
      type: "INSERT_PLACE_OBJECT",
      spriteCharacterId: spriteId,
      frameIndex,
      placeObject: newPo,
    });
    playerRef.current?.scrubToFrame(frameIndex);
    onRender();
  }, [executeCmd, spriteId, frameIndex, playerRef, onRender]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Display List ({displayList.length})
        </h4>
        <Button variant="ghost" size="icon-sm" onClick={handleAdd}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-1">
        {displayList.map((po, i) => (
          <PlaceObjectRow
            key={i}
            po={po}
            index={i}
            onDelete={() => handleDelete(i)}
            spriteId={spriteId}
            frameIndex={frameIndex}
            executeCmd={executeCmd}
            playerRef={playerRef}
            onRender={onRender}
          />
        ))}
      </div>
    </div>
  );
}

function PlaceObjectRow({
  po,
  index,
  onDelete,
  spriteId,
  frameIndex,
  executeCmd,
  playerRef,
  onRender,
}: {
  po: PlaceObjectAction;
  index: number;
  onDelete: () => void;
  spriteId: number;
  frameIndex: number;
  executeCmd: (cmd: import("@/lib/editor/commands").EditorCommand) => void;
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleFieldChange = useCallback(
    (field: string, value: number | string) => {
      executeCmd({
        type: "UPDATE_PLACE_OBJECT",
        spriteCharacterId: spriteId,
        frameIndex,
        placeIndex: index,
        patch: { [field]: value } as Partial<PlaceObjectAction>,
      });
      playerRef.current?.scrubToFrame(frameIndex);
      onRender();
    },
    [executeCmd, spriteId, frameIndex, index, playerRef, onRender]
  );

  return (
    <Card className="p-0">
      <div
        className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-muted rounded-t"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-xs">
          <Badge
            variant={po.placementMode === "PLACE" || po.placementMode === "place" ? "default" : "secondary"}
            className="text-[10px] px-1 py-0"
          >
            {po.placementMode}
          </Badge>
          <span className="font-mono">D:{po.depth}</span>
          <span className="text-muted-foreground">char:{po.characterId}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-6 w-6"
        >
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
      {expanded && (
        <div className="px-2 pb-2 pt-1 space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <EditableField
              label="characterId"
              value={po.characterId}
              onChange={(v) => handleFieldChange("characterId", v)}
              type="number"
            />
            <EditableField
              label="depth"
              value={po.depth}
              onChange={(v) => handleFieldChange("depth", v)}
              type="number"
            />
            <EditableField
              label="positionId"
              value={po.positionId}
              onChange={(v) => handleFieldChange("positionId", v)}
              type="number"
            />
            <EditableField
              label="colorMultId"
              value={po.colorMultId}
              onChange={(v) => handleFieldChange("colorMultId", v)}
              type="number"
            />
            <EditableField
              label="colorAddId"
              value={po.colorAddId}
              onChange={(v) => handleFieldChange("colorAddId", v)}
              type="number"
            />
            <EditableField
              label="blendMode"
              value={po.blendMode}
              onChange={(v) => handleFieldChange("blendMode", String(v))}
              type="text"
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function RemoveListSection({
  removeList,
  spriteId,
  frameIndex,
  executeCmd,
  playerRef,
  onRender,
}: SectionProps & { removeList: RemoveObjectAction[] }) {
  const handleDelete = useCallback(
    (index: number) => {
      executeCmd({
        type: "DELETE_REMOVE_OBJECT",
        spriteCharacterId: spriteId,
        frameIndex,
        removeIndex: index,
      });
      playerRef.current?.scrubToFrame(frameIndex);
      onRender();
    },
    [executeCmd, spriteId, frameIndex, playerRef, onRender]
  );

  const handleAdd = useCallback(() => {
    executeCmd({
      type: "INSERT_REMOVE_OBJECT",
      spriteCharacterId: spriteId,
      frameIndex,
      removeObject: { type: "removeObject", depth: 0 },
    });
    playerRef.current?.scrubToFrame(frameIndex);
    onRender();
  }, [executeCmd, spriteId, frameIndex, playerRef, onRender]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Remove List ({removeList.length})
        </h4>
        <Button variant="ghost" size="icon-sm" onClick={handleAdd}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-1">
        {removeList.map((rem, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-2 py-1 bg-muted rounded text-xs"
          >
            <span className="font-mono">Remove depth: {rem.depth}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDelete(i)}
              className="h-6 w-6"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionsSection({
  actions,
  spriteId,
  frameIndex,
  executeCmd,
  playerRef,
  onRender,
}: SectionProps & { actions: DoAction[] }) {
  const handleDelete = useCallback(
    (index: number) => {
      executeCmd({
        type: "DELETE_ACTION",
        spriteCharacterId: spriteId,
        frameIndex,
        actionIndex: index,
      });
      playerRef.current?.scrubToFrame(frameIndex);
      onRender();
    },
    [executeCmd, spriteId, frameIndex, playerRef, onRender]
  );

  const handleAdd = useCallback(() => {
    executeCmd({
      type: "INSERT_ACTION",
      spriteCharacterId: spriteId,
      frameIndex,
      action: { type: "doAction", actionId: 0 },
    });
    playerRef.current?.scrubToFrame(frameIndex);
    onRender();
  }, [executeCmd, spriteId, frameIndex, playerRef, onRender]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Actions ({actions.length})
        </h4>
        <Button variant="ghost" size="icon-sm" onClick={handleAdd}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-1">
        {actions.map((action, i) => (
          <div
            key={i}
            className="flex items-center justify-between px-2 py-1 bg-muted rounded text-xs"
          >
            <span className="font-mono">Action ID: {action.actionId}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleDelete(i)}
              className="h-6 w-6"
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  type,
}: {
  label: string;
  value: number | string;
  onChange: (v: number | string) => void;
  type: "number" | "text";
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));

  const handleCommit = () => {
    setEditing(false);
    const newVal = type === "number" ? Number(localValue) : localValue;
    if (newVal !== value) {
      onChange(newVal);
    }
  };

  if (editing) {
    return (
      <div>
        <Label className="text-[10px] text-muted-foreground">{label}</Label>
        <Input
          type={type}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCommit();
            if (e.key === "Escape") {
              setLocalValue(String(value));
              setEditing(false);
            }
          }}
          className="h-6 text-xs px-1"
          autoFocus
        />
      </div>
    );
  }

  return (
    <div
      className="cursor-pointer hover:bg-accent rounded px-1"
      onClick={() => {
        setLocalValue(String(value));
        setEditing(true);
      }}
    >
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="text-xs font-mono">{value}</div>
    </div>
  );
}
