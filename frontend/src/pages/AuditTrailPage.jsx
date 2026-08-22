import { useState, useEffect } from 'react';
import api from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Search } from 'lucide-react';

export default function AuditTrailPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    try { const res = await api.get('/audit'); setLogs(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const getActionColor = (action) => {
    const colors = { CREATE_PLAN: 'bg-blue-100 text-blue-700', UPDATE_PLAN: 'bg-amber-100 text-amber-700', SUBMIT_PLAN: 'bg-indigo-100 text-indigo-700', APPROVE_PLAN: 'bg-green-100 text-green-700', REJECT_PLAN: 'bg-red-100 text-red-700', RETURN_PLAN: 'bg-orange-100 text-orange-700', LOGIN: 'bg-gray-100 text-gray-700', CREATE_USER: 'bg-purple-100 text-purple-700', UPDATE_USER: 'bg-cyan-100 text-cyan-700' };
    return colors[action] || 'bg-gray-100 text-gray-700';
  };

  const filtered = logs.filter(l => {
    const matchSearch = !search || l.userName?.toLowerCase().includes(search.toLowerCase()) || l.action?.toLowerCase().includes(search.toLowerCase()) || l.entity?.toLowerCase().includes(search.toLowerCase());
    const matchAction = !filterAction || l.action === filterAction;
    return matchSearch && matchAction;
  });

  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1><p className="text-sm text-gray-500">Track all system activities and changes ({logs.length} entries)</p></div>
      <div className="card">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="flex-1 relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search audit logs..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" /></div>
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)} className="input-field w-auto"><option value="">All Actions</option>{uniqueActions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="table-header"><th className="px-6 py-3">Timestamp</th><th className="px-6 py-3">User</th><th className="px-6 py-3">Action</th><th className="px-6 py-3">Entity</th><th className="px-6 py-3">Entity ID</th><th className="px-6 py-3">Details</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="table-cell text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="table-cell font-medium text-sm">{log.userName}</td>
                  <td className="table-cell"><span className={`badge ${getActionColor(log.action)}`}>{log.action?.replace(/_/g, ' ')}</span></td>
                  <td className="table-cell text-sm">{log.entity}</td>
                  <td className="table-cell text-xs text-gray-400 font-mono max-w-[120px] truncate">{log.entityId}</td>
                  <td className="table-cell text-xs text-gray-500 max-w-[200px] truncate">{log.details ? JSON.stringify(log.details) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} of {logs.length} entries</div>
      </div>
    </div>
  );
}
