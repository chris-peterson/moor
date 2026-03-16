import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { diff3Merge } from '../engine/diff3.js';
import { Toolbar, ToolbarButton, ToolbarBadge, ToolbarSeparator } from './Toolbar.jsx';

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M2 6L5 9L10 3" stroke="var(--color-equal)" strokeWidth="1.5" />
  </svg>
);

function SourcePanel({ label, color, lines, regions, scrollRef, onScroll }) {
  const lineNumStyle = {
    width: '40px',
    minWidth: '40px',
    textAlign: 'right',
    paddingRight: '8px',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-code)',
    lineHeight: 'var(--line-height-code)',
    color: 'var(--text-muted)',
    userSelect: 'none',
    flexShrink: 0,
  };

  const codeStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-code)',
    lineHeight: 'var(--line-height-code)',
    whiteSpace: 'pre',
    flex: 1,
    paddingLeft: '8px',
  };

  const regionLines = useMemo(() => {
    const result = [];
    for (const region of regions) {
      let regionSourceLines;
      if (label === 'Base') regionSourceLines = region.baseLines;
      else if (label === 'Left') regionSourceLines = region.leftLines;
      else regionSourceLines = region.rightLines;

      for (const line of regionSourceLines) {
        result.push({
          text: line,
          isConflict: region.type === 'conflict',
          regionType: region.type,
        });
      }
    }
    return result;
  }, [regions, label]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{
        padding: '6px 12px',
        fontFamily: 'var(--font-ui)',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.1em',
        color: color,
        background: 'var(--bg-panel)',
        borderBottom: '1px solid var(--border)',
      }}>
        {label.toUpperCase()}
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{ flex: 1, overflow: 'auto', background: 'var(--bg-deep)' }}
      >
        {regionLines.map((line, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              background: line.isConflict ? 'var(--color-conflict-bg)' : 'transparent',
            }}
          >
            <span style={lineNumStyle}>{i + 1}</span>
            <span style={codeStyle}>{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConflictControls({ index, resolved, onResolve }) {
  const btnBase = {
    padding: '2px 8px',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: 500,
    border: '1px solid var(--border)',
    borderRadius: '3px',
    cursor: 'pointer',
    background: 'var(--bg-panel)',
    transition: 'background 0.1s',
  };

  return (
    <div style={{
      display: 'flex',
      gap: '4px',
      alignItems: 'center',
      padding: '4px 8px',
      background: 'var(--color-conflict-bg)',
      borderLeft: '3px solid var(--color-conflict)',
    }}>
      {resolved ? (
        <CheckIcon />
      ) : (
        <>
          <button
            style={{ ...btnBase, color: 'var(--color-left)' }}
            onClick={() => onResolve(index, 'left')}
          >L</button>
          <button
            style={{ ...btnBase, color: 'var(--color-right)' }}
            onClick={() => onResolve(index, 'right')}
          >R</button>
          <button
            style={{ ...btnBase, color: 'var(--text-secondary)' }}
            onClick={() => onResolve(index, 'base')}
          >B</button>
          <button
            style={{ ...btnBase, color: 'var(--text-primary)' }}
            onClick={() => onResolve(index, 'both')}
          >LR</button>
        </>
      )}
    </div>
  );
}

export function MergeView({ baseContent, leftContent, rightContent, outputPath, onBack, onSave }) {
  const mergeResult = useMemo(
    () => diff3Merge(baseContent, leftContent, rightContent),
    [baseContent, leftContent, rightContent]
  );

  const [resolutions, setResolutions] = useState({});

  const conflictCount = mergeResult.conflicts;
  const resolvedCount = Object.keys(resolutions).length;

  const handleResolve = useCallback((conflictIndex, choice) => {
    setResolutions((prev) => ({ ...prev, [conflictIndex]: choice }));
  }, []);

  const mergedText = useMemo(() => {
    const lines = [];
    let conflictIdx = 0;

    for (const region of mergeResult.regions) {
      if (region.type === 'conflict') {
        const resolution = resolutions[conflictIdx];
        if (resolution === 'left') {
          lines.push(...region.leftLines);
        } else if (resolution === 'right') {
          lines.push(...region.rightLines);
        } else if (resolution === 'base') {
          lines.push(...region.baseLines);
        } else if (resolution === 'both') {
          lines.push(...region.leftLines, ...region.rightLines);
        } else {
          lines.push('<<<<<<< LEFT');
          lines.push(...region.leftLines);
          lines.push('=======');
          lines.push(...region.rightLines);
          lines.push('>>>>>>> RIGHT');
        }
        conflictIdx++;
      } else {
        lines.push(...region.resolvedLines);
      }
    }

    return lines.join('\n');
  }, [mergeResult, resolutions]);

  const [editedContent, setEditedContent] = useState('');

  useEffect(() => {
    setEditedContent(mergedText);
  }, [mergedText]);

  const handleSave = useCallback(() => {
    if (onSave) onSave(editedContent);
  }, [onSave, editedContent]);

  const [currentConflict, setCurrentConflict] = useState(0);

  const navigateConflict = useCallback((delta) => {
    setCurrentConflict((prev) => {
      const next = prev + delta;
      if (next < 0) return conflictCount - 1;
      if (next >= conflictCount) return 0;
      return next;
    });
  }, [conflictCount]);

  const baseRef = useRef(null);
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  const syncing = useRef(false);

  const handleSourceScroll = useCallback((e) => {
    if (syncing.current) return;
    syncing.current = true;
    const top = e.target.scrollTop;
    [baseRef, leftRef, rightRef].forEach((ref) => {
      if (ref.current && ref.current !== e.target) {
        ref.current.scrollTop = top;
      }
    });
    syncing.current = false;
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <ToolbarButton onClick={onBack}><ArrowIcon /></ToolbarButton>
        <ToolbarSeparator />
        <span style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          3-Way Merge
        </span>
        <ToolbarBadge accent="coral">{conflictCount - resolvedCount}</ToolbarBadge>
        <span style={{ flex: 1 }} />
        <ToolbarButton onClick={() => navigateConflict(-1)}>Prev</ToolbarButton>
        <ToolbarButton onClick={() => navigateConflict(1)}>Next</ToolbarButton>
        <ToolbarSeparator />
        <ToolbarButton accent="teal" onClick={handleSave}>Save</ToolbarButton>
      </Toolbar>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
          <SourcePanel
            label="Base"
            color="var(--text-secondary)"
            lines={baseContent.split('\n')}
            regions={mergeResult.regions}
            scrollRef={baseRef}
            onScroll={handleSourceScroll}
          />
          <div style={{ width: '1px', background: 'var(--border)' }} />
          <SourcePanel
            label="Left"
            color="var(--color-left)"
            lines={leftContent.split('\n')}
            regions={mergeResult.regions}
            scrollRef={leftRef}
            onScroll={handleSourceScroll}
          />
          <div style={{ width: '1px', background: 'var(--border)' }} />
          <SourcePanel
            label="Right"
            color="var(--color-right)"
            lines={rightContent.split('\n')}
            regions={mergeResult.regions}
            scrollRef={rightRef}
            onScroll={handleSourceScroll}
          />
        </div>

        <div style={{
          padding: '4px 16px',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}>
          {(() => {
            let conflictIdx = 0;
            return mergeResult.regions.map((region, i) => {
              if (region.type !== 'conflict') return null;
              const idx = conflictIdx++;
              return (
                <ConflictControls
                  key={i}
                  index={idx}
                  resolved={resolutions[idx] !== undefined}
                  onResolve={handleResolve}
                />
              );
            });
          })()}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{
            padding: '6px 12px',
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            color: 'var(--color-equal)',
            background: 'var(--bg-panel)',
            borderBottom: '1px solid var(--border)',
          }}>
            MERGE RESULT
            {outputPath && (
              <span style={{ color: 'var(--text-muted)', marginLeft: '12px', fontWeight: 400 }}>
                {outputPath}
              </span>
            )}
          </div>
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            spellCheck={false}
            style={{
              flex: 1,
              background: 'var(--bg-deep)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-code)',
              lineHeight: 'var(--line-height-code)',
              border: 'none',
              padding: '8px 16px',
              resize: 'none',
              width: '100%',
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default MergeView;
