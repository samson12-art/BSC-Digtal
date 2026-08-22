import { getStatusBadgeClass, getStatusLabel } from '../lib/utils';
export default function StatusBadge({ status, className = '' }) {
  return <span className={`badge ${getStatusBadgeClass(status)} ${className}`}>{getStatusLabel(status)}</span>;
}
