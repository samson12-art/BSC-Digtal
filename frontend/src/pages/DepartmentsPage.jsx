import { useState, useEffect } from 'react';
import api from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { Building2, Plus, Edit, Users, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchDepts(); }, []);

  const fetchDepts = async () => {
    try { const res = await api.get('/departments'); setDepartments(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '' }); setShowModal(true); };
  const openEdit = (dept) => { setEditing(dept); setForm({ name: dept.name, description: dept.description || '' }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      if (editing) { await api.put(`/departments/${editing.id}`, form); toast.success('Department updated'); }
      else { await api.post('/departments', form); toast.success('Department created'); }
      setShowModal(false); fetchDepts();
    } catch (err) { toast.error(err.response?.data?.error || 'Operation failed'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Departments</h1><p className="text-sm text-gray-500">Manage organizational departments ({departments.length})</p></div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={18} />Add Department</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.map(dept => (
          <div key={dept.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center"><Building2 size={22} className="text-primary-800" /></div>
              <button onClick={() => openEdit(dept)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit size={16} className="text-gray-500" /></button>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">{dept.name}</h3>
            <p className="text-sm text-gray-500 mb-4 line-clamp-2">{dept.description || 'No description'}</p>
            <div className="flex items-center gap-4 text-sm text-gray-600 border-t pt-3">
              <span className="flex items-center gap-1"><Users size={14} />{dept._count?.employees || 0} employees</span>
              <span className="flex items-center gap-1"><FileText size={14} />{dept._count?.bscPlans || 0} plans</span>
            </div>
          </div>
        ))}
      </div>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Department' : 'Create Department'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Department Name *</label><input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input-field" required placeholder="Enter department name" /></div>
          <div><label className="label">Description</label><textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="input-field" rows={3} placeholder="Describe the department's function" /></div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
