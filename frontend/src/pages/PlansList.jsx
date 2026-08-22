import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import PerspectiveBadge from '../components/PerspectiveBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { Plus, Search, Filter, FileText, Download } from 'lucide-react';
import { perspectives, statuses, formatNumber } from '../lib/utils';

export default function PlansList() {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPerspective, setFilterPerspective] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await api.get('/plans');
      setPlans(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const filteredPlans = plans.filter(plan => {
    const matchSearch = !searchTerm || plan.title.toLowerCase().includes(searchTerm.toLowerCase()) || plan.kpiName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchPerspective = !filterPerspective || plan.perspective === filterPerspective;
    const matchStatus = !filterStatus || plan.status === filterStatus;
    return matchSearch && matchPerspective && matchStatus;
  });

  const handleExport = async (type) => {
    try {
      const res = await api.get(`/reports/excel/${type}/${type === 'individual' ? user.id : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bsc-${type}-report.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) { console.error(err); }
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">BSC Plans</h1><p className="text-sm text-gray-500">Manage balanced scorecard plans</p></div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleExport('individual')} className="btn-secondary flex items-center gap-2 text-sm"><Download size={16} />Export</button>
          <Link to="/plans/new" className="btn-primary flex items-center gap-2"><Plus size={18} />New Plan</Link>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search plans by title or KPI..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="input-field pl-10" />
          </div>
          <select value={filterPerspective} onChange={e => setFilterPerspective(e.target.value)} className="input-field w-auto">
            <option value="">All Perspectives</option>
            {perspectives.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field w-auto">
            <option value="">All Statuses</option>
            {statuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        {filteredPlans.length === 0 ? (
          <EmptyState icon={FileText} title="No plans found" description="Create your first BSC plan to get started" action={<Link to="/plans/new" className="btn-primary">Create Plan</Link>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-6 py-3">Plan Title</th>
                  <th className="px-6 py-3">Owner</th>
                  <th className="px-6 py-3">Perspective</th>
                  <th className="px-6 py-3">KPI</th>
                  <th className="px-6 py-3 text-right">Target</th>
                  <th className="px-6 py-3 text-right">Actual</th>
                  <th className="px-6 py-3 text-center">Weight</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Version</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPlans.map(plan => (
                  <tr key={plan.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => window.location.href = `/plans/${plan.id}`}>
                    <td className="table-cell">
                      <div className="font-medium text-gray-900">{plan.title}</div>
                      {plan.department && <div className="text-xs text-gray-500">{plan.department.name}</div>}
                    </td>
                    <td className="table-cell text-sm">{plan.owner?.firstName} {plan.owner?.lastName}</td>
                    <td className="table-cell"><PerspectiveBadge perspective={plan.perspective} /></td>
                    <td className="table-cell text-sm">{plan.kpiName}</td>
                    <td className="table-cell text-right font-medium">{formatNumber(plan.target)}</td>
                    <td className="table-cell text-right font-medium">{formatNumber(plan.actualResult)}</td>
                    <td className="table-cell text-center text-sm">{plan.weight}%</td>
                    <td className="table-cell"><StatusBadge status={plan.status} /></td>
                    <td className="table-cell text-xs text-gray-500">v{plan.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-4 text-sm text-gray-500">Showing {filteredPlans.length} of {plans.length} plans</div>
      </div>
    </div>
  );
}
