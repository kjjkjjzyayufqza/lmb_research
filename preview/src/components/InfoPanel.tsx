import React from 'react';
import { FrameDef, MetaDef } from '../lib/preview_runtime';

interface InfoPanelProps {
  meta: MetaDef | null;
  currentFrameDef: FrameDef | undefined;
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ meta, currentFrameDef }) => {
  const frameInfo = currentFrameDef ? {
    frameIndex: currentFrameDef.frameIndex,
    displayListCount: currentFrameDef.displayList.length,
    removeCount: currentFrameDef.removeList.length,
    actions: currentFrameDef.actions,
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
      </div>
    </div>
  );
};

