import React, { useCallback, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useEditorState, useEditorDispatch, useEditorCommand } from "@/lib/editor/state";
import type { DisplayInstance, PlaceObjectAction } from "@/lib/lmb/types";
import { FrameEditor } from "./FrameEditor";
import { ResourcesEditor } from "./ResourcesEditor";
import { ExportPanel } from "./ExportPanel";
import type { TimelinePlayer } from "@/lib/lmb/player";

interface InspectorProps {
  playerRef: React.RefObject<TimelinePlayer | null>;
  onRender: () => void;
}

/**
 * Inspector panel: tabbed interface for instance properties,
 * frame editing, resource editing, and export.
 */
export function Inspector({ playerRef, onRender }: InspectorProps) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();

  return (
    <div className="w-[360px] min-w-[320px] border-l border-border bg-card flex flex-col">
      <Tabs
        value={state.selectedTab}
        onValueChange={(v) =>
          dispatch({
            type: "SELECT_TAB",
            tab: v as typeof state.selectedTab,
          })
        }
        className="flex flex-col flex-1 overflow-hidden"
      >
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-2">
          <TabsTrigger value="instance" className="text-xs">
            Instances
          </TabsTrigger>
          <TabsTrigger value="frame" className="text-xs">
            Frame
          </TabsTrigger>
          <TabsTrigger value="resources" className="text-xs">
            Resources
          </TabsTrigger>
          <TabsTrigger value="export" className="text-xs">
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instance" className="flex-1 overflow-hidden mt-0">
          <InstanceTab />
        </TabsContent>

        <TabsContent value="frame" className="flex-1 overflow-hidden mt-0">
          <FrameEditor playerRef={playerRef} onRender={onRender} />
        </TabsContent>

        <TabsContent value="resources" className="flex-1 overflow-hidden mt-0">
          <ResourcesEditor playerRef={playerRef} onRender={onRender} />
        </TabsContent>

        <TabsContent value="export" className="flex-1 overflow-hidden mt-0">
          <ExportPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Instance tab: shows all instances in the current scene sorted by depth,
 * and allows editing the selected instance's properties.
 */
function InstanceTab() {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const executeCmd = useEditorCommand();

  const instances = state.displayInstances;
  const selectedPlacementId = state.selectedPlacementId;

  const selectedInstance = selectedPlacementId !== null
    ? instances.find((i) => i.placementId === selectedPlacementId)
    : null;

  // Find the PlaceObjectAction for the selected instance (if in the current frame)
  const selectedPlaceObject = selectedInstance && state.currentFrame
    ? state.currentFrame.displayList.find(
        (po) => po.depth === selectedInstance.depth
      )
    : null;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        <div>
          <h3 className="text-sm font-semibold mb-2">
            Display List ({instances.length} instances)
          </h3>
          <div className="space-y-1">
            {instances.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No instances in current scene
              </p>
            )}
            {instances.map((inst, idx) => (
              <InstanceRow
                key={`${inst.depth}-${idx}`}
                instance={inst}
                isSelected={inst.placementId === selectedPlacementId}
                onClick={() =>
                  dispatch({
                    type: "SELECT_INSTANCE",
                    placementId:
                      inst.placementId === selectedPlacementId ? null : inst.placementId,
                  })
                }
              />
            ))}
          </div>
        </div>

        {selectedInstance && (
          <>
            <Separator />
            <InstanceDetails
              instance={selectedInstance}
              placeObject={selectedPlaceObject ?? undefined}
            />
          </>
        )}
      </div>
    </ScrollArea>
  );
}

interface InstanceRowProps {
  instance: DisplayInstance;
  isSelected: boolean;
  onClick: () => void;
}

function InstanceRow({ instance, isSelected, onClick }: InstanceRowProps) {
  const typeBadge = instance.graphic
    ? "graphic"
    : instance.text
    ? "text"
    : "sprite";

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded-sm text-xs transition-colors ${
        isSelected
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono">D:{instance.depth}</span>
        <span className="text-muted-foreground">
          char:{instance.characterId}
        </span>
        <Badge variant="outline" className="text-[10px] px-1 py-0">
          {typeBadge}
        </Badge>
        <span className="text-muted-foreground">
          {instance.blendMode !== "NORMAL" &&
            instance.blendMode !== "normal" &&
            instance.blendMode}
        </span>
      </div>
    </button>
  );
}

interface InstanceDetailsProps {
  instance: DisplayInstance;
  placeObject?: PlaceObjectAction;
}

function InstanceDetails({ instance, placeObject }: InstanceDetailsProps) {
  const t = instance.transform;
  const cm = instance.colorMult;
  const ca = instance.colorAdd;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Selected Instance</h3>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <Label className="text-xs text-muted-foreground">Depth</Label>
          <div className="font-mono">{instance.depth}</div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Character ID</Label>
          <div className="font-mono">{instance.characterId}</div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Placement ID</Label>
          <div className="font-mono">{instance.placementId}</div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Blend Mode</Label>
          <div className="font-mono">{instance.blendMode}</div>
        </div>
      </div>

      <Separator />

      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">
          Transform Matrix
        </Label>
        <div className="grid grid-cols-3 gap-1 text-xs font-mono bg-muted p-2 rounded">
          <div>a: {t.a.toFixed(3)}</div>
          <div>c: {t.c.toFixed(3)}</div>
          <div>x: {t.x.toFixed(1)}</div>
          <div>b: {t.b.toFixed(3)}</div>
          <div>d: {t.d.toFixed(3)}</div>
          <div>y: {t.y.toFixed(1)}</div>
        </div>
      </div>

      {cm && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">
            Color Multiply
          </Label>
          <div className="flex gap-2 text-xs font-mono">
            <ColorChannel label="R" value={cm.r} />
            <ColorChannel label="G" value={cm.g} />
            <ColorChannel label="B" value={cm.b} />
            <ColorChannel label="A" value={cm.a} />
          </div>
        </div>
      )}

      {ca && (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">
            Color Add
          </Label>
          <div className="flex gap-2 text-xs font-mono">
            <ColorChannel label="R" value={ca.r} />
            <ColorChannel label="G" value={ca.g} />
            <ColorChannel label="B" value={ca.b} />
            <ColorChannel label="A" value={ca.a} />
          </div>
        </div>
      )}

      {placeObject && (
        <>
          <Separator />
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">
              Placement Info (from current frame)
            </Label>
            <div className="grid grid-cols-2 gap-1 text-xs font-mono">
              <div>Mode: {placeObject.placementMode}</div>
              <div>NameId: {placeObject.nameId}</div>
              <div>PosId: {placeObject.positionId}</div>
              <div>PosFlags: 0x{placeObject.positionFlags.toString(16)}</div>
              <div>MultId: {placeObject.colorMultId}</div>
              <div>AddId: {placeObject.colorAddId}</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ColorChannel({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center bg-muted px-2 py-1 rounded">
      <span className="text-muted-foreground text-[10px]">{label}</span>
      <span>{value}</span>
    </div>
  );
}
