import React, { useState, useCallback, useEffect } from 'react';

const statusColor = (status) => {
  switch (status) {
    case 'modified': return 'var(--color-left)';
    case 'left-only': return 'var(--color-left)';
    case 'right-only': return 'var(--color-right)';
    default: return 'var(--text-muted)';
  }
};

const statusLabel = (status) => {
  switch (status) {
    case 'modified': return 'M';
    case 'left-only': return 'L';
    case 'right-only': return 'R';
    default: return '=';
  }
};

function SidebarNode({ node, depth, files, currentIndex, viewed, onSelect, expanded, onToggle }) {
  const isDir = node.type === 'directory';
  const isIdentical = node.status === 'identical';
  const nodeKey = node.leftPath || node.rightPath || node.name;
  const isExpanded = expanded.has(nodeKey);

  const fileIndex = isDir ? -1 : files.indexOf(node);
  const isCurrent = fileIndex === currentIndex;
  const isViewed = viewed.has(fileIndex);
  const isClickable = !isDir && fileIndex >= 0;

  const handleClick = useCallback(() => {
    if (isDir) {
      onToggle(nodeKey);
    } else if (isClickable) {
      onSelect(fileIndex);
    }
  }, [isDir, isClickable, nodeKey, fileIndex, onToggle, onSelect]);

  if (isIdentical && !isDir) return null;

  const hasNonIdenticalChildren = isDir && node.children?.some(c =>
    c.status !== 'identical' || (c.type === 'directory' && c.summary && (c.summary.modified > 0 || c.summary.leftOnly > 0 || c.summary.rightOnly > 0))
  );
  if (isDir && !hasNonIdenticalChildren) return null;

  return (
    <>
      <div
        onClick={handleClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: `2px 8px 2px ${8 + depth * 14}px`,
          cursor: isDir || isClickable ? 'pointer' : 'default',
          background: isCurrent ? 'var(--bg-hover)' : 'transparent',
          borderLeft: isCurrent ? '2px solid var(--color-accent)' : '2px solid transparent',
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          lineHeight: '1.8',
          color: isViewed ? 'var(--text-muted)' : 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {isDir && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{
            flexShrink: 0,
            transform: isExpanded ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.1s',
          }}>
            <path d="M3 1L7 5L3 9" stroke="var(--text-muted)" strokeWidth="1.2" />
          </svg>
        )}
        {!isDir && <span style={{ width: 10, flexShrink: 0 }} />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
        {!isDir && (
          <span style={{ color: statusColor(node.status), flexShrink: 0, fontSize: '10px' }}>
            {statusLabel(node.status)}
          </span>
        )}
        {isViewed && !isDir && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0 }}>
            <path d="M2 5L4 7L8 3" stroke="var(--color-equal)" strokeWidth="1.2" />
          </svg>
        )}
      </div>
      {isDir && isExpanded && node.children?.map((child) => (
        <SidebarNode
          key={child.name}
          node={child}
          depth={depth + 1}
          files={files}
          currentIndex={currentIndex}
          viewed={viewed}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}
    </>
  );
}

export function Sidebar({ tree, files, currentIndex, viewed, onSelect }) {
  const [expanded, setExpanded] = useState(() => {
    const set = new Set();
    const expandAll = (node) => {
      if (node.type === 'directory') {
        set.add(node.leftPath || node.rightPath || node.name);
        node.children?.forEach(expandAll);
      }
    };
    if (tree) expandAll(tree);
    return set;
  });

  useEffect(() => {
    const file = files[currentIndex];
    if (!file) return;
    const filePath = file.leftPath || file.rightPath || '';
    const ancestors = [];
    const findAncestors = (node, path) => {
      if (node.type !== 'directory') return false;
      const key = node.leftPath || node.rightPath || node.name;
      for (const child of node.children || []) {
        if (child === file || findAncestors(child, path)) {
          ancestors.push(key);
          return true;
        }
      }
      return false;
    };
    if (tree) findAncestors(tree);
    if (ancestors.length > 0) {
      setExpanded(prev => {
        if (ancestors.every(k => prev.has(k))) return prev;
        const next = new Set(prev);
        for (const k of ancestors) next.add(k);
        return next;
      });
    }
  }, [currentIndex, files, tree]);

  const onToggle = useCallback((key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }, []);

  const summary = tree?.summary || { modified: 0, leftOnly: 0, rightOnly: 0 };
  const total = files.length;
  const viewedCount = viewed.size;

  return (
    <div style={{
      width: '220px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 10px',
        fontFamily: 'var(--font-ui)',
        fontSize: '11px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>FILES</span>
        <span style={{ fontWeight: 400, fontFamily: 'var(--font-mono)', fontSize: '10px' }}>
          {viewedCount}/{total}
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tree?.children?.map((child) => (
          <SidebarNode
            key={child.name}
            node={child}
            depth={0}
            files={files}
            currentIndex={currentIndex}
            viewed={viewed}
            onSelect={onSelect}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

export default Sidebar;
