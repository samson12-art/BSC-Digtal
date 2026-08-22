import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';
import PerspectiveBadge from '../components/PerspectiveBadge';
import ProgressBar from '../components/ProgressBar';
import { perspectives, formatNumber, getAchievementPercentage } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Download, FileDown, BarChart3, Building2, FileText, Users, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('corporate');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');

  useEffect(() => { api.get('/departments').then(res => setDepartments(res.data)); }, []);
  useEffect(() => { loadReport(); }, [activeTab, selectedDept]);

  const loadReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'corporate') {
        const res = await api.get('/reports/corporate');
        setReportData(res.data);
      } else if (activeTab === 'department' && selectedDept) {
        const res = await api.get(`/reports/department/${selectedDept}`);
        setReportData(res.data);
      } else if (activeTab === 'individual') {
        const res = await api.get(`/reports/individual/${user.id}`);
        setReportData(res.data);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleExport = async (type) => {
    try {
      const res = await api.get(`/reports/excel/${type}/${activeTab === 'individual' ? user.id : activeTab === 'department' ? selectedDept : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a'); link.href = url;
      link.setAttribute('download', `bsc-${activeTab}-report.xlsx`);
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('Report downloaded');
    } catch (err) { toast.error('Export failed'); }
  };

  const handlePdfExport = async (type) => {
    try {
      const res = await api.get(`/reports/pdf/${type}/${activeTab === 'individual' ? user.id : activeTab === 'department' ? selectedDept : ''}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url;
      link.setAttribute('download', `bsc-${activeTab}-report.pdf`);
      document.body.appendChild(link); link.click(); link.remove();
      toast.success('PDF report downloaded');
    } catch (err) { toast.error('PDF export failed'); }
  };

  const tabs = [
    { id: 'corporate', label: 'Corporate Scorecard', icon: BarChart3 },
    { id: 'department', label: 'Department Scorecard', icon: Building2 },
    { id: 'individual', label: 'Individual Performance', icon: Users },
  ];

  const chartColors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1><p className="text-sm text-gray-500">Generate and export BSC performance reports</p></div>
        <div className="flex gap-2">
          <button onClick={() => handleExport(activeTab)} className="btn-primary flex items-center gap-2"><Download size={16} />Export to Excel</button>
          <button onClick={() => handlePdfExport(activeTab)} className="btn-secondary flex items-center gap-2"><FileDown size={16} />Export to PDF</button>
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${activeTab === tab.id ? 'bg-white text-primary-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <tab.icon size={16} />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'department' && (
        <div className="flex items-center gap-3">
          <Filter size={16} className="text-gray-500" />
          <select value={selectedDept} onChange={e => setSelectedDept(e.target.value)} className="input-field w-auto">
            <option value="">Select Department</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}

      {loading ? <LoadingSpinner className="h-64" size="lg" /> : reportData ? (
        <div className="space-y-6">
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-4">
              {activeTab === 'corporate' ? 'Corporate Performance Summary' : activeTab === 'department' ? `Department: ${reportData.department?.name}` : `Individual: ${reportData.user?.firstName} ${reportData.user?.lastName}`}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl text-center"><p className="text-2xl font-bold text-blue-900">{reportData.summary?.totalPlans || 0}</p><p className="text-xs text-blue-600">Total Plans</p></div>
              <div className="p-4 bg-green-50 rounded-xl text-center"><p className="text-2xl font-bold text-green-900">{reportData.summary?.avgAchievement || 0}%</p><p className="text-xs text-green-600">Avg Achievement</p></div>
              <div className="p-4 bg-purple-50 rounded-xl text-center"><p className="text-2xl font-bold text-purple-900">{formatNumber(reportData.summary?.totalBudget || 0)}</p><p className="text-xs text-purple-600">Total Budget (ETB)</p></div>
              {reportData.summary?.approved !== undefined && <div className="p-4 bg-emerald-50 rounded-xl text-center"><p className="text-2xl font-bold text-emerald-900">{reportData.summary.approved}</p><p className="text-xs text-emerald-600">Final Approved</p></div>}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {reportData.byPerspective && (
              <div className="card">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Performance by Perspective</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={Object.entries(reportData.byPerspective).map(([key, val]) => ({
                    name: perspectives.find(p => p.value === key)?.label || key,
                    achievement: val.avgAchievement, count: val.count, budget: val.totalBudget
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="achievement" fill="#1e3a5f" radius={[6, 6, 0, 0]} name="Achievement %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {reportData.byDepartment && (
              <div className="card">
                <h3 className="text-base font-semibold text-gray-900 mb-4">Performance by Department</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={reportData.byDepartment}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="avgAchievement" fill="#d4a843" radius={[6, 6, 0, 0]} name="Achievement %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {reportData.plans && reportData.plans.length > 0 && (
            <div className="card">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Detailed Plans ({reportData.plans.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="table-header">
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Perspective</th>
                    {reportData.user === undefined && <th className="px-4 py-3">Owner</th>}
                    <th className="px-4 py-3">KPI</th>
                    <th className="px-4 py-3 text-right">Target</th>
                    <th className="px-4 py-3 text-right">Actual</th>
                    <th className="px-4 py-3 text-center">Achievement</th>
                    <th className="px-4 py-3">Status</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {reportData.plans.map(plan => (
                      <tr key={plan.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{plan.title}</td>
                        <td className="px-4 py-3"><PerspectiveBadge perspective={plan.perspective} /></td>
                        {reportData.user === undefined && <td className="px-4 py-3 text-sm">{plan.owner?.firstName} {plan.owner?.lastName}</td>}
                        <td className="px-4 py-3 text-sm">{plan.kpiName}</td>
                        <td className="px-4 py-3 text-sm text-right">{formatNumber(plan.target)}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">{formatNumber(plan.actualResult)}</td>
                        <td className="px-4 py-3"><div className="w-24 mx-auto"><ProgressBar percentage={plan.achievementPercentage || getAchievementPercentage(plan.actualResult, plan.target)} showLabel={false} size="sm" /></div></td>
                        <td className="px-4 py-3"><StatusBadge status={plan.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'department' && !selectedDept ? (
        <div className="card text-center py-12"><p className="text-gray-500">Select a department to view its scorecard</p></div>
      ) : null}
    </div>
  );
}
