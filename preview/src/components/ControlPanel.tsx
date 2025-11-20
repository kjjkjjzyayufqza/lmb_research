import React, { useState } from 'react';
import { SpriteDef } from '../lib/preview_runtime';

interface ControlPanelProps {
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  rootSpriteId: number;
  sprites: SpriteDef[];
  onRootSpriteChange: (id: number) => void;
  currentFrame: number;
  currentLabel: string | undefined;
  currentDisplayListCount: number;
  currentRemoveListCount: number;
  currentActionsCount: number;
  onJumpToFrame: (frameIndex: number) => void;
  onSearchByDisplayListCount: (minCount: number) => void;
  onFileSelected: (file: File) => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isPlaying,
  onPlay,
  onPause,
  onStop,
  rootSpriteId,
  sprites,
  onRootSpriteChange,
  currentFrame,
  currentLabel,
  currentDisplayListCount,
  currentRemoveListCount,
  currentActionsCount,
  onJumpToFrame,
  onSearchByDisplayListCount,
  onFileSelected,
}) => {
  const [debugFrameInput, setDebugFrameInput] = useState<string>('0');
  const [debugDisplayListInput, setDebugDisplayListInput] = useState<string>('0');

  return (
    <div style={{
      padding: '1rem',
      background: '#333',
      borderBottom: '1px solid #555',
      display: 'flex',
      gap: '1rem',
      alignItems: 'center',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>JSON File</label>
        <input 
          type="file" 
          accept=".json" 
          onChange={(e) => {
            if (e.target.files?.[0]) {
              onFileSelected(e.target.files[0]);
            }
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <label style={{ fontSize: '0.8rem', marginBottom: '0.2rem' }}>Root Sprite</label>
        <select 
          value={rootSpriteId} 
          onChange={(e) => onRootSpriteChange(Number(e.target.value))}
          style={{ minWidth: '200px' }}
        >
          {sprites.map(s => (
            <option key={s.characterId} value={s.characterId}>
              {s.characterId}: {s.name || `Sprite_${s.characterId}`}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
        <button onClick={onPlay} disabled={isPlaying}>Play</button>
        <button onClick={onPause} disabled={!isPlaying}>Pause</button>
        <button onClick={onStop}>Stop</button>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '260px' }}>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div>
            <span style={{ color: '#aaa' }}>Frame: </span>
            <span style={{ fontWeight: 'bold', minWidth: '3ch', display: 'inline-block' }}>{currentFrame}</span>
          </div>
          <div>
            <span style={{ color: '#aaa' }}>Label: </span>
            <span style={{ fontWeight: 'bold' }}>{currentLabel || '-'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem', color: '#ccc' }}>
          <span>displayList: <strong>{currentDisplayListCount}</strong></span>
          <span>removeList: <strong>{currentRemoveListCount}</strong></span>
          <span>actions: <strong>{currentActionsCount}</strong></span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', fontSize: '0.8rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <label htmlFor="debug-frame" style={{ color: '#aaa' }}>Jump frame</label>
            <input
              id="debug-frame"
              type="number"
              style={{ width: '4rem' }}
              value={debugFrameInput}
              onChange={(e) => setDebugFrameInput(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                const value = parseInt(debugFrameInput, 10);
                if (!Number.isNaN(value)) {
                  onJumpToFrame(value);
                }
              }}
            >
              Go
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <label htmlFor="debug-dl" style={{ color: '#aaa' }}>Find dl ≥</label>
            <input
              id="debug-dl"
              type="number"
              style={{ width: '4rem' }}
              value={debugDisplayListInput}
              onChange={(e) => setDebugDisplayListInput(e.target.value)}
            />
            <button
              type="button"
              onClick={() => {
                const value = parseInt(debugDisplayListInput, 10);
                if (!Number.isNaN(value)) {
                  onSearchByDisplayListCount(value);
                }
              }}
            >
              Find
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

