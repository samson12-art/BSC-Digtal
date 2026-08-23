import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, FileText, ClipboardCheck, BarChart3, Users, Building2, Bell, Shield, Settings, X, Hexagon } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: null },
  { to: '/plans', icon: FileText, label: 'BSC Plans', roles: null },
  { to: '/plans/new', icon: FileText, label: 'Create Plan', roles: ['EMPLOYEE', 'DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO', 'BOARD_MEMBER'] },
  { to: '/reviews', icon: ClipboardCheck, label: 'Pending Reviews', roles: ['DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO', 'BOARD_MEMBER'] },
  { to: '/reports', icon: BarChart3, label: 'Reports', roles: null },
  { to: '/users', icon: Users, label: 'Users', roles: ['CEO', 'EXECUTIVE_MANAGER', 'DEPARTMENT_MANAGER', 'BOARD_MEMBER'] },
  { to: '/departments', icon: Building2, label: 'Departments', roles: ['CEO', 'EXECUTIVE_MANAGER', 'BOARD_MEMBER'] },
  { to: '/notifications', icon: Bell, label: 'Notifications', roles: null },
  { to: '/audit', icon: Shield, label: 'Audit Trail', roles: ['CEO', 'EXECUTIVE_MANAGER', 'BOARD_MEMBER'] },
  { to: '/settings', icon: Settings, label: 'Settings', roles: null },
];

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const filtered = navItems.filter(item => !item.roles || item.roles.includes(user?.role));
  return (
    <>
      {isOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-[#101918] text-white transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#136f63] rounded-lg flex items-center justify-center font-bold text-white text-sm"><Hexagon size={18} /></div>
            <div><h1 className="font-bold text-sm leading-tight">BSC System</h1><p className="text-[10px] text-[#6c7774]">Insurance Corp</p></div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-white/5 rounded"><X size={20} /></button>
        </div>
        <nav className="px-3 py-4 space-y-1 overflow-y-auto" style={{maxHeight:'calc(100vh - 4rem)'}}>
          {filtered.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} onClick={onClose}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-[#136f63] text-white' : 'text-[#8a9e97] hover:bg-white/5 hover:text-white'}`}>
              <item.icon size={18} />{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5 bg-[#0a1210]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#136f63] rounded-full flex items-center justify-center text-white font-bold text-sm">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-white">{user?.firstName} {user?.lastName}</p>
              <p className="text-[11px] text-[#6c7774] truncate">{user?.role?.replace(/_/g, ' ')}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
