import React, { useReducer, useRef, useCallback, useEffect, useState } from "react";
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
import { FolderOpen, PanelRightClose, PanelRight } from "lucide-react";
import { Stage } from "@/components/Stage";
import { TimelineBar } from "@/components/TimelineBar";
import { Inspector } from "@/components/Inspector";
import { GameControlPanel } from "@/components/GameControlPanel";
import { MachineSelectPanel } from "@/components/MachineSelectPanel";
import {
  EditorContext,
  editorReducer,
  initialEditorState,
} from "@/lib/editor/state";
import type { LmbJson, LmbTextureBinding } from "@/lib/lmb/types";
import { ResourceStore } from "@/lib/lmb/store";
import { Scene } from "@/lib/lmb/scene";
import { TimelinePlayer } from "@/lib/lmb/player";
import { WebGlRenderer } from "@/lib/render/webgl";
import { pickLmbAssetFolder } from "@/lib/lmb/folder_loader";

function App() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const rendererRef = useRef<WebGlRenderer | null>(null);
  const playerRef = useRef<TimelinePlayer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const e2eFixtureStartedRef = useRef(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  // Keep forceVisible available to the playback callback via a ref
  const forceVisibleRef = useRef(state.forceVisible);
  useEffect(() => {
    forceVisibleRef.current = state.forceVisible;
  }, [state.forceVisible]);

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

        // Auto-start nested sprites that are stopped at frame 0 with a "Start" label.
        // This mimics the C++ controller calling gotoAndPlay("Start") on initialization.
        // If ALL top-level nested sprites have "Start" (e.g. gamemode with 10 overlapping
        // modes), only start the first one to avoid visual stacking. Otherwise start all.
        const stoppedWithStart: { placementId: number }[] = [];
        const allNested = [...scene.getNestedSpriteInstances()];
        for (const nested of allNested) {
          if (nested.stopped && nested.sprite.frameLabels["Start"] !== undefined) {
            stoppedWithStart.push(nested);
          }
        }
        const allHaveStart = allNested.length > 0 &&
          stoppedWithStart.length === allNested.length;
        const toStart = allHaveStart && stoppedWithStart.length > 1
          ? [stoppedWithStart[0]]
          : stoppedWithStart;
        for (const nested of toStart) {
          scene.executeOnNestedSprite(
            nested.placementId, "gotoAndPlay", "Start", store
          );
        }

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

        // Auto-play: start playback with loop after loading
        player.setLoop(true);
        player.play();
        dispatch({ type: "SET_PLAYING", playing: true });
        dispatch({ type: "SET_LOOP", loop: true });
      }
    },
    []
  );

  const loadJsonIntoEditor = useCallback(
    async (
      json: LmbJson,
      loadTextures: (renderer: WebGlRenderer, store: ResourceStore) => Promise<void>
    ) => {
      dispatch({ type: "LOAD_JSON", json });
      const store = new ResourceStore(json);
      const renderer = rendererRef.current;
      if (renderer) {
        renderer.resizeForMeta(json.meta);
        renderer.clear();
        await loadTextures(renderer, store);
      }
      attachTimeline(json.timeline.rootSpriteId, store);
    },
    [attachTimeline]
  );

  const handleRendererReady = useCallback(
    (renderer: WebGlRenderer) => {
      rendererRef.current = renderer;

      if (!import.meta.env.DEV || e2eFixtureStartedRef.current) return;

      const params = new URLSearchParams(window.location.search);

      const FIXTURE_MAP: Record<string, { base: string; jsonName: string }> = {
        lm_menu: { base: "/lm_menu_dev", jsonName: "lm_menu.json" },
        staffroll: { base: "/staffroll_dev", jsonName: "staffroll.json" },
        machineselect: { base: "/machineselect_dev", jsonName: "machineselect.json" },
        gamemode: { base: "/gamemode_dev", jsonName: "gamemode.json" },
        gameover: { base: "/gameover_dev", jsonName: "gameover.json" },
        title_ef_0060: { base: "/title_ef_0060_dev", jsonName: "title_ef_0060.json" },
      };

      const fixtureName = params.get("devFixture");
      const fixture = fixtureName ? FIXTURE_MAP[fixtureName] : undefined;
      if (fixture) {
        e2eFixtureStartedRef.current = true;
        void (async () => {
          const { base, jsonName } = fixture;
          try {
            const res = await fetch(`${base}/${jsonName}`);
            if (!res.ok) {
              throw new Error(`HTTP ${res.status} loading ${base}/${jsonName}`);
            }
            const json = (await res.json()) as LmbJson;

            let binding: LmbTextureBinding | undefined;
            const bindRes = await fetch(`${base}/lmb_texture_binding.json`);
            if (bindRes.ok) {
              binding = (await bindRes.json()) as LmbTextureBinding;
            }

            // Collect all PNG textures from the textures/ directory listing.
            // With binding: fetch only the files listed in it.
            // Without binding: fetch all img-XXXXX.png for each atlas.
            const filesByName = new Map<string, File>();
            const pngNames: string[] = binding?.byAtlasId
              ? Object.values(binding.byAtlasId)
              : json.resources.textureAtlases.map((_: unknown, i: number) =>
                  `img-${String(i).padStart(5, "0")}.png`
                );

            for (const baseName of pngNames) {
              const tr = await fetch(
                `${base}/textures/${encodeURIComponent(baseName)}`
              );
              if (!tr.ok) continue;
              const blob = await tr.blob();
              filesByName.set(
                baseName,
                new File([blob], baseName, { type: "image/png" })
              );
            }

            await loadJsonIntoEditor(json, (rend, store) =>
              rend.loadAtlasTexturesFromFiles(json, store, filesByName, {
                binding,
              })
            );
          } catch (err) {
            console.error(`[devFixture=${fixtureName}]`, err);
          }
        })();
        return;
      }

      if (params.get("e2e") !== "1") return;

      e2eFixtureStartedRef.current = true;
      void (async () => {
        try {
          const res = await fetch("/dev_fixtures/minimal_lmb.json");
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} loading dev fixture`);
          }
          const json = (await res.json()) as LmbJson;
          await loadJsonIntoEditor(json, (rend, store) =>
            rend.loadAtlasTextures(json, store, "dev_fixtures/textures/")
          );
        } catch (err) {
          console.error("[e2e fixture]", err);
        }
      })();
    },
    [loadJsonIntoEditor]
  );

  /**
   * Handle JSON file loading (textures from dev server preview/public/textures/).
   */
  const handleFileSelected = useCallback(
    async (file: File) => {
      try {
        const text = await file.text();
        const json = JSON.parse(text) as LmbJson;
        await loadJsonIntoEditor(json, (renderer, store) =>
          renderer.loadAtlasTextures(json, store, "textures/")
        );
      } catch (e) {
        console.error("Error loading file:", e);
      }
    },
    [loadJsonIntoEditor]
  );

  /**
   * Pick a folder with one root JSON + textures/*.png (File System Access API).
   */
  const handleOpenFolder = useCallback(async () => {
    try {
      const { json, textureFilesByName, textureBinding } =
        await pickLmbAssetFolder();
      await loadJsonIntoEditor(json, (renderer, store) =>
        renderer.loadAtlasTexturesFromFiles(json, store, textureFilesByName, {
          binding: textureBinding,
        })
      );
    } catch (e) {
      console.error("Error loading folder:", e);
    }
  }, [loadJsonIntoEditor]);

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
  const isMachineSelect = new URLSearchParams(window.location.search).get("devFixture") === "machineselect"
    || (state.json?.definitions.sprites.length === 81 && state.json?.definitions.buttons.length === 186);

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
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenFolder}
              className="gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              Open folder
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
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setInspectorOpen(!inspectorOpen)}
                  title={inspectorOpen ? "Hide Inspector" : "Show Inspector"}
                >
                  {inspectorOpen ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </header>

          {/* Main area: Stage + Inspector */}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex flex-col flex-1 overflow-hidden">
              <Stage onRendererReady={handleRendererReady} />
              {isMachineSelect ? (
                <MachineSelectPanel playerRef={playerRef} onRender={renderCurrentScene} />
              ) : (
                <GameControlPanel playerRef={playerRef} onRender={renderCurrentScene} />
              )}
            </div>
            {inspectorOpen && (
              <Inspector playerRef={playerRef} rendererRef={rendererRef} onRender={renderCurrentScene} />
            )}
          </div>

          {/* Timeline bar */}
          <TimelineBar playerRef={playerRef} onRender={renderCurrentScene} />
        </div>
      </TooltipProvider>
    </EditorContext.Provider>
  );
}

export default App;
