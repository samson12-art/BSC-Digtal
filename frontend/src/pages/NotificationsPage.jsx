import { useState, useEffect } from 'react';
import api from '../lib/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { Bell, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchNotifications(); }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const markAsRead = async (id) => {
    try { await api.put(`/notifications/${id}/read`); fetchNotifications(); }
    catch (err) { console.error(err); }
  };

  const markAllRead = async () => {
    try { await api.put('/notifications/read-all'); toast.success('All notifications marked as read'); fetchNotifications(); }
    catch (err) { toast.error('Failed'); }
  };

  const getIcon = (type) => {
    const icons = { APPROVAL: '\u2713', REJECTION: '\u2715', REVISION: '\u21BA', REVIEW_REQUIRED: '\uD83D\uDCCB', COMMENT: '\uD83D\uDCAC' };
    return icons[type] || '\uD83D\uDCCC';
  };

  const getColor = (type) => {
    const colors = { APPROVAL: 'bg-green-100 text-green-700', REJECTION: 'bg-red-100 text-red-700', REVISION: 'bg-amber-100 text-amber-700', REVIEW_REQUIRED: 'bg-blue-100 text-blue-700', COMMENT: 'bg-purple-100 text-purple-700' };
    return colors[type] || 'bg-gray-100 text-gray-700';
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Notifications</h1><p className="text-sm text-gray-500">{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</p></div>
        {unreadCount > 0 && <button onClick={markAllRead} className="btn-secondary flex items-center gap-2 text-sm"><CheckCheck size={16} />Mark all read</button>}
      </div>
      {notifications.length === 0 ? (
        <div className="card text-center py-12"><Bell size={40} className="text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No notifications</p></div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => (
            <div key={n.id} className={`card flex items-start gap-4 cursor-pointer transition-all ${!n.isRead ? 'border-l-4 border-l-primary-800 bg-primary-50/30' : ''}`} onClick={() => !n.isRead && markAsRead(n.id)}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${getColor(n.type)}`}>{getIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">{n.title}</h4>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{n.message}</p>
              </div>
              {!n.isRead && <div className="w-2.5 h-2.5 bg-primary-800 rounded-full flex-shrink-0 mt-2" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
