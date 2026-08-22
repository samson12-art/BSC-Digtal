import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import { BarChart3, Users, Building2, Target, TrendingUp, ClipboardCheck, ArrowRight, FileText } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { perspectives, getAchievementPercentage, formatNumber, formatCurrency } from '../lib/utils';

export default function ExecutiveDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/executive').then(res => setData(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;
  if (!data) return null;

  const perspectiveData = Object.entries(data.byPerspective).map(([key, val]) => ({
    perspective: perspectives.find(p => p.value === key)?.label || key,
    achievement: val.avgAchievement,
    count: val.count,
    budget: val.totalBudget,
    fullMark: 100
  }));

  const statusPieData = Object.entries(data.statusBreakdown).map(([key, val]) => ({
    name: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
    value: val,
  })).filter(d => d.value > 0);

  const statusColors = ['#9ca3af', '#3b82f6', '#f59e0b', '#f97316', '#16a34a', '#dc2626', '#059669'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
        <p className="text-sm text-gray-500">Organization-wide strategic performance overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Plans" value={data.totalPlans} icon={FileText} color="blue" subtitle="Organization BSC plans" />
        <StatCard title="Achievement" value={`${data.overallAchievement}%`} icon={Target} color="primary" subtitle="Overall KPI achievement" />
        <StatCard title="Employees" value={data.totalEmployees} icon={Users} color="purple" subtitle="Active employees" />
        <StatCard title="Departments" value={data.totalDepartments} icon={Building2} color="teal" subtitle="Operating departments" />
        <StatCard title="Final Approved" value={data.statusBreakdown.FINAL_APPROVED || 0} icon={TrendingUp} color="green" subtitle="Fully approved plans" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-4">KPI Achievement by Perspective</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={perspectiveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="perspective" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(val) => [`${val}%`, 'Achievement']} />
              <Bar dataKey="achievement" fill="#1e3a5f" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Plan Status Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                {statusPieData.map((_, i) => <Cell key={i} fill={statusColors[i % statusColors.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-4 max-h-32 overflow-y-auto">
            {statusPieData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColors[i] }} />
                  <span className="text-gray-600">{d.name}</span>
                </div>
                <span className="font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Department Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="table-header"><th className="px-6 py-3">Department</th><th className="px-6 py-3 text-center">Employees</th><th className="px-6 py-3 text-center">Plans</th><th className="px-6 py-3 text-center">Achievement</th><th className="px-6 py-3 text-center">Progress</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.byDepartment.map(dept => (
                <tr key={dept.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{dept.name}</td>
                  <td className="table-cell text-center">{dept.employeeCount}</td>
                  <td className="table-cell text-center">{dept.totalPlans}</td>
                  <td className="table-cell text-center">
                    <span className={`font-bold ${dept.avgAchievement >= 90 ? 'text-green-600' : dept.avgAchievement >= 70 ? 'text-blue-600' : dept.avgAchievement >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{dept.avgAchievement}%</span>
                  </td>
                  <td className="table-cell">
                    <div className="w-32">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="rounded-full h-2 transition-all" style={{ width: `${Math.min(dept.avgAchievement, 100)}%`, backgroundColor: dept.avgAchievement >= 90 ? '#16a34a' : dept.avgAchievement >= 70 ? '#2563eb' : dept.avgAchievement >= 50 ? '#f59e0b' : '#dc2626' }} />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Recent Activity</h3>
          <Link to="/plans" className="text-sm text-primary-800 hover:text-primary-700 flex items-center gap-1">View All <ArrowRight size={14} /></Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="table-header"><th className="px-6 py-3">Plan</th><th className="px-6 py-3">Owner</th><th className="px-6 py-3">Department</th><th className="px-6 py-3">Perspective</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Updated</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.recentActivity.map(plan => (
                <tr key={plan.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/plans/${plan.id}`}>
                  <td className="table-cell font-medium max-w-xs truncate">{plan.title}</td>
                  <td className="table-cell">{plan.owner.firstName} {plan.owner.lastName}</td>
                  <td className="table-cell">{plan.department?.name || '-'}</td>
                  <td className="table-cell"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium`}>{plan.perspective.replace(/_/g, ' ')}</span></td>
                  <td className="table-cell"><StatusBadge status={plan.status} /></td>
                  <td className="table-cell text-xs text-gray-500">{new Date(plan.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
