import { getPerspectiveLabel, getPerspectiveColor } from '../lib/utils';
export default function PerspectiveBadge({ perspective, className = '' }) {
  const color = getPerspectiveColor(perspective);
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`} style={{ backgroundColor: color + '20', color }}>{getPerspectiveLabel(perspective)}</span>;
}
