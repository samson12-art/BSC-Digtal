import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { User, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { roleColors } from '../lib/utils';

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) { toast.error('Passwords do not match'); return; }
    if (passwordForm.newPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await api.put('/auth/change-password', { currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to change password'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[{ id: 'profile', label: 'Profile', icon: User }, { id: 'security', label: 'Security', icon: Lock }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-white text-primary-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}><tab.icon size={16} />{tab.label}</button>
        ))}
      </div>
      {activeTab === 'profile' && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
          <div className="flex items-center gap-6 mb-6 pb-6 border-b">
            <div className="w-20 h-20 bg-primary-800 rounded-2xl flex items-center justify-center text-white text-2xl font-bold">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
            <div><h4 className="text-xl font-bold text-gray-900">{user?.firstName} {user?.lastName}</h4><p className="text-gray-500">{user?.email}</p><span className={`badge mt-2 ${roleColors[user?.role]}`}>{user?.role?.replace(/_/g, ' ')}</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">First Name</span><p className="font-medium mt-1">{user?.firstName}</p></div>
            <div><span className="text-gray-500">Last Name</span><p className="font-medium mt-1">{user?.lastName}</p></div>
            <div><span className="text-gray-500">Email</span><p className="font-medium mt-1">{user?.email}</p></div>
            <div><span className="text-gray-500">Department</span><p className="font-medium mt-1">{user?.department?.name || 'N/A'}</p></div>
            <div><span className="text-gray-500">Manager</span><p className="font-medium mt-1">{user?.manager ? `${user.manager.firstName} ${user.manager.lastName}` : 'N/A'}</p></div>
            <div><span className="text-gray-500">Role</span><p className="font-medium mt-1">{user?.role?.replace(/_/g, ' ')}</p></div>
          </div>
        </div>
      )}
      {activeTab === 'security' && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Lock size={18} />Change Password</h3>
          <form onSubmit={handlePasswordChange} className="max-w-md space-y-4">
            <div><label className="label">Current Password</label><input type="password" value={passwordForm.currentPassword} onChange={e => setPasswordForm({...passwordForm, currentPassword: e.target.value})} className="input-field" required /></div>
            <div><label className="label">New Password</label><input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} className="input-field" required minLength={8} /></div>
            <div><label className="label">Confirm New Password</label><input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({...passwordForm, confirmPassword: e.target.value})} className="input-field" required /></div>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Changing...' : 'Change Password'}</button>
          </form>
        </div>
      )}
    </div>
  );
}
