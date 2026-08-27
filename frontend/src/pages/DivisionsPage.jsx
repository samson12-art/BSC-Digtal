import { useEffect, useState } from 'react';
import { Building2, Edit, GitBranch, Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';

export default function DivisionsPage() {
  const { user } = useAuth();
  const [divisions, setDivisions] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', departmentId: '' });

  const fetchData = async () => {
    try {
      const [divisionRes, departmentRes] = await Promise.all([api.get('/divisions'), api.get('/departments')]);
      setDivisions(divisionRes.data);
      setDepartments(departmentRes.data);
    } catch (error) { toast.error(error.response?.data?.error || 'Unable to load divisions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const availableDepartments = user?.role === 'CEO' ? departments : departments.filter(d => d.id === user?.departmentId);
  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', departmentId: user?.role === 'CEO' ? '' : user?.departmentId || '' });
    setShowModal(true);
  };
  const openEdit = division => {
    setEditing(division);
    setForm({ name: division.name, description: division.description || '', departmentId: division.departmentId });
    setShowModal(true);
  };
  const submit = async event => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (editing) await api.put(`/divisions/${editing.id}`, { name: form.name, description: form.description });
      else await api.post('/divisions', form);
      toast.success(editing ? 'Division updated' : 'Division created');
      setShowModal(false);
      fetchData();
    } catch (error) { toast.error(error.response?.data?.error || 'Could not save division'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;
  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div><h1 className="text-2xl font-bold text-gray-900">Divisions</h1><p className="text-sm text-gray-500">Manage divisions within each department ({divisions.length})</p></div>
      <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={18} />Add Division</button>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {divisions.map(division => <div key={division.id} className="card hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between mb-3"><div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center"><GitBranch size={22} className="text-primary-800" /></div><button onClick={() => openEdit(division)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit size={16} className="text-gray-500" /></button></div>
        <h2 className="text-lg font-semibold text-gray-900">{division.name}</h2>
        <p className="flex gap-1 items-center mt-1 text-sm text-primary-700"><Building2 size={14} />{division.department?.name}</p>
        <p className="text-sm text-gray-500 mt-3 mb-4 line-clamp-2">{division.description || 'No description'}</p>
        <div className="border-t pt-3 text-sm text-gray-600 flex gap-1 items-center"><Users size={14} />{division._count?.employees || 0} employees</div>
      </div>)}
      {!divisions.length && <div className="col-span-full card text-center py-12 text-gray-500">No divisions have been created yet.</div>}
    </div>
    <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Division' : 'Create Division'}>
      <form onSubmit={submit} className="space-y-4">
        {!editing && <div><label className="label">Department *</label><select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className="input-field" required disabled={user?.role !== 'CEO'}><option value="">Select department</option>{availableDepartments.map(department => <option key={department.id} value={department.id}>{department.name}</option>)}</select></div>}
        <div><label className="label">Division Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" required placeholder="e.g. Corporate Claims Division" /></div>
        <div><label className="label">Description</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="input-field" rows={3} /></div>
        <div className="flex justify-end gap-3 pt-4 border-t"><button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button><button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button></div>
      </form>
    </Modal>
  </div>;
}
