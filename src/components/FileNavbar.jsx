import React from 'react';

export function FileNavbar({ currentFilePath }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      background: 'var(--bg-surface)',
      borderTop: '1px solid var(--border)',
      height: '28px',
      flexShrink: 0,
      padding: '0 12px',
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      color: 'var(--text-secondary)',
    }}>
      {currentFilePath && (
        <div style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}>
          {currentFilePath}
        </div>
      )}
    </div>
  );
}

export default FileNavbar;
