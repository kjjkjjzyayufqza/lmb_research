import React, { useEffect, useRef } from 'react';

interface LogViewProps {
  logs: string[];
}

export const LogView: React.FC<LogViewProps> = ({ logs }) => {
  const ref = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', padding: '0.5rem', background: '#444' }}>Log</h3>
      <pre 
        ref={ref}
        style={{ 
          flex: 1, 
          margin: 0, 
          padding: '0.5rem', 
          overflowY: 'auto', 
          fontSize: '0.8rem', 
          fontFamily: 'monospace',
          background: '#222'
        }}
      >
        {logs.join('\n')}
      </pre>
    </div>
  );
};

