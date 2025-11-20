import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CanvasView } from './components/CanvasView';
import { ControlPanel } from './components/ControlPanel';
import { InfoPanel } from './components/InfoPanel';
import { LogView } from './components/LogView';
import { 
  LmbJson, 
  ResourceStore, 
  Scene, 
  TimelinePlayer, 
  SpriteDef, 
  FrameDef 
} from './lib/preview_runtime';
import { WebGlRenderer } from './lib/preview_renderer_webgl';

import { TextDef } from './lib/preview_runtime';

function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [meta, setMeta] = useState<LmbJson['meta'] | null>(null);
  const [sprites, setSprites] = useState<SpriteDef[]>([]);
  const [rootSpriteId, setRootSpriteId] = useState<number>(0);
  const [currentFrame, setCurrentFrame] = useState<number>(0);
  const [currentLabel, setCurrentLabel] = useState<string | undefined>(undefined);
  const [currentFrameDef, setCurrentFrameDef] = useState<FrameDef | undefined>(undefined);
  const [isPlaying, setIsPlaying] = useState(false);

  const rendererRef = useRef<WebGlRenderer | null>(null);
  const playerRef = useRef<TimelinePlayer | null>(null);
  const storeRef = useRef<ResourceStore | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string) => {
    const ts = new Date().toISOString().split('T')[1].replace('Z', '');
    const line = `[${ts}] ${msg}`;
    // Also mirror logs to console for easier debugging without opening the in-app log view.
    // This is safe for production since it only affects developer tools.
    console.log(line);
    setLogs(prev => [...prev, line]);
  }, []);

  const handleRendererReady = useCallback((renderer: WebGlRenderer) => {
    rendererRef.current = renderer;
    addLog('WebGL Renderer initialized.');
  }, [addLog]);

  const handleFileSelected = async (file: File) => {
    try {
      addLog(`Loading ${file.name}...`);
      const text = await file.text();
      const json = JSON.parse(text) as LmbJson;
      
      storeRef.current = new ResourceStore(json);
      setMeta(json.meta);
      setSprites(storeRef.current.getSprites());
      
      if (rendererRef.current) {
        rendererRef.current.resizeForMeta(json.meta);
        rendererRef.current.clear();
        addLog('Loading textures...');
        // Assume textures are in the public/textures directory
        await rendererRef.current.loadAtlasTextures(json, storeRef.current, 'textures/'); 
        addLog('Textures loaded.');
      }

      const initialRoot = json.timeline.rootSpriteId;
      setRootSpriteId(initialRoot);
      attachTimeline(initialRoot);

    } catch (e) {
      addLog(`Error loading file: ${(e as Error).message}`);
      console.error(e);
    }
  };

  const attachTimeline = (spriteId: number) => {
    if (!storeRef.current) return;
    
    // Clean up old player
    if (playerRef.current) {
      playerRef.current.stop();
      playerRef.current.pause(); // Stop loop
      setIsPlaying(false);
    }

    const sprite = storeRef.current.getSpriteById(spriteId);
    if (!sprite) {
      addLog(`Sprite ${spriteId} not found.`);
      return;
    }

    sceneRef.current = new Scene();
    
    // Initial render
    if (sprite.timeline.length > 0) {
      sceneRef.current.applyFrame(storeRef.current, sprite.timeline[0]);
      if (rendererRef.current) {
        const instances = sceneRef.current.getInstancesSorted();
        addLog(`Initial scene instances: ${instances.length}`);
        rendererRef.current.renderScene(instances);
      }
    }

    playerRef.current = new TimelinePlayer(
      storeRef.current,
      sprite,
      sceneRef.current,
      (frame, scene) => {
        // This callback runs every frame tick
        if (rendererRef.current && frame) {
           // Update UI less frequently if needed, but for now just update state
           // Note: Setting state in RAF loop might cause React performance issues.
           // Consider using refs for stats and a separate interval for UI updates if it lags.
           rendererRef.current.clear();
           const sortedInstances = scene.getInstancesSorted();
           rendererRef.current.renderScene(sortedInstances);
           
           // Update Overlay (Text / Debug)
           if (overlayRef.current && meta) {
             const stageWidth = meta.width || 512;
             const stageHeight = meta.height || 256;
             
             let stage = overlayRef.current.firstElementChild as HTMLDivElement;
             if (!stage) {
               stage = document.createElement('div');
               stage.style.position = 'relative';
               stage.style.width = `${stageWidth}px`;
               stage.style.height = `${stageHeight}px`;
               stage.style.overflow = 'hidden';
               overlayRef.current.appendChild(stage);
             } else {
               if (stage.style.width !== `${stageWidth}px`) stage.style.width = `${stageWidth}px`;
               if (stage.style.height !== `${stageHeight}px`) stage.style.height = `${stageHeight}px`;
             }
             
             stage.innerHTML = '';
             
             const canvas = rendererRef.current.getCanvas();
             // Calculate scale to fit overlay to canvas size
             // Canvas width is 100% of container. Overlay is 100% of container.
             // So canvas.offsetWidth matches overlay.offsetWidth.
             // But we need to scale the 'stage' div to fill that width.
             // Or rather, match the canvas coordinate system scaling.
             // WebGL fits stageWidth/Height into canvas size preserving aspect ratio?
             // No, buildOrthoMatrix uses stageWidth/Height.
             // resizeForMeta sets canvas resolution to stageWidth/Height.
             // CSS scales the canvas.
             // So we need to scale our 'stage' div by `canvas.offsetWidth / stageWidth`.
             
             const scale = canvas.offsetWidth / stageWidth;
             stage.style.transform = `scale(${scale})`;
             stage.style.transformOrigin = 'top left';
             // Center the stage if needed?
             // Canvas is centered by flexbox. Overlay is full width.
             // If canvas aspect ratio != wrapper aspect ratio, canvas is centered.
             // If we scale stage by width, and height is auto, stage might not be centered vertically relative to canvas if canvas is centered.
             // Wait, canvas.offsetHeight might differ from stageHeight * scale if aspect ratio differs?
             // No, canvas CSS is `height: auto`, so it preserves aspect ratio.
             // So `canvas.offsetHeight` should contain `stageHeight * scale`.
             // The only issue is centering.
             // The canvas is centered in the wrapper.
             // The overlay is the wrapper size.
             // We need to center `stage` inside `overlay`.
             
             // Center stage:
             const currentStageWidth = stageWidth * scale;
             const currentStageHeight = stageHeight * scale;
             const offsetX = (overlayRef.current.offsetWidth - currentStageWidth) / 2;
             const offsetY = (overlayRef.current.offsetHeight - currentStageHeight) / 2;
             
             stage.style.left = `${offsetX}px`;
             stage.style.top = `${offsetY}px`;
             
             for (const inst of sortedInstances) {
               if (inst.text) {
                 const el = document.createElement('div');
                 el.textContent = inst.text.placeholderText || '';
                 el.style.position = 'absolute';
                 el.style.whiteSpace = 'nowrap';
                 el.style.color = '#ffffff';
                 if (inst.text.strokeColorId !== undefined && storeRef.current) {
                    const col = storeRef.current.getColorById(inst.text.strokeColorId);
                    if (col) {
                        el.style.color = `rgba(${col.r}, ${col.g}, ${col.b}, ${col.a/255})`;
                    }
                 }
                 el.style.fontSize = `${inst.text.size}px`;
                 el.style.fontFamily = 'sans-serif';
                 
                 // Text Alignment
                 // 0: left, 1: right, 2: center
                 if (inst.text.alignment === 1) el.style.textAlign = 'right';
                 else if (inst.text.alignment === 2) el.style.textAlign = 'center';
                 
                 // Transform
                 // LMB coords: (0,0) is center of stage.
                 // HTML stage: (0,0) is top-left.
                 // We need to shift by (stageWidth/2, stageHeight/2).
                 const cx = stageWidth / 2;
                 const cy = stageHeight / 2;
                 
                 const m = inst.transform;
                 
                 el.style.left = `${cx}px`;
                 el.style.top = `${cy}px`;
                 el.style.transformOrigin = '0 0';
                 el.style.transform = `matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.x}, ${m.y})`;
                 
                 // Correction for alignment logic if needed? 
                 // Usually text origin is baseline-left? Or center?
                 // For now assume top-left of text box is at the point.
                 
                 stage.appendChild(el);
               }
             }
           }
           
           // Optimization: Batched updates or throttled updates could be better
           // but let's try direct updates first.
           setCurrentFrame(frame.frameIndex);
           setCurrentLabel(frame.label);
           setCurrentFrameDef(frame);
        }
      },
      addLog // Pass logger
    );

    addLog(`Attached timeline to sprite ${spriteId}: ${sprite.name || ''}`);
    // Set initial state
    if (sprite.timeline[0]) {
      setCurrentFrame(0);
      setCurrentLabel(sprite.timeline[0].label);
      setCurrentFrameDef(sprite.timeline[0]);
    }
  };

  const handleRootSpriteChange = (id: number) => {
    setRootSpriteId(id);
    attachTimeline(id);
  };

  const handlePlay = () => {
    if (playerRef.current) {
      playerRef.current.play();
      setIsPlaying(true);
      addLog('Play');
      if (sceneRef.current && rendererRef.current) {
        const instances = sceneRef.current.getInstancesSorted();
        addLog(`Scene instances on Play: ${instances.length}`);
        rendererRef.current.clear();
        rendererRef.current.renderScene(instances);
      }
    }
  };

  const handleJumpToFrame = (frameIndex: number) => {
    if (!playerRef.current || !storeRef.current) {
      return;
    }
    const sprite = storeRef.current.getSpriteById(rootSpriteId);
    if (!sprite || sprite.timeline.length === 0) {
      addLog('Cannot jump: no sprite timeline loaded.');
      return;
    }
    const clamped = Math.max(0, Math.min(frameIndex, sprite.timeline.length - 1));
    playerRef.current.goToFrame(clamped);
    setIsPlaying(false);
    addLog(`Jumped to frame ${clamped}.`);
  };

  const handleJumpByDisplayListCount = (minCount: number) => {
    if (!storeRef.current || !playerRef.current) {
      return;
    }
    const sprite = storeRef.current.getSpriteById(rootSpriteId);
    if (!sprite || sprite.timeline.length === 0) {
      addLog('Cannot search: no sprite timeline loaded.');
      return;
    }

    const targetIndex = sprite.timeline.findIndex(
      (f) => f.displayList.length >= minCount
    );
    if (targetIndex === -1) {
      addLog(`No frame found with displayList length >= ${minCount}.`);
      return;
    }

    playerRef.current.goToFrame(targetIndex);
    setIsPlaying(false);
    const frame = sprite.timeline[targetIndex];
    addLog(
      `Jumped to frame ${targetIndex} (displayList=${frame.displayList.length}, removeList=${frame.removeList.length}, actions=${frame.actions.length}).`
    );
  };

  const handlePause = () => {
    if (playerRef.current) {
      playerRef.current.pause();
      setIsPlaying(false);
      addLog('Pause');
    }
  };

  const handleStop = () => {
    if (playerRef.current) {
      playerRef.current.stop();
      setIsPlaying(false);
      addLog('Stop');
    }
  };

  const handleActionClick = useCallback((actionId: number) => {
    addLog(`Action Clicked: ID=${actionId} (Frame: ${currentFrame})`);
    // Future: Look up action meaning or show more details
  }, [addLog, currentFrame]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      <header style={{ background: '#222', borderBottom: '1px solid #444' }}>
        <h1 style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '1.2rem' }}>LMB JSON Preview (React + Vite)</h1>
      </header>
      
      <ControlPanel 
        isPlaying={isPlaying}
        onPlay={handlePlay}
        onPause={handlePause}
        onStop={handleStop}
        rootSpriteId={rootSpriteId}
        sprites={sprites}
        onRootSpriteChange={handleRootSpriteChange}
        currentFrame={currentFrame}
        currentLabel={currentLabel}
        currentDisplayListCount={currentFrameDef?.displayList.length ?? 0}
        currentRemoveListCount={currentFrameDef?.removeList.length ?? 0}
        currentActionsCount={currentFrameDef?.actions.length ?? 0}
        onJumpToFrame={handleJumpToFrame}
        onSearchByDisplayListCount={handleJumpByDisplayListCount}
        onFileSelected={handleFileSelected}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <CanvasView onRendererReady={handleRendererReady} textOverlayRef={overlayRef} />
          <div style={{ height: '150px', display: 'flex', borderTop: '1px solid #444' }}>
             <LogView logs={logs} />
          </div>
        </div>
        <InfoPanel 
          meta={meta} 
          currentFrameDef={currentFrameDef} 
          onActionClick={handleActionClick}
        />
      </div>
    </div>
  );
}

export default App;

