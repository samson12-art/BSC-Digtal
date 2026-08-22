import { getAchievementColor } from '../lib/utils';
export default function ProgressBar({ percentage, showLabel = true, size = 'md', className = '' }) {
  const color = getAchievementColor(percentage);
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };
  return (
    <div className={className}>
      {showLabel && <div className="flex justify-between items-center mb-1"><span className="text-xs font-medium" style={{color:'#6c7774'}}>Progress</span><span className="text-xs font-bold" style={{ color }}>{Math.min(percentage, 100)}%</span></div>}
      <div className={`w-full bg-gray-200 rounded-full ${heights[size]}`}>
        <div className="rounded-full transition-all duration-700 ease-out" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color, height: '100%' }} />
      </div>
    </div>
  );
}
