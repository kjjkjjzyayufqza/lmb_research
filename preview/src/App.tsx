import React, { useReducer, useRef, useCallback, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FolderOpen } from "lucide-react";
import { Stage } from "@/components/Stage";
import { TimelineBar } from "@/components/TimelineBar";
import { Inspector } from "@/components/Inspector";
import {
  EditorContext,
  editorReducer,
  initialEditorState,
} from "@/lib/editor/state";
import type { LmbJson } from "@/lib/lmb/types";
import { ResourceStore } from "@/lib/lmb/store";
import { Scene } from "@/lib/lmb/scene";
import { TimelinePlayer } from "@/lib/lmb/player";
import { WebGlRenderer } from "@/lib/render/webgl";

function App() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const rendererRef = useRef<WebGlRenderer | null>(null);
  const playerRef = useRef<TimelinePlayer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep forceVisible available to the playback callback via a ref
  const forceVisibleRef = useRef(state.forceVisible);
  useEffect(() => {
    forceVisibleRef.current = state.forceVisible;
  }, [state.forceVisible]);

  const handleRendererReady = useCallback((renderer: WebGlRenderer) => {
    rendererRef.current = renderer;
  }, []);

  /**
   * Render the current scene to the WebGL canvas.
   */
  const renderCurrentScene = useCallback(() => {
    const player = playerRef.current;
    const renderer = rendererRef.current;
    if (!player || !renderer) return;

    const scene = player.getScene();
    const instances = scene.getInstancesSorted();
    renderer.clear();
    renderer.renderScene(instances, state.forceVisible);

    const frame = player.getCurrentFrame();
    dispatch({
      type: "UPDATE_DISPLAY",
      instances,
      frameIndex: player.getCurrentFrameIndex(),
      frame: frame ?? null,
    });
  }, [state.forceVisible]);

  /**
   * Initialize the timeline player for a given sprite.
   */
  const attachTimeline = useCallback(
    (spriteId: number, store: ResourceStore) => {
      // Stop old player
      playerRef.current?.pause();

      const sprite = store.getSpriteById(spriteId);
      if (!sprite) return;

      const scene = new Scene();
      const player = new TimelinePlayer(
        store,
        sprite,
        scene,
        (_frame, scn, frameIndex) => {
          // Playback frame callback — forceVisible is read from
          // the latest state snapshot via the closure over stateRef.
          const renderer = rendererRef.current;
          if (!renderer) return;
          const instances = scn.getInstancesSorted();
          renderer.clear();
          renderer.renderScene(instances, forceVisibleRef.current);
          dispatch({
            type: "UPDATE_DISPLAY",
            instances,
            frameIndex,
            frame: _frame ?? null,
          });
        },
        (msg) => console.log(`[LMB] ${msg}`)
      );

      playerRef.current = player;
      dispatch({ type: "SET_RUNTIME", scene, player });

      // Apply initial frame
      if (sprite.timeline.length > 0) {
        scene.applyFrame(store, sprite.timeline[0]);
        const renderer = rendererRef.current;
        if (renderer) {
          const instances = scene.getInstancesSorted();
          renderer.clear();
          renderer.renderScene(instances, forceVisibleRef.current);
          dispatch({
            type: "UPDATE_DISPLAY",
            instances,
            frameIndex: 0,
            frame: sprite.timeline[0],
          });
        }
      }
    },
    []
  );

  /**
   * Handle JSON file loading.
   */
  const handleFileSelected = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const json = JSON.parse(text) as LmbJson;

        dispatch({ type: "LOAD_JSON", json });

        const store = new ResourceStore(json);

        const renderer = rendererRef.current;
        if (renderer) {
          renderer.resizeForMeta(json.meta);
          renderer.clear();
          // Load textures from the same directory as the JSON file
          await renderer.loadAtlasTextures(json, store, "textures/");
        }

        attachTimeline(json.timeline.rootSpriteId, store);
      } catch (e) {
        console.error("Error loading file:", e);
      }
    },
    [attachTimeline]
  );

  const handleRootSpriteChange = useCallback(
    (spriteIdStr: string) => {
      const spriteId = Number(spriteIdStr);
      dispatch({ type: "SET_ROOT_SPRITE", spriteId });
      if (state.resourceStore) {
        attachTimeline(spriteId, state.resourceStore);
      }
    },
    [state.resourceStore, attachTimeline]
  );

  const sprites = state.json?.definitions.sprites ?? [];

  return (
    <EditorContext.Provider value={{ state, dispatch }}>
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-col h-screen w-screen bg-background text-foreground">
          {/* Header */}
          <header className="flex items-center gap-3 px-4 py-2 bg-card border-b border-border">
            <h1 className="text-sm font-semibold whitespace-nowrap">
              LMB Editor
            </h1>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              Open JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelected(f);
                e.target.value = "";
              }}
            />

            {sprites.length > 0 && (
              <Select
                value={String(state.rootSpriteId)}
                onValueChange={handleRootSpriteChange}
              >
                <SelectTrigger className="w-[200px] h-8 text-xs">
                  <SelectValue placeholder="Select sprite..." />
                </SelectTrigger>
                <SelectContent>
                  {sprites.map((s) => (
                    <SelectItem
                      key={s.characterId}
                      value={String(s.characterId)}
                    >
                      {s.name || `Sprite ${s.characterId}`} (
                      {s.timeline.length}f)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex-1" />

            {state.json && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {state.json.meta.width}x{state.json.meta.height}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {state.json.meta.framerate}fps
                </Badge>
                {state.dirty && (
                  <Badge variant="destructive" className="text-xs">
                    Modified
                  </Badge>
                )}
              </div>
            )}
          </header>

          {/* Main area: Stage + Inspector */}
          <div className="flex flex-1 overflow-hidden">
            <Stage onRendererReady={handleRendererReady} />
            <Inspector playerRef={playerRef} onRender={renderCurrentScene} />
          </div>

          {/* Timeline bar */}
          <TimelineBar playerRef={playerRef} onRender={renderCurrentScene} />
        </div>
      </TooltipProvider>
    </EditorContext.Provider>
  );
}

export default App;
