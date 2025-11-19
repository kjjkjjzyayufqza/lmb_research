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
           rendererRef.current.renderScene(scene.getInstancesSorted());
           
           // Optimization: Batched updates or throttled updates could be better
           // but let's try direct updates first.
           setCurrentFrame(frame.frameIndex);
           setCurrentLabel(frame.label);
           setCurrentFrameDef(frame);
        }
      }
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
        onFileSelected={handleFileSelected}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <CanvasView onRendererReady={handleRendererReady} />
          <div style={{ height: '150px', display: 'flex', borderTop: '1px solid #444' }}>
             <LogView logs={logs} />
          </div>
        </div>
        <InfoPanel meta={meta} currentFrameDef={currentFrameDef} />
      </div>
    </div>
  );
}

export default App;

