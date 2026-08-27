import { useState, useEffect } from 'react';
import api from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { roleColors, roles } from '../lib/utils';
import { Plus, Edit, Search, Check, X, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', password: '', role: 'EMPLOYEE', departmentId: '', divisionId: '', managerId: '', isActive: true, isApproved: true });
  const [allUsers, setAllUsers] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [usersRes, deptRes, divisionRes] = await Promise.all([api.get('/users'), api.get('/departments'), api.get('/divisions')]);
      setUsers(usersRes.data); setAllUsers(usersRes.data); setDepartments(deptRes.data); setDivisions(divisionRes.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditingUser(null); setForm({ firstName: '', lastName: '', email: '', phone: '', password: 'Password123!', role: 'EMPLOYEE', departmentId: currentUser?.role === 'CEO' ? '' : currentUser?.departmentId || '', divisionId: '', managerId: '', isActive: true, isApproved: true }); setShowModal(true); };

  const openEdit = (user) => { setEditingUser(user); setForm({ firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone || '', password: '', role: user.role, departmentId: user.departmentId || '', divisionId: user.divisionId || '', managerId: user.managerId || '', isActive: user.isActive, isApproved: user.isApproved }); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      if (editingUser) { const data = { ...form }; if (!data.password) delete data.password; await api.put(`/users/${editingUser.id}`, data); toast.success('User updated'); }
      else { const res = await api.post('/users', form); toast.success(res.data?.smsSent ? 'User created - SMS notification sent' : 'User created'); }
      setShowModal(false); fetchData();
    } catch (err) { toast.error(err.response?.data?.error || 'Operation failed'); }
    finally { setSubmitting(false); }
  };

  const filtered = users.filter(u => {
    const matchSearch = !search || `${u.firstName} ${u.lastName} ${u.email} ${u.phone || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = !filterRole || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const allowedRoles = currentUser?.role === 'CEO'
    ? roles
    : currentUser?.role === 'EXECUTIVE_MANAGER'
      ? roles.filter(role => ['DEPARTMENT_MANAGER', 'DIVISION_MANAGER', 'EMPLOYEE'].includes(role.value))
      : currentUser?.role === 'DEPARTMENT_MANAGER' ? roles.filter(role => ['DIVISION_MANAGER', 'EMPLOYEE'].includes(role.value)) : roles.filter(role => role.value === 'EMPLOYEE');
  const canManageUsers = ['CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'DIVISION_MANAGER'].includes(currentUser?.role);
  const availableDepartments = currentUser?.role === 'CEO'
    ? departments
    : departments.filter(department => department.id === currentUser?.departmentId);
  const availableDivisions = divisions.filter(division => division.departmentId === form.departmentId);
  const canEditUser = (target) => currentUser?.role === 'CEO'
    || (currentUser?.role === 'EXECUTIVE_MANAGER'
      && ['DEPARTMENT_MANAGER', 'DIVISION_MANAGER', 'EMPLOYEE'].includes(target.role)
      && target.departmentId === currentUser.departmentId)
    || (currentUser?.role === 'DEPARTMENT_MANAGER'
      && ['DIVISION_MANAGER', 'EMPLOYEE'].includes(target.role)
      && target.departmentId === currentUser.departmentId)
    || (currentUser?.role === 'DIVISION_MANAGER'
      && target.role === 'EMPLOYEE'
      && target.departmentId === currentUser.departmentId);
  const removeUser = async (target) => {
    if (!window.confirm(`Remove ${target.firstName} ${target.lastName}? Their account will be deactivated and can be restored later.`)) return;
    try { await api.delete(`/users/${target.id}`); toast.success('User removed and deactivated'); fetchData(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not remove user'); }
  };
  const updateApproval = async (target, approved) => {
    const action = approved ? 'approve' : 'reject';
    if (!approved && !window.confirm(`Reject ${target.firstName} ${target.lastName}? Their account will be deactivated.`)) return;
    try {
      await api.put(`/users/${target.id}`, approved ? { isApproved: true } : { isActive: false, isApproved: false });
      toast.success(approved ? 'Employee approved' : 'Employee rejected and deactivated');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.error || `Could not ${action} employee`); }
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div><h1 className="text-2xl font-bold text-gray-900">User Management</h1><p className="text-sm text-gray-500">Manage system users and roles ({users.length} users)</p></div>
        {canManageUsers && <button onClick={openCreate} className="btn-primary flex items-center gap-2"><Plus size={18} />Add User</button>}
      </div>
      <div className="card">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="flex-1 relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="text" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="input-field pl-10" /></div>
          <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="input-field w-auto"><option value="">All Roles</option>{roles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="table-header"><th className="px-6 py-3">User</th><th className="px-6 py-3">Role</th><th className="px-6 py-3">Department</th><th className="px-6 py-3">Division</th><th className="px-6 py-3">Reports To</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="table-cell"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-primary-100 text-primary-800 rounded-full flex items-center justify-center text-sm font-bold">{u.firstName?.[0]}{u.lastName?.[0]}</div><div><p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p><p className="text-xs text-gray-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</p></div></div></td>
                  <td className="table-cell"><span className={`badge ${roleColors[u.role]}`}>{u.role?.replace(/_/g, ' ')}</span></td>
                  <td className="table-cell text-sm">{u.department?.name || '-'}</td>
                  <td className="table-cell text-sm">{u.division?.name || '-'}</td>
                  <td className="table-cell text-sm">{u.manager ? `${u.manager.firstName} ${u.manager.lastName}` : '-'}</td>
                  <td className="table-cell"><span className={`badge ${!u.isActive ? 'bg-red-100 text-red-800' : u.isApproved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{!u.isActive ? 'Inactive' : u.isApproved ? 'Approved' : 'Pending approval'}</span></td>
                  <td className="table-cell"><div className="flex items-center gap-1">{canEditUser(u) && u.isActive && !u.isApproved && <><button onClick={() => updateApproval(u, true)} title="Approve employee" className="p-1.5 text-green-700 hover:bg-green-50 rounded-lg"><Check size={16} /></button><button onClick={() => updateApproval(u, false)} title="Reject employee" className="p-1.5 text-red-700 hover:bg-red-50 rounded-lg"><X size={16} /></button></>}{canEditUser(u) && <button onClick={() => openEdit(u)} title="View or edit employee" className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit size={16} className="text-gray-600" /></button>}{canEditUser(u) && u.isActive && <button onClick={() => removeUser(u)} title="Remove user" className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingUser ? 'Edit User' : 'Create User'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">First Name *</label><input value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} className="input-field" required /></div>
            <div><label className="label">Last Name *</label><input value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} className="input-field" required /></div>
            <div><label className="label">Email *</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" required /></div>
            <div><label className="label">Phone</label><input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="input-field" placeholder="0912345678" /></div>
            <div><label className="label">{editingUser ? 'New Password' : 'Password *'}</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="input-field" required={!editingUser} placeholder={editingUser ? 'Leave blank to keep current' : ''} /></div>
            <div><label className="label">Role *</label><select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="input-field" required>{allowedRoles.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
            <div><label className="label">Department</label><select value={form.departmentId} onChange={e => setForm({...form, departmentId: e.target.value, divisionId: ''})} className="input-field" disabled={currentUser?.role !== 'CEO'} required={currentUser?.role !== 'CEO'}><option value="">Select department</option>{availableDepartments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="label">Division</label><select value={form.divisionId} onChange={e => setForm({...form, divisionId: e.target.value})} className="input-field" disabled={!form.departmentId}><option value="">No division assigned</option>{availableDivisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div><label className="label">Reports To</label><select value={form.managerId} onChange={e => setForm({...form, managerId: e.target.value})} className="input-field"><option value="">Select manager</option>{allUsers.filter(u => u.id !== editingUser?.id).map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role?.replace(/_/g, ' ')})</option>)}</select></div>
            <div><label className="label">Status</label><select value={form.isActive} onChange={e => setForm({...form, isActive: e.target.value === 'true'})} className="input-field"><option value="true">Active</option><option value="false">Inactive</option></select></div>
            <div><label className="label">Account Approval</label><select value={form.isApproved} onChange={e => setForm({...form, isApproved: e.target.value === 'true'})} className="input-field"><option value="true">Approved</option><option value="false">Pending approval</option></select></div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
