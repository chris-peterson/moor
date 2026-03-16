import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Sidebar from './Sidebar.jsx';
import FileDiffView from './FileDiffView.jsx';
import FileNavbar from './FileNavbar.jsx';
import { computeLineChanges } from '../engine/diff.js';

const BINARY_SENTINEL = '\x00BINARY';

function countHunks(leftContent, rightContent) {
  if (!leftContent && !rightContent) return 0;
  if (leftContent === BINARY_SENTINEL || rightContent === BINARY_SENTINEL) return 1;
  const leftLines = leftContent ? leftContent.split('\n') : [];
  const rightLines = rightContent ? rightContent.split('\n') : [];
  const hunks = computeLineChanges(leftLines, rightLines);
  let count = 0;
  for (let i = 0; i < hunks.length; i++) {
    if (hunks[i].type === 'equal') continue;
    if (hunks[i].type === 'delete' && hunks[i + 1]?.type === 'insert') {
      count++;
      i++;
    } else {
      count++;
    }
  }
  return count;
}

function flattenTree(node, list = []) {
  if (node.type === 'file' && node.status !== 'identical') {
    list.push(node);
  }
  if (node.children) {
    for (const child of node.children) {
      flattenTree(child, list);
    }
  }
  return list;
}

export function ReviewShell({ tree, leftPath, rightPath, api, onClose }) {
  const files = useMemo(() => flattenTree(tree), [tree]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewed, setViewed] = useState(() => new Set());
  const [leftContent, setLeftContent] = useState('');
  const [rightContent, setRightContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [navigatedBackward, setNavigatedBackward] = useState(false);
  const [hunkInfo, setHunkInfo] = useState({ current: 0, total: 0 });
  const [hunkCounts, setHunkCounts] = useState({});
  const shellRef = useRef(null);

  useEffect(() => {
    if (!api || files.length === 0) return;
    let cancelled = false;
    (async () => {
      const counts = {};
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const [left, right] = await Promise.all([
          file.leftPath ? api.readFile(file.leftPath) : Promise.resolve(''),
          file.rightPath ? api.readFile(file.rightPath) : Promise.resolve(''),
        ]);
        if (cancelled) return;
        counts[i] = countHunks(left, right);
      }
      setHunkCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [api, files]);

  const currentFile = files[currentIndex] || null;
  const loadIdRef = useRef(0);

  const loadFile = useCallback(async (file) => {
    if (!api || !file) return;
    const id = ++loadIdRef.current;
    setLoading(true);
    const [left, right] = await Promise.all([
      file.leftPath ? api.readFile(file.leftPath) : Promise.resolve(''),
      file.rightPath ? api.readFile(file.rightPath) : Promise.resolve(''),
    ]);
    if (id !== loadIdRef.current) return;
    setLeftContent(left);
    setRightContent(right);
    setLoading(false);
  }, [api]);

  useEffect(() => {
    if (currentFile) {
      loadFile(currentFile);
    }
  }, [currentFile, loadFile]);

  const navigateTo = useCallback((index) => {
    if (index < 0 || index >= files.length) return;
    setViewed((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });
    setCurrentIndex(index);
  }, [files.length, currentIndex]);

  const navigateNext = useCallback(() => {
    setNavigatedBackward(false);
    if (currentIndex < files.length - 1) {
      navigateTo(currentIndex + 1);
    } else {
      setViewed((prev) => {
        const next = new Set(prev);
        next.add(currentIndex);
        return next;
      });
    }
  }, [currentIndex, files.length, navigateTo]);

  const navigatePrev = useCallback(() => {
    setNavigatedBackward(true);
    if (currentIndex > 0) {
      navigateTo(currentIndex - 1);
    }
  }, [currentIndex, navigateTo]);

  const allViewed = viewed.size >= files.length;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      switch (e.key) {
        case 'q':
        case 'Escape':
          e.preventDefault();
          if (allViewed || files.length === 0) {
            onClose();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [allViewed, files.length, onClose]);

  useEffect(() => {
    if (shellRef.current) shellRef.current.focus();
  }, []);

  const relativePath = (fullPath, base) => {
    if (!fullPath || !base) return fullPath || '';
    if (fullPath.startsWith(base)) {
      const rel = fullPath.slice(base.length);
      return rel.startsWith('/') ? rel.slice(1) : rel;
    }
    return fullPath;
  };

  return (
    <div
      ref={shellRef}
      tabIndex={-1}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        outline: 'none',
      }}
    >
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar
          tree={tree}
          files={files}
          currentIndex={currentIndex}
          viewed={viewed}
          onSelect={navigateTo}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {loading ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-ui)',
            }}>
              Loading...
            </div>
          ) : currentFile ? (
            <FileDiffView
              leftPath={relativePath(currentFile.leftPath, leftPath)}
              rightPath={relativePath(currentFile.rightPath, rightPath)}
              leftContent={leftContent}
              rightContent={rightContent}
              onNavigateNext={navigateNext}
              onNavigatePrev={navigatePrev}
              startAtEnd={navigatedBackward}
              onHunkChange={(current, total) => setHunkInfo({ current, total })}
            />
          ) : (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-ui)',
            }}>
              No differences found
            </div>
          )}
        </div>
      </div>
      <FileNavbar
        files={files}
        currentIndex={currentIndex}
        allViewed={allViewed}
        currentHunk={hunkInfo.current}
        hunkCounts={hunkCounts}
        viewed={viewed}
      />
    </div>
  );
}

export default ReviewShell;
