const toneClasses = {
  neutral: 'border-hairline text-ink-muted bg-white',
  success: 'border-status-success text-status-success bg-status-successBg',
  warning: 'border-status-warning text-status-warning bg-status-warningBg',
  danger: 'border-status-danger text-status-danger bg-status-dangerBg',
  brass: 'border-brass text-brass-dark bg-brass-light',
};

export default function StampBadge({ tone = 'neutral', children }) {
  return <span className={`stamp-badge ${toneClasses[tone]}`}>{children}</span>;
}