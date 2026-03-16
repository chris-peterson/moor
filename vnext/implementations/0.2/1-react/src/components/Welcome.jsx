import React, { useState, useCallback } from 'react';

const FolderIcon = ({ color }) => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <path
      d="M6 12C6 10.8954 6.89543 10 8 10H18L22 14H40C41.1046 14 42 14.8954 42 16V36C42 37.1046 41.1046 38 40 38H8C6.89543 38 6 37.1046 6 36V12Z"
      stroke={color}
      strokeWidth="1.5"
      fill="none"
    />
  </svg>
);

export function Welcome({ onCompare, onMerge, api }) {
  const [leftDir, setLeftDir] = useState('');
  const [rightDir, setRightDir] = useState('');
  const [basePath, setBasePath] = useState('');
  const [mergeLeftPath, setMergeLeftPath] = useState('');
  const [mergeRightPath, setMergeRightPath] = useState('');
  const [outputPath, setOutputPath] = useState('');
  const [leftHover, setLeftHover] = useState(false);
  const [rightHover, setRightHover] = useState(false);

  const browseDirectory = useCallback(async (setter) => {
    if (!api) return;
    try {
      const path = await api.selectDirectory();
      if (path) setter(path);
    } catch (err) {
      console.error('Browse failed:', err);
    }
  }, [api]);

  const browseFile = useCallback(async (setter) => {
    if (!api) return;
    try {
      const path = await api.selectFile();
      if (path) setter(path);
    } catch (err) {
      console.error('Browse failed:', err);
    }
  }, [api]);

  const handleCompare = useCallback(() => {
    if (leftDir && rightDir && onCompare) {
      onCompare(leftDir, rightDir);
    }
  }, [leftDir, rightDir, onCompare]);

  const handleMerge = useCallback(() => {
    if (basePath && mergeLeftPath && mergeRightPath && onMerge) {
      onMerge(basePath, mergeLeftPath, mergeRightPath, outputPath);
    }
  }, [basePath, mergeLeftPath, mergeRightPath, outputPath, onMerge]);

  const wrapperStyle = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    background: 'radial-gradient(ellipse at center, var(--bg-surface) 0%, var(--bg-deep) 70%)',
    minHeight: '100vh',
  };

  const titleStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '48px',
    fontWeight: 500,
    letterSpacing: '0.08em',
    color: 'var(--text-primary)',
    margin: '0 0 8px 0',
  };

  const subtitleStyle = {
    fontFamily: 'var(--font-ui)',
    fontSize: '16px',
    color: 'var(--text-secondary)',
    margin: '0 0 48px 0',
    fontWeight: 400,
  };

  const zonesContainerStyle = {
    display: 'flex',
    gap: '24px',
    maxWidth: '900px',
    width: '100%',
  };

  const zoneStyle = (side, hover) => ({
    flex: 1,
    height: '300px',
    border: `1px dashed ${hover
      ? (side === 'left' ? 'var(--color-left)' : 'var(--color-right)')
      : 'var(--border)'}`,
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    cursor: 'pointer',
    transition: 'border-color 0.2s, background 0.15s',
    background: hover ? 'var(--bg-panel)' : 'transparent',
  });

  const zoneLabelStyle = (side) => ({
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: side === 'left' ? 'var(--color-left)' : 'var(--color-right)',
  });

  const zonePathStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    maxWidth: '280px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'center',
  };

  const browseTextStyle = {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--text-muted)',
  };

  const compareButtonStyle = {
    marginTop: '24px',
    padding: '12px 48px',
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    fontWeight: 600,
    color: leftDir && rightDir ? 'var(--bg-deep)' : 'var(--text-muted)',
    background: leftDir && rightDir ? 'var(--color-accent)' : 'var(--bg-panel)',
    border: 'none',
    borderRadius: '6px',
    cursor: leftDir && rightDir ? 'pointer' : 'default',
    transition: 'background 0.2s, color 0.2s',
  };

  const dividerStyle = {
    width: '100%',
    maxWidth: '900px',
    height: '1px',
    background: 'var(--border)',
    margin: '48px 0 32px 0',
  };

  const mergeSectionTitleStyle = {
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    letterSpacing: '0.08em',
    margin: '0 0 20px 0',
  };

  const mergeInputsStyle = {
    display: 'flex',
    gap: '16px',
    maxWidth: '900px',
    width: '100%',
  };

  const mergeZoneStyle = {
    flex: 1,
    height: '80px',
    border: '1px dashed var(--border)',
    borderRadius: '6px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  };

  const mergeZoneLabelStyle = {
    fontFamily: 'var(--font-ui)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    color: 'var(--text-secondary)',
  };

  const mergeZonePathStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--text-muted)',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const mergeButtonStyle = {
    marginTop: '16px',
    padding: '10px 36px',
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    fontWeight: 600,
    color: basePath && mergeLeftPath && mergeRightPath ? 'var(--bg-deep)' : 'var(--text-muted)',
    background: basePath && mergeLeftPath && mergeRightPath ? 'var(--color-conflict)' : 'var(--bg-panel)',
    border: 'none',
    borderRadius: '6px',
    cursor: basePath && mergeLeftPath && mergeRightPath ? 'pointer' : 'default',
    transition: 'background 0.2s, color 0.2s',
  };

  const noApiStyle = {
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginTop: '8px',
  };

  return (
    <div style={wrapperStyle}>
      <h1 style={titleStyle}>kdiff4</h1>
      <p style={subtitleStyle}>diff &middot; merge &middot; resolve</p>

      <div style={zonesContainerStyle}>
        <div
          style={zoneStyle('left', leftHover)}
          onMouseEnter={() => setLeftHover(true)}
          onMouseLeave={() => setLeftHover(false)}
          onClick={() => browseDirectory(setLeftDir)}
        >
          <span style={zoneLabelStyle('left')}>LEFT</span>
          <FolderIcon color="var(--color-left)" />
          {leftDir
            ? <span style={zonePathStyle}>{leftDir}</span>
            : <span style={browseTextStyle}>Click to browse</span>
          }
        </div>

        <div
          style={zoneStyle('right', rightHover)}
          onMouseEnter={() => setRightHover(true)}
          onMouseLeave={() => setRightHover(false)}
          onClick={() => browseDirectory(setRightDir)}
        >
          <span style={zoneLabelStyle('right')}>RIGHT</span>
          <FolderIcon color="var(--color-right)" />
          {rightDir
            ? <span style={zonePathStyle}>{rightDir}</span>
            : <span style={browseTextStyle}>Click to browse</span>
          }
        </div>
      </div>

      <button style={compareButtonStyle} onClick={handleCompare} disabled={!leftDir || !rightDir}>
        Compare Directories
      </button>
      {!api && <span style={noApiStyle}>Electron API not available</span>}

      <div style={dividerStyle} />

      <p style={mergeSectionTitleStyle}>3-WAY MERGE</p>
      <div style={mergeInputsStyle}>
        <div style={mergeZoneStyle} onClick={() => browseFile(setBasePath)}>
          <span style={mergeZoneLabelStyle}>BASE</span>
          {basePath
            ? <span style={mergeZonePathStyle}>{basePath.split('/').pop()}</span>
            : <span style={{ ...mergeZonePathStyle, color: 'var(--text-muted)' }}>select</span>
          }
        </div>
        <div style={mergeZoneStyle} onClick={() => browseFile(setMergeLeftPath)}>
          <span style={{ ...mergeZoneLabelStyle, color: 'var(--color-left)' }}>LEFT</span>
          {mergeLeftPath
            ? <span style={mergeZonePathStyle}>{mergeLeftPath.split('/').pop()}</span>
            : <span style={{ ...mergeZonePathStyle, color: 'var(--text-muted)' }}>select</span>
          }
        </div>
        <div style={mergeZoneStyle} onClick={() => browseFile(setMergeRightPath)}>
          <span style={{ ...mergeZoneLabelStyle, color: 'var(--color-right)' }}>RIGHT</span>
          {mergeRightPath
            ? <span style={mergeZonePathStyle}>{mergeRightPath.split('/').pop()}</span>
            : <span style={{ ...mergeZonePathStyle, color: 'var(--text-muted)' }}>select</span>
          }
        </div>
        <div style={mergeZoneStyle} onClick={() => browseFile(setOutputPath)}>
          <span style={mergeZoneLabelStyle}>OUTPUT</span>
          {outputPath
            ? <span style={mergeZonePathStyle}>{outputPath.split('/').pop()}</span>
            : <span style={{ ...mergeZonePathStyle, color: 'var(--text-muted)' }}>select</span>
          }
        </div>
      </div>

      <button style={mergeButtonStyle} onClick={handleMerge} disabled={!basePath || !mergeLeftPath || !mergeRightPath}>
        Start Merge
      </button>
    </div>
  );
}

export default Welcome;
