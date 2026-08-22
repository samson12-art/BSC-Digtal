export const perspectives = [
  { value: 'FINANCIAL', label: 'Financial', color: '#3b82f6', icon: 'DollarSign' },
  { value: 'CUSTOMER', label: 'Customer', color: '#8b5cf6', icon: 'Users' },
  { value: 'INTERNAL_BUSINESS_PROCESS', label: 'Internal Business Process', color: '#f59e0b', icon: 'Settings' },
  { value: 'LEARNING_AND_GROWTH', label: 'Learning and Growth', color: '#10b981', icon: 'BookOpen' }
];

export const statuses = [
  { value: 'DRAFT', label: 'Draft', color: 'gray' },
  { value: 'SUBMITTED', label: 'Submitted', color: 'blue' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: 'yellow' },
  { value: 'RETURNED_FOR_REVISION', label: 'Returned for Revision', color: 'orange' },
  { value: 'APPROVED', label: 'Approved', color: 'green' },
  { value: 'REJECTED', label: 'Rejected', color: 'red' },
  { value: 'FINAL_APPROVED', label: 'Final Approved', color: 'emerald' }
];

export const roles = [
  { value: 'BOARD_MEMBER', label: 'Board of Directors' },
  { value: 'CEO', label: 'Chief Executive Officer' },
  { value: 'EXECUTIVE_MANAGER', label: 'Executive Manager' },
  { value: 'DEPARTMENT_MANAGER', label: 'Department Manager' },
  { value: 'TEAM_LEADER', label: 'Team Leader' },
  { value: 'EMPLOYEE', label: 'Employee' }
];

export const roleColors = {
  BOARD_MEMBER: 'bg-purple-100 text-purple-800',
  CEO: 'bg-red-100 text-red-800',
  EXECUTIVE_MANAGER: 'bg-blue-100 text-blue-800',
  DEPARTMENT_MANAGER: 'bg-green-100 text-green-800',
  TEAM_LEADER: 'bg-amber-100 text-amber-800',
  EMPLOYEE: 'bg-gray-100 text-gray-800'
};

export function getStatusBadgeClass(status) {
  const map = {
    DRAFT: 'badge-draft', SUBMITTED: 'badge-submitted', UNDER_REVIEW: 'badge-review',
    RETURNED_FOR_REVISION: 'badge-return', APPROVED: 'badge-approved',
    REJECTED: 'badge-rejected', FINAL_APPROVED: 'badge-final'
  };
  return map[status] || 'badge-draft';
}

export function getStatusLabel(status) {
  return statuses.find(s => s.value === status)?.label || status;
}

export function getPerspectiveColor(perspective) {
  return perspectives.find(p => p.value === perspective)?.color || '#6b7280';
}

export function getPerspectiveLabel(perspective) {
  return perspectives.find(p => p.value === perspective)?.label || perspective;
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'ETB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount || 0);
}

export function formatNumber(num) {
  return new Intl.NumberFormat('en-US').format(num || 0);
}

export function getAchievementPercentage(actual, target) {
  if (!target || target === 0) return 0;
  return Math.min(Math.round((actual / target) * 100), 150);
}

export function getAchievementColor(percentage) {
  if (percentage >= 90) return '#16a34a';
  if (percentage >= 70) return '#2563eb';
  if (percentage >= 50) return '#f59e0b';
  return '#dc2626';
}
