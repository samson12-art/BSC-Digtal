export default function StatCard({ title, value, subtitle, icon: Icon, color = 'primary', trend, className = '' }) {
  const colors = { primary: 'bg-[#e6f2f0] text-[#136f63] border-[#dfe7e4]', green: 'bg-green-50 text-green-700 border-green-200', blue: 'bg-blue-50 text-blue-700 border-blue-200', amber: 'bg-amber-50 text-amber-700 border-amber-200', red: 'bg-red-50 text-red-700 border-red-200', purple: 'bg-purple-50 text-purple-700 border-purple-200', teal: 'bg-teal-50 text-teal-700 border-teal-200' };
  return (
    <div className={`card flex items-start justify-between ${className}`}>
      <div className="flex-1">
        <p className="text-sm font-medium" style={{color:'#6c7774'}}>{title}</p>
        <p className="text-2xl font-bold mt-1" style={{color:'#17211f'}}>{value}</p>
        {subtitle && <p className="text-xs mt-1" style={{color:'#6c7774'}}>{subtitle}</p>}
        {trend && <div className={`text-xs mt-2 font-medium ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>{trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%</div>}
      </div>
      {Icon && <div className={`p-3 rounded-xl border ${colors[color]}`}><Icon size={22} /></div>}
    </div>
  );
}
