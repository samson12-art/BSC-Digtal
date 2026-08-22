import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import StatCard from '../components/StatCard';
import StatusBadge from '../components/StatusBadge';
import PerspectiveBadge from '../components/PerspectiveBadge';
import ProgressBar from '../components/ProgressBar';
import LoadingSpinner from '../components/LoadingSpinner';
import { Users, ClipboardCheck, Target, FileText, ArrowRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { getAchievementPercentage, formatNumber } from '../lib/utils';

export default function ManagerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/manager').then(res => setData(res.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Team Dashboard</h1><p className="text-sm text-gray-500">Monitor team performance and pending approvals</p></div>
        <Link to="/reviews" className="btn-primary flex items-center gap-2"><ClipboardCheck size={18} />Review Plans ({data.pendingReviews})</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Team Plans" value={data.totalPlans} icon={FileText} color="blue" subtitle="Total team BSC plans" />
        <StatCard title="Pending Reviews" value={data.pendingReviews} icon={Clock} color="amber" subtitle="Awaiting your review" />
        <StatCard title="Team Size" value={data.teamSize} icon={Users} color="purple" subtitle="Active team members" />
        <StatCard title="Team Achievement" value={`${data.overallAchievement}%`} icon={Target} color="teal" subtitle="Average performance" />
      </div>

      {data.pendingReviewPlans && data.pendingReviewPlans.length > 0 && (
        <div className="card border-l-4 border-amber-400">
          <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2"><AlertCircle size={18} className="text-amber-500" />Plans Pending Your Review</h3>
          <div className="space-y-3">
            {data.pendingReviewPlans.map(plan => (
              <Link key={plan.id} to={`/plans/${plan.id}`} className="flex items-center justify-between p-3 rounded-lg border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center"><FileText size={18} className="text-amber-700" /></div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">{plan.title}</h4>
                    <p className="text-xs text-gray-500">By {plan.owner.firstName} {plan.owner.lastName} · {plan.department?.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <PerspectiveBadge perspective={plan.perspective} />
                  <StatusBadge status={plan.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Team Member Performance</h3>
        {data.performanceByMember && data.performanceByMember.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.performanceByMember}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="lastName" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="avgAchievement" fill="#1e3a5f" radius={[6, 6, 0, 0]} name="Achievement %" />
              <Bar dataKey="totalPlans" fill="#d4a843" radius={[6, 6, 0, 0]} name="Plans" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">No team members found</p>
        )}
      </div>

      {data.recentPlans && data.recentPlans.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Recent Team Plans</h3>
            <Link to="/plans" className="text-sm text-primary-800 hover:text-primary-700 flex items-center gap-1">View All <ArrowRight size={14} /></Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="table-header"><th className="px-6 py-3">Plan</th><th className="px-6 py-3">Owner</th><th className="px-6 py-3">Perspective</th><th className="px-6 py-3">Achievement</th><th className="px-6 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentPlans.map(plan => (
                  <tr key={plan.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.location.href = `/plans/${plan.id}`}>
                    <td className="table-cell font-medium">{plan.title}</td>
                    <td className="table-cell">{plan.owner.firstName} {plan.owner.lastName}</td>
                    <td className="table-cell"><PerspectiveBadge perspective={plan.perspective} /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <ProgressBar percentage={getAchievementPercentage(plan.actualResult, plan.target)} showLabel={false} size="sm" className="w-20" />
                        <span className="text-xs font-medium">{getAchievementPercentage(plan.actualResult, plan.target)}%</span>
                      </div>
                    </td>
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
