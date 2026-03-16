import React, { useState, useEffect } from 'react';
import FileDiffView from './components/FileDiffView.jsx';

export function App() {
  const [leftPath, setLeftPath] = useState('');
  const [rightPath, setRightPath] = useState('');
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');
  const [loading, setLoading] = useState(true);

  const api = window.kdiff4;

  useEffect(() => {
    if (!api) return;
    api.onInitialPaths(async (paths) => {
      if (!paths?.left || !paths?.right) return;
      setLeftPath(paths.left);
      setRightPath(paths.right);
      const [l, r] = await Promise.all([
        api.readFile(paths.left),
        api.readFile(paths.right),
      ]);
      setLeftContent(l);
      setRightContent(r);
      setLoading(false);
    });
  }, [api]);

  const containerStyle = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  if (loading) {
    return (
      <div style={{ ...containerStyle, alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-ui)' }}>
          {api ? 'Loading...' : 'Usage: kdiff4 file1 file2'}
        </span>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <FileDiffView
        leftPath={leftPath}
        rightPath={rightPath}
        leftContent={leftContent}
        rightContent={rightContent}
      />
    </div>
  );
}

export default App;
