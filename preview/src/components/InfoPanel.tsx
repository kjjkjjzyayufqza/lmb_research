import React from 'react';
import { FrameDef, MetaDef } from '../lib/preview_runtime';

interface InfoPanelProps {
  meta: MetaDef | null;
  currentFrameDef: FrameDef | undefined;
  onActionClick?: (actionId: number) => void;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ meta, currentFrameDef, onActionClick }) => {
  const frameInfo = currentFrameDef ? {
    frameIndex: currentFrameDef.frameIndex,
    displayListCount: currentFrameDef.displayList.length,
    removeCount: currentFrameDef.removeList.length,
  } : null;

  return (
    <div style={{ width: '300px', background: '#2a2a2a', borderLeft: '1px solid #444', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem', borderBottom: '1px solid #444' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Meta Info</h3>
        <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {meta ? JSON.stringify(meta, null, 2) : 'No JSON loaded'}
        </pre>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Current Frame</h3>
        <pre style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {frameInfo ? JSON.stringify(frameInfo, null, 2) : '-'}
        </pre>
        
        {currentFrameDef && currentFrameDef.actions.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Actions ({currentFrameDef.actions.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {currentFrameDef.actions.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => onActionClick?.(action.actionId)}
                  style={{
                    background: '#444',
                    border: 'none',
                    color: '#eee',
                    padding: '0.25rem 0.5rem',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    borderRadius: '3px'
                  }}
                  title="Click to log details"
                >
                  Action ID: {action.actionId}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

