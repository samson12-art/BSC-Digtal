import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import PerspectiveBadge from '../components/PerspectiveBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { ClipboardCheck, CheckCircle, XCircle, RotateCcw, FileText } from 'lucide-react';
import { formatNumber } from '../lib/utils';
import toast from 'react-hot-toast';

export default function PendingReviews() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [action, setAction] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    try { const res = await api.get('/plans/pending-reviews/all'); setPlans(res.data); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const openAction = (plan, act) => { setSelectedPlan(plan); setAction(act); setComment(''); };
  const closeModal = () => { setSelectedPlan(null); setAction(''); setComment(''); };

  const executeAction = async () => {
    if ((action === 'reject' || action === 'return') && !comment.trim()) {
      toast.error('Comments are required'); return;
    }
    setSubmitting(true);
    try {
      await api.post(`/approvals/${selectedPlan.id}/${action}`, { comments: comment });
      toast.success(`Plan ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'returned'} successfully`);
      closeModal();
      fetchPlans();
    } catch (err) { toast.error(err.response?.data?.error || 'Action failed'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-gray-900">Pending Reviews</h1><p className="text-sm text-gray-500">Review and approve submitted BSC plans ({plans.length} pending)</p></div>

      {plans.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No pending reviews" description="All submitted plans have been reviewed" />
      ) : (
        <div className="space-y-4">
          {plans.map(plan => (
            <div key={plan.id} className="card hover:shadow-md transition-shadow">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{plan.title}</h3>
                    <PerspectiveBadge perspective={plan.perspective} />
                    <StatusBadge status={plan.status} />
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{plan.strategicObjective}</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                    <div><span className="text-gray-400">KPI:</span> <span className="font-medium">{plan.kpiName}</span></div>
                    <div><span className="text-gray-400">Target:</span> <span className="font-medium">{formatNumber(plan.target)}</span></div>
                    <div><span className="text-gray-400">Actual:</span> <span className="font-medium">{formatNumber(plan.actualResult)}</span></div>
                    <div><span className="text-gray-400">Weight:</span> <span className="font-medium">{plan.weight}%</span></div>
                    <div><span className="text-gray-400">Owner:</span> <span className="font-medium">{plan.owner.firstName} {plan.owner.lastName}</span></div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link to={`/plans/${plan.id}`} className="btn-secondary text-sm px-3">View</Link>
                  <button onClick={() => openAction(plan, 'approve')} className="btn-success text-sm px-3 flex items-center gap-1"><CheckCircle size={14} />Approve</button>
                  <button onClick={() => openAction(plan, 'return')} className="btn-warning text-sm px-3 flex items-center gap-1"><RotateCcw size={14} />Return</button>
                  <button onClick={() => openAction(plan, 'reject')} className="btn-danger text-sm px-3 flex items-center gap-1"><XCircle size={14} />Reject</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={!!selectedPlan} onClose={closeModal} title={`${action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Return for Revision'} Plan`}>
        {selectedPlan && (
          <>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg"><p className="font-medium text-sm">{selectedPlan.title}</p><p className="text-xs text-gray-500">By {selectedPlan.owner.firstName} {selectedPlan.owner.lastName}</p></div>
            <div className="mb-4"><label className="label">{action === 'approve' ? 'Comments (optional)' : 'Comments (required)'}</label><textarea value={comment} onChange={e => setComment(e.target.value)} className="input-field" rows={4} placeholder={action === 'approve' ? 'Add any approval notes...' : 'Provide detailed feedback...'} /></div>
            <div className="flex justify-end gap-3">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={executeAction} disabled={submitting}
                className={action === 'approve' ? 'btn-success' : action === 'reject' ? 'btn-danger' : 'btn-warning'}>
                {submitting ? 'Processing...' : action === 'approve' ? 'Approve' : action === 'reject' ? 'Reject' : 'Return'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
