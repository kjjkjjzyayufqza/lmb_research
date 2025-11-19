import React from 'react';
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
  onFileSelected,
}) => {
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

      <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem' }}>
        <div>
          <span style={{ color: '#aaa' }}>Frame: </span>
          <span style={{ fontWeight: 'bold', minWidth: '3ch', display: 'inline-block' }}>{currentFrame}</span>
        </div>
        <div>
          <span style={{ color: '#aaa' }}>Label: </span>
          <span style={{ fontWeight: 'bold' }}>{currentLabel || '-'}</span>
        </div>
      </div>
    </div>
  );
};

