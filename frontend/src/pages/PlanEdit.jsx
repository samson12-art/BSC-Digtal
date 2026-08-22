import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { perspectives } from '../lib/utils';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { Save, ArrowLeft } from 'lucide-react';

export default function PlanEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', perspective: 'FINANCIAL', strategicObjective: '', kpiName: '', kpiFormula: '', measurementUnit: '',
    baseline: '', target: '', actualResult: '', weight: '', objectiveNumber: '', strategicTheme: '', planYear: new Date().getFullYear(), monthlyTargets: {}, strategicInitiative: '', budget: '', startDate: '', endDate: ''
  });

  useEffect(() => {
    api.get(`/plans/${id}`).then(res => {
      const p = res.data;
      setForm({
        title: p.title || '', description: p.description || '', perspective: p.perspective, strategicObjective: p.strategicObjective || '',
        kpiName: p.kpiName || '', kpiFormula: p.kpiFormula || '', measurementUnit: p.measurementUnit || '', baseline: p.baseline || '', target: p.target || '',
        actualResult: p.actualResult || '', weight: p.weight || '', objectiveNumber: p.objectiveNumber || '', strategicTheme: p.strategicTheme || '', planYear: p.planYear || new Date().getFullYear(), monthlyTargets: p.monthlyTargets || {}, strategicInitiative: p.strategicInitiative || '',
        budget: p.budget || '', startDate: p.startDate ? p.startDate.split('T')[0] : '', endDate: p.endDate ? p.endDate.split('T')[0] : ''
      });
    }).finally(() => setLoading(false));
  }, [id]);

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const months = ['July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March', 'April', 'May', 'June'];
  const handleMonthChange = (month, value) => setForm(prev => ({ ...prev, monthlyTargets: { ...prev.monthlyTargets, [month]: value } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/plans/${id}`, form);
      toast.success('Plan updated successfully');
      navigate(`/plans/${id}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to update plan'); }
    finally { setSaving(false); }
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
        <div><h1 className="text-2xl font-bold text-gray-900">Edit BSC Plan</h1><p className="text-sm text-gray-500">Update plan details and KPI values</p></div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="label">Title *</label><input name="title" value={form.title} onChange={handleChange} className="input-field" required /></div>
            <div className="md:col-span-2"><label className="label">Description</label><textarea name="description" value={form.description} onChange={handleChange} className="input-field" rows={3} /></div>
            <div><label className="label">Perspective *</label><select name="perspective" value={form.perspective} onChange={handleChange} className="input-field" required>{perspectives.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div>
            <div><label className="label">Strategic Objective *</label><input name="strategicObjective" value={form.strategicObjective} onChange={handleChange} className="input-field" required /></div>
            <div><label className="label">KPI Name *</label><input name="kpiName" value={form.kpiName} onChange={handleChange} className="input-field" required /></div>
            <div><label className="label">Measurement Unit</label><input name="measurementUnit" value={form.measurementUnit} onChange={handleChange} className="input-field" placeholder="e.g., %, ETB, Hours" /></div>
            <div><label className="label">KPI Formula</label><input name="kpiFormula" value={form.kpiFormula} onChange={handleChange} className="input-field" /></div>
            <div><label className="label">Baseline</label><input name="baseline" type="number" step="any" value={form.baseline} onChange={handleChange} className="input-field" /></div>
            <div><label className="label">Target *</label><input name="target" type="number" step="any" value={form.target} onChange={handleChange} className="input-field" required /></div>
            <div><label className="label">Actual Result</label><input name="actualResult" type="number" step="any" value={form.actualResult} onChange={handleChange} className="input-field" /></div>
            <div><label className="label">Weight (%) *</label><input name="weight" type="number" min="0" max="100" value={form.weight} onChange={handleChange} className="input-field" required /></div>
            <div><label className="label">Objective No.</label><input name="objectiveNumber" value={form.objectiveNumber} onChange={handleChange} className="input-field" placeholder="e.g., 1.1.17" /></div>
            <div><label className="label">Plan Year</label><input name="planYear" type="number" min="2000" value={form.planYear} onChange={handleChange} className="input-field" /></div>
            <div className="md:col-span-2"><label className="label">Strategic Theme</label><input name="strategicTheme" value={form.strategicTheme} onChange={handleChange} className="input-field" /></div>
            <div><label className="label">Budget (ETB)</label><input name="budget" type="number" step="any" value={form.budget} onChange={handleChange} className="input-field" /></div>
            <div className="md:col-span-2"><label className="label">Strategic Initiatives</label><textarea name="strategicInitiative" value={form.strategicInitiative} onChange={handleChange} className="input-field" rows={3} /></div>
            <div><label className="label">Start Date</label><input name="startDate" type="date" value={form.startDate} onChange={handleChange} className="input-field" /></div>
            <div><label className="label">End Date</label><input name="endDate" type="date" value={form.endDate} onChange={handleChange} className="input-field" /></div>
          </div>
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Monthly Targets</h3>
          <p className="text-sm text-gray-500 mb-4">July-to-June values shown in the annual plan export.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {months.map(month => <div key={month}><label className="label">{month}</label><input type="number" step="any" value={form.monthlyTargets[month] || ''} onChange={e => handleMonthChange(month, e.target.value)} className="input-field" /></div>)}
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Save size={16} />}
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
