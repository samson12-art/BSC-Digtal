import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { perspectives } from '../lib/utils';
import toast from 'react-hot-toast';
import { Save, ArrowLeft, FileText } from 'lucide-react';

export default function PlanCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState({
    title: '', description: '', perspective: 'FINANCIAL', strategicObjective: '', kpiName: '', kpiFormula: '', measurementUnit: '',
    baseline: '', target: '', actualResult: '', weight: '', objectiveNumber: '', strategicTheme: '', planYear: new Date().getFullYear(), monthlyTargets: {}, strategicInitiative: '', budget: '',
    startDate: '', endDate: '', departmentId: user?.departmentId || '', parentPlanId: ''
  });

  useEffect(() => { api.get('/departments').then(res => setDepartments(res.data)); }, []);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const months = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
  const handleMonthChange = (month, value) => setForm(prev => ({ ...prev, monthlyTargets: { ...prev.monthlyTargets, [month]: value } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.post('/plans', form);
      toast.success('Plan created successfully');
      navigate(`/plans/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create plan');
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <div><h1 className="text-2xl font-bold text-gray-900">Create BSC Plan</h1><p className="text-sm text-gray-500">Define a new balanced scorecard plan</p></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><FileText size={20} />Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label">Plan Title *</label><input name="title" value={form.title} onChange={handleChange} className="input-field" required placeholder="Enter plan title" /></div>
            <div className="md:col-span-2"><label className="label">Description</label><textarea name="description" value={form.description} onChange={handleChange} className="input-field" rows={3} placeholder="Describe the plan" /></div>
            <div><label className="label">BSC Perspective *</label><select name="perspective" value={form.perspective} onChange={handleChange} className="input-field" required>{perspectives.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
            <div><label className="label">Department</label><select name="departmentId" value={form.departmentId} onChange={handleChange} className="input-field"><option value="">Select department</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="label">Objective No.</label><input name="objectiveNumber" value={form.objectiveNumber} onChange={handleChange} className="input-field" placeholder="e.g., 1.1.17" /></div>
            <div><label className="label">Plan Year</label><input name="planYear" type="number" min="2000" value={form.planYear} onChange={handleChange} className="input-field" /></div>
            <div className="md:col-span-2"><label className="label">Strategic Theme</label><input name="strategicTheme" value={form.strategicTheme} onChange={handleChange} className="input-field" placeholder="e.g., Growth and Expansion" /></div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Monthly Targets</h3>
          <p className="text-sm text-gray-500 mb-4">Enter the July-to-June plan values used in the annual Excel layout.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {months.map(month => <div key={month}><label className="label">{month}</label><input type="number" step="any" value={form.monthlyTargets[month] || ''} onChange={e => handleMonthChange(month, e.target.value)} className="input-field" /></div>)}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Strategic Objectives & KPIs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label">Strategic Objective *</label><textarea name="strategicObjective" value={form.strategicObjective} onChange={handleChange} className="input-field" rows={2} required placeholder="What strategic goal does this plan support?" /></div>
            <div><label className="label">KPI Name *</label><input name="kpiName" value={form.kpiName} onChange={handleChange} className="input-field" required placeholder="Key Performance Indicator" /></div>
            <div><label className="label">Measurement Unit</label><input name="measurementUnit" value={form.measurementUnit} onChange={handleChange} className="input-field" placeholder="e.g., %, ETB, Hours, Count" /></div>
            <div><label className="label">KPI Formula</label><input name="kpiFormula" value={form.kpiFormula} onChange={handleChange} className="input-field" placeholder="e.g., (Actual/Target)*100" /></div>
            <div><label className="label">Baseline Value</label><input name="baseline" type="number" step="any" value={form.baseline} onChange={handleChange} className="input-field" placeholder="Starting point" /></div>
            <div><label className="label">Target Value *</label><input name="target" type="number" step="any" value={form.target} onChange={handleChange} className="input-field" required placeholder="Target to achieve" /></div>
            <div><label className="label">Actual Result</label><input name="actualResult" type="number" step="any" value={form.actualResult} onChange={handleChange} className="input-field" placeholder="Current actual value" /></div>
            <div><label className="label">Weight (%) *</label><input name="weight" type="number" min="0" max="100" value={form.weight} onChange={handleChange} className="input-field" required placeholder="Weight in percentage" /></div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Initiatives & Budget</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label">Strategic Initiatives</label><textarea name="strategicInitiative" value={form.strategicInitiative} onChange={handleChange} className="input-field" rows={3} placeholder="Describe the initiatives to achieve this objective" /></div>
            <div><label className="label">Budget (ETB)</label><input name="budget" type="number" step="any" value={form.budget} onChange={handleChange} className="input-field" placeholder="Allocated budget" /></div>
            <div><label className="label">Parent Plan</label><input name="parentPlanId" value={form.parentPlanId} onChange={handleChange} className="input-field" placeholder="Parent plan ID (optional)" /></div>
            <div><label className="label">Start Date</label><input name="startDate" type="date" value={form.startDate} onChange={handleChange} className="input-field" /></div>
            <div><label className="label">End Date</label><input name="endDate" type="date" value={form.endDate} onChange={handleChange} className="input-field" /></div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            {loading ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Save size={16} />}
            Create Plan
          </button>
        </div>
      </form>
    </div>
  );
}
