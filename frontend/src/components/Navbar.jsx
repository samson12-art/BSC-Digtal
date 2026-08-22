import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { Menu, Bell, LogOut, ChevronDown } from 'lucide-react';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState({ unreadCount: 0 });
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const fetchNotifications = async () => {
      try { const res = await api.get('/notifications'); setNotifications(res.data); } catch (err) { /* ignore */ }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-[#dfe7e4] flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick} className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"><Menu size={20} /></button>
        <div>
          <h2 className="text-sm font-semibold" style={{color:'#17211f'}}>Welcome back, {user?.firstName}</h2>
          <p className="text-xs" style={{color:'#6c7774'}}>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/notifications" className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <Bell size={20} style={{color:'#6c7774'}} />
          {notifications.unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-[#b42318] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{notifications.unreadCount > 9 ? '9+' : notifications.unreadCount}</span>}
        </Link>
        <div className="relative">
          <button onClick={() => setShowDropdown(!showDropdown)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 rounded-lg">
            <div className="w-8 h-8 bg-[#136f63] rounded-full flex items-center justify-center text-white font-medium text-sm">{user?.firstName?.[0]}{user?.lastName?.[0]}</div>
            <ChevronDown size={16} style={{color:'#6c7774'}} />
          </button>
          {showDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-[#dfe7e4] py-2 z-50">
                <div className="px-4 py-2 border-b border-[#dfe7e4]"><p className="font-medium text-sm" style={{color:'#17211f'}}>{user?.firstName} {user?.lastName}</p><p className="text-xs" style={{color:'#6c7774'}}>{user?.email}</p></div>
                <Link to="/settings" onClick={() => setShowDropdown(false)} className="block px-4 py-2 text-sm hover:bg-gray-50" style={{color:'#17211f'}}>Settings</Link>
                <button onClick={() => { logout(); setShowDropdown(false); }} className="w-full text-left px-4 py-2 text-sm text-[#b42318] hover:bg-red-50 flex items-center gap-2"><LogOut size={16} />Sign out</button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
