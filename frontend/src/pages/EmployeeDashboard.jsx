import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import PerspectiveBadge from '../components/PerspectiveBadge';
import ProgressBar from '../components/ProgressBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { FileText, Target, TrendingUp, Clock, ArrowRight, Plus, Users } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { perspectives, getAchievementPercentage, formatNumber } from '../lib/utils';

export default function EmployeeDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/employee').then(res => setData(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;
  if (!data) return null;

  const perspectiveData = perspectives.map(p => ({
    name: p.label,
    value: data.byPerspective[p.value]?.count || 0,
    achievement: data.byPerspective[p.value]?.avgAchievement || 0,
    color: p.color
  })).filter(d => d.value > 0);

  const statusData = [
    { name: 'Draft', value: data.draftPlans, color: '#9ca3af' },
    { name: 'Pending', value: data.pendingPlans, color: '#3b82f6' },
    { name: 'Approved', value: data.approvedPlans, color: '#16a34a' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1><p className="text-sm text-gray-500">Track your personal KPI performance</p></div>
        <Link to="/plans/new" className="btn-primary flex items-center gap-2"><Plus size={18} />New Plan</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="My Plans" value={data.totalPlans} icon={FileText} color="blue" subtitle="Plans I own" />
        <StatCard title="Avg Achievement" value={`${data.avgAchievement}%`} icon={Target} color="primary" subtitle="My plans average" />
        <StatCard title="Team Contributions" value={data.totalContributedPlans || 0} icon={Users} color="purple" subtitle="Plans I help deliver" />
        <StatCard title="Approved" value={data.approvedPlans} icon={TrendingUp} color="green" subtitle="Successfully approved" />
        <StatCard title="Pending" value={data.pendingPlans} icon={Clock} color="amber" subtitle="Awaiting approval" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Performance by Perspective</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={perspectiveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="achievement" fill="#1e3a5f" radius={[6, 6, 0, 0]} name="Achievement %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Plan Status</h3>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data</div>
          )}
          <div className="space-y-2 mt-2">
            {statusData.map(d => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{backgroundColor: d.color}} /><span>{d.name}</span></div>
                <span className="font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {data.contributedPlans && data.contributedPlans.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Team Plans I Contribute To</h3>
            <span className="text-sm text-purple-600 font-medium">Weighted Score: {data.totalContributionScore}%</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header">
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Perspective</th>
                <th className="px-4 py-3 text-center">My Weight</th>
                <th className="px-4 py-3 text-center">Achievement</th>
                <th className="px-4 py-3 text-center">My Score</th>
                <th className="px-4 py-3">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.contributedPlans.map(plan => (
                  <tr key={plan.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/plans/${plan.id}`}>
                    <td className="table-cell font-medium">{plan.title}</td>
                    <td className="table-cell text-sm">{plan.ownerName}</td>
                    <td className="table-cell"><PerspectiveBadge perspective={plan.perspective} /></td>
                    <td className="table-cell text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{plan.myContributionPct}%</span>
                    </td>
                    <td className="table-cell text-center">
                      <div className="w-20 mx-auto"><ProgressBar percentage={plan.achievementPercentage} showLabel={false} size="sm" /></div>
                    </td>
                    <td className="table-cell text-center font-medium">{plan.myWeightedScore}%</td>
                    <td className="table-cell"><StatusBadge status={plan.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {Object.entries(data.byPerspective).map(([key, persp]) => {
          if (!persp.plans || persp.plans.length === 0) return null;
          const p = perspectives.find(x => x.value === key);
          return (
            <div key={key} className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold" style={{color: p?.color}}>{p?.label}</h3>
                <span className="text-sm text-gray-500">{persp.plans.length} plans</span>
              </div>
              <div className="space-y-4">
                {persp.plans.slice(0, 3).map(plan => (
                  <Link key={plan.id} to={`/plans/${plan.id}`} className="block p-3 rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 truncate flex-1">{plan.title}</h4>
                      <StatusBadge status={plan.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span>KPI: {plan.kpiName}</span>
                      <span>{formatNumber(plan.actualResult)} / {formatNumber(plan.target)}</span>
                    </div>
                    <ProgressBar percentage={getAchievementPercentage(plan.actualResult, plan.target)} size="sm" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {data.recentPlans && data.recentPlans.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Recent Plans</h3>
            <Link to="/plans" className="text-sm text-primary-800 hover:text-primary-700 flex items-center gap-1">View All <ArrowRight size={14} /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header"><th className="px-6 py-3">Plan</th><th className="px-6 py-3">Perspective</th><th className="px-6 py-3">Target</th><th className="px-6 py-3">Actual</th><th className="px-6 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentPlans.map(plan => (
                  <tr key={plan.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/plans/${plan.id}`}>
                    <td className="table-cell font-medium">{plan.title}</td>
                    <td className="table-cell"><PerspectiveBadge perspective={plan.perspective} /></td>
                    <td className="table-cell">{formatNumber(plan.target)}</td>
                    <td className="table-cell font-medium">{formatNumber(plan.actualResult)}</td>
                    <td className="table-cell"><StatusBadge status={plan.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
