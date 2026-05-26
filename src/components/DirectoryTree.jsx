import React, { useState, useCallback } from 'react';
import { Toolbar, ToolbarButton, ToolbarBadge, ToolbarSeparator } from './Toolbar.jsx';
import { statusColor, statusLabel } from '../engine/file-status.js';

const ArrowIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const FolderIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    {open ? (
      <path d="M1.5 4C1.5 3.44772 1.94772 3 2.5 3H6L7.5 4.5H13.5C14.0523 4.5 14.5 4.94772 14.5 5.5V12C14.5 12.5523 14.0523 13 13.5 13H2.5C1.94772 13 1.5 12.5523 1.5 12V4Z" stroke="var(--text-secondary)" strokeWidth="1" />
    ) : (
      <path d="M1.5 4C1.5 3.44772 1.94772 3 2.5 3H6L7.5 4.5H13.5C14.0523 4.5 14.5 4.94772 14.5 5.5V12C14.5 12.5523 14.0523 13 13.5 13H2.5C1.94772 13 1.5 12.5523 1.5 12V4Z" stroke="var(--text-muted)" strokeWidth="1" />
    )}
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <path d="M4 1.5H10L13 4.5V14.5H4V1.5Z" stroke="var(--text-muted)" strokeWidth="1" />
    <path d="M10 1.5V4.5H13" stroke="var(--text-muted)" strokeWidth="1" />
  </svg>
);

const ChevronIcon = ({ expanded }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    style={{
      flexShrink: 0,
      transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
      transition: 'transform 0.15s',
    }}
  >
    <path d="M4 2L8 6L4 10" stroke="var(--text-muted)" strokeWidth="1.2" />
  </svg>
);

function TreeNode({ node, depth, expanded, onToggle, onFileSelect }) {
  const isDir = node.type === 'directory';
  const isClickable = node.type === 'file' && (node.status === 'modified' || node.status === 'renamed');
  const isIdentical = node.status === 'identical';
  const isExpanded = expanded.has(node.leftPath || node.rightPath || node.name);
  const nodeKey = node.leftPath || node.rightPath || node.name;

  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '3px 16px 3px ' + (16 + depth * 20) + 'px',
    cursor: isDir || isClickable ? 'pointer' : 'default',
    opacity: isIdentical ? 0.4 : 1,
    transition: 'background 0.1s',
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--font-size-code)',
    lineHeight: '1.8',
  };

  const [hover, setHover] = useState(false);

  const handleClick = useCallback(() => {
    if (isDir) {
      onToggle(nodeKey);
    } else if (isClickable) {
      onFileSelect(node);
    }
  }, [isDir, isClickable, nodeKey, node, onToggle, onFileSelect]);

  const badgeStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 500,
    color: statusColor(node.status),
    marginLeft: 'auto',
    opacity: isIdentical ? 0.5 : 1,
  };

  return (
    <>
      <div
        style={{
          ...rowStyle,
          background: hover && (isDir || isClickable) ? 'var(--bg-hover)' : 'transparent',
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={handleClick}
      >
        {isDir && <ChevronIcon expanded={isExpanded} />}
        {!isDir && <span style={{ width: 12 }} />}
        {isDir ? <FolderIcon open={isExpanded} /> : <FileIcon />}
        <span style={{ color: isIdentical ? 'var(--text-muted)' : 'var(--text-primary)' }}>
          {node.name}
          {node.status === 'renamed' && node.fromName && node.fromName !== node.name && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>← {node.fromName}</span>
          )}
        </span>
        <span style={badgeStyle}>{statusLabel(node.status)}</span>
      </div>
      {isDir && isExpanded && node.children && node.children.map((child) => (
        <TreeNode
          key={child.name}
          node={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          onFileSelect={onFileSelect}
        />
      ))}
    </>
  );
}

export function DirectoryTree({ tree, onFileSelect, onBack }) {
  const [expanded, setExpanded] = useState(() => {
    const initial = new Set();
    if (tree) initial.add(tree.leftPath || tree.rightPath || tree.name);
    return initial;
  });

  const handleToggle = useCallback((key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const summary = tree?.summary || { modified: 0, leftOnly: 0, rightOnly: 0, identical: 0 };

  const breadcrumbStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const treeContainerStyle = {
    flex: 1,
    overflow: 'auto',
    background: 'var(--bg-deep)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar>
        <ToolbarButton onClick={onBack}><ArrowIcon /></ToolbarButton>
        <ToolbarSeparator />
        <span style={breadcrumbStyle}>
          <span style={{ color: 'var(--color-left)' }}>{tree?.leftPath || ''}</span>
          {' vs '}
          <span style={{ color: 'var(--color-right)' }}>{tree?.rightPath || ''}</span>
        </span>
        <span style={{ flex: 1 }} />
        {summary.modified > 0 && <ToolbarBadge accent="amber">{summary.modified}</ToolbarBadge>}
        {summary.leftOnly > 0 && <ToolbarBadge accent="amber">{summary.leftOnly} L</ToolbarBadge>}
        {summary.rightOnly > 0 && <ToolbarBadge accent="teal">{summary.rightOnly} R</ToolbarBadge>}
        {summary.renamed > 0 && <ToolbarBadge accent="teal">{summary.renamed} →</ToolbarBadge>}
        {summary.identical > 0 && <ToolbarBadge accent="green">{summary.identical} =</ToolbarBadge>}
      </Toolbar>
      <div style={treeContainerStyle}>
        {tree && tree.children && tree.children.map((child) => (
          <TreeNode
            key={child.name}
            node={child}
            depth={0}
            expanded={expanded}
            onToggle={handleToggle}
            onFileSelect={onFileSelect}
          />
        ))}
      </div>
    </div>
  );
}

export default DirectoryTree;
