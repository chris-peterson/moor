export function statusColor(status) {
  switch (status) {
    case 'modified': return 'var(--color-left)';
    case 'left-only': return 'var(--color-left)';
    case 'right-only': return 'var(--color-right)';
    case 'identical': return 'var(--text-muted)';
    default: return 'var(--text-secondary)';
  }
}

export function statusLabel(status) {
  switch (status) {
    case 'modified': return 'M';
    case 'left-only': return 'L';
    case 'right-only': return 'R';
    case 'identical': return '=';
    default: return '?';
  }
}
