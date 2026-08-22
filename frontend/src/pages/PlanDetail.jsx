import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import PerspectiveBadge from '../components/PerspectiveBadge';
import ProgressBar from '../components/ProgressBar';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import { perspectives, formatNumber, getAchievementPercentage } from '../lib/utils';
import toast from 'react-hot-toast';
import { ArrowLeft, Edit, Send, CheckCircle, XCircle, RotateCcw, MessageSquare, History, Paperclip, Download, Clock, Upload, Users, Plus, Trash2 } from 'lucide-react';

export default function PlanDetail() {
  const { id } = useParams();
  const { user, canApprove } = useAuth();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [actionComment, setActionComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showContributorModal, setShowContributorModal] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userResults, setUserResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [contribPct, setContribPct] = useState(25);
  const [contribRole, setContribRole] = useState('CONTRIBUTOR');

  useEffect(() => { fetchPlan(); }, [id]);

  const fetchPlan = async () => {
    try { const res = await api.get(`/plans/${id}`); setPlan(res.data); }
    catch (err) { toast.error('Failed to load plan'); navigate('/plans'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try { await api.post(`/approvals/${id}/submit`); toast.success('Plan submitted for review'); fetchPlan(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to submit'); }
    finally { setSubmitting(false); }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try { await api.post(`/approvals/${id}/approve`, { comments: actionComment }); toast.success('Plan approved!'); setShowApproveModal(false); setActionComment(''); fetchPlan(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to approve'); }
    finally { setSubmitting(false); }
  };

  const handleReject = async () => {
    if (!actionComment.trim()) { toast.error('Please provide a reason for rejection'); return; }
    setSubmitting(true);
    try { await api.post(`/approvals/${id}/reject`, { comments: actionComment }); toast.success('Plan rejected'); setShowRejectModal(false); setActionComment(''); fetchPlan(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to reject'); }
    finally { setSubmitting(false); }
  };

  const handleReturn = async () => {
    if (!actionComment.trim()) { toast.error('Please provide revision comments'); return; }
    setSubmitting(true);
    try { await api.post(`/approvals/${id}/return`, { comments: actionComment }); toast.success('Plan returned for revision'); setShowReturnModal(false); setActionComment(''); fetchPlan(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to return'); }
    finally { setSubmitting(false); }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try { await api.post(`/plans/${id}/comments`, { content: newComment }); toast.success('Comment added'); setNewComment(''); fetchPlan(); }
    catch (err) { toast.error('Failed to add comment'); }
    finally { setSubmitting(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File size must be under 10MB'); e.target.value = ''; return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post(`/plans/${id}/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('File uploaded');
      fetchPlan();
    } catch (err) { toast.error(err.response?.data?.error || 'Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  };

  const searchUsers = async (q) => {
    setUserSearch(q);
    if (q.length < 2) { setUserResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get(`/users/search?q=${encodeURIComponent(q)}`);
      const existing = (plan.contributors || []).map(c => c.userId);
      setUserResults((Array.isArray(res.data) ? res.data : []).filter(u => u.id !== plan.ownerId && !existing.includes(u.id)));
    } catch { setUserResults([]); }
    finally { setSearching(false); }
  };

  const handleAddContributor = async (userId) => {
    try {
      await api.post(`/contributors/plan/${id}`, { userId, contributionPct: contribPct, role: contribRole });
      toast.success('Contributor added');
      setShowContributorModal(false);
      setUserSearch('');
      setUserResults([]);
      fetchPlan();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to add contributor'); }
  };

  const handleRemoveContributor = async (contributorId) => {
    if (!confirm('Remove this contributor?')) return;
    try {
      await api.delete(`/contributors/${contributorId}`);
      toast.success('Contributor removed');
      fetchPlan();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to remove contributor'); }
  };

  if (loading) return <LoadingSpinner className="h-96" size="lg" />;
  if (!plan) return null;

  const achievement = getAchievementPercentage(plan.actualResult, plan.target);
  const isOwner = plan.ownerId === user?.id;
  const canSubmit = isOwner && ['DRAFT', 'RETURNED_FOR_REVISION'].includes(plan.status);
  const canEdit = isOwner && ['DRAFT', 'RETURNED_FOR_REVISION'].includes(plan.status);
  const canAct = canApprove() && ['SUBMITTED', 'UNDER_REVIEW'].includes(plan.status);
  const persp = perspectives.find(p => p.value === plan.perspective);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></button>
          <div><h1 className="text-2xl font-bold text-gray-900">{plan.title}</h1><p className="text-sm text-gray-500">By {plan.owner.firstName} {plan.owner.lastName} · v{plan.version}</p></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && <Link to={`/plans/${id}/edit`} className="btn-secondary flex items-center gap-2"><Edit size={16} />Edit</Link>}
          {canSubmit && <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex items-center gap-2"><Send size={16} />Submit for Review</button>}
          {canAct && (
            <>
              <button onClick={() => setShowApproveModal(true)} className="btn-success flex items-center gap-2"><CheckCircle size={16} />Approve</button>
              <button onClick={() => setShowReturnModal(true)} className="btn-warning flex items-center gap-2"><RotateCcw size={16} />Return</button>
              <button onClick={() => setShowRejectModal(true)} className="btn-danger flex items-center gap-2"><XCircle size={16} />Reject</button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Perspective</span><div className="mt-1"><PerspectiveBadge perspective={plan.perspective} /></div></div>
              <div><span className="text-gray-500">Status</span><div className="mt-1"><StatusBadge status={plan.status} /></div></div>
              <div className="col-span-2"><span className="text-gray-500">Strategic Objective</span><p className="mt-1 text-gray-900">{plan.strategicObjective}</p></div>
              {plan.description && <div className="col-span-2"><span className="text-gray-500">Description</span><p className="mt-1 text-gray-900">{plan.description}</p></div>}
              {plan.strategicInitiative && <div className="col-span-2"><span className="text-gray-500">Strategic Initiative</span><p className="mt-1 text-gray-900">{plan.strategicInitiative}</p></div>}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">KPI Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl"><span className="text-xs text-gray-500 block">KPI Name</span><p className="font-semibold text-gray-900">{plan.kpiName}</p></div>
              <div className="p-4 bg-gray-50 rounded-xl"><span className="text-xs text-gray-500 block">Measurement Unit</span><p className="font-semibold text-gray-900">{plan.measurementUnit || 'N/A'}</p></div>
              <div className="p-4 bg-gray-50 rounded-xl"><span className="text-xs text-gray-500 block">Formula</span><p className="font-semibold text-gray-900 text-xs">{plan.kpiFormula || 'N/A'}</p></div>
              <div className="p-4 bg-gray-50 rounded-xl"><span className="text-xs text-gray-500 block">Baseline</span><p className="font-semibold text-gray-900">{formatNumber(plan.baseline)}</p></div>
              <div className="p-4 bg-blue-50 rounded-xl"><span className="text-xs text-blue-500 block">Target</span><p className="font-bold text-blue-900 text-lg">{formatNumber(plan.target)}</p></div>
              <div className="p-4 bg-green-50 rounded-xl"><span className="text-xs text-green-500 block">Actual Result</span><p className="font-bold text-green-900 text-lg">{formatNumber(plan.actualResult)}</p></div>
              <div className="p-4 bg-purple-50 rounded-xl"><span className="text-xs text-purple-500 block">Weight</span><p className="font-bold text-purple-900 text-lg">{plan.weight}%</p></div>
            </div>
            <div className="mt-4">
              <ProgressBar percentage={achievement} size="md" />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div><span className="text-gray-500">Budget:</span> <span className="font-medium ml-2">{formatNumber(plan.budget)} ETB</span></div>
              {plan.startDate && <div><span className="text-gray-500">Start:</span> <span className="font-medium ml-2">{new Date(plan.startDate).toLocaleDateString()}</span></div>}
              {plan.endDate && <div><span className="text-gray-500">End:</span> <span className="font-medium ml-2">{new Date(plan.endDate).toLocaleDateString()}</span></div>}
              {plan.department && <div><span className="text-gray-500">Department:</span> <span className="font-medium ml-2">{plan.department.name}</span></div>}
            </div>
          </div>

          {plan.approvalHistory && plan.approvalHistory.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2"><History size={18} />Approval History</h3>
              <div className="space-y-3">
                {plan.approvalHistory.map(h => (
                  <div key={h.id} className="flex gap-3 p-3 rounded-lg bg-gray-50">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${h.action === 'APPROVE' ? 'bg-green-500' : h.action === 'REJECT' ? 'bg-red-500' : h.action === 'RETURN_FOR_REVISION' ? 'bg-amber-500' : 'bg-blue-500'}`}>
                      {h.action === 'APPROVE' ? '✓' : h.action === 'REJECT' ? '✕' : h.action === 'RETURN_FOR_REVISION' ? '↺' : '→'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900">{h.reviewer.firstName} {h.reviewer.lastName} <span className="text-gray-400 font-normal">· {h.reviewer.role?.replace(/_/g, ' ')}</span></p>
                        <span className="text-xs text-gray-500">{new Date(h.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs font-medium text-gray-600 mt-0.5">{h.action.replace(/_/g, ' ')}</p>
                      {h.comments && <p className="text-sm text-gray-600 mt-1 p-2 bg-white rounded border border-gray-100">{h.comments}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2"><MessageSquare size={16} />Comments</h3>
            <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
              {plan.comments && plan.comments.length > 0 ? plan.comments.map(c => (
                <div key={c.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-gray-900">{c.user.firstName} {c.user.lastName}</span><span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleString()}</span></div>
                  <p className="text-sm text-gray-700">{c.content}</p>
                </div>
              )) : <p className="text-sm text-gray-400 text-center py-4">No comments yet</p>}
            </div>
            <div className="flex gap-2">
              <input value={newComment} onChange={e => setNewComment(e.target.value)} className="input-field text-sm" placeholder="Add a comment..." onKeyDown={e => e.key === 'Enter' && handleComment()} />
              <button onClick={handleComment} disabled={submitting} className="btn-primary text-sm px-3">Post</button>
            </div>
          </div>

          <div className="card">
            <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2"><Paperclip size={16} />Attachments</h3>
            <div className="mb-3">
              <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#136f63] transition-colors text-sm text-gray-500 hover:text-[#136f63]">
                <Upload size={16} />
                <span>{uploading ? 'Uploading...' : 'Click to upload file (max 10MB)'}</span>
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
            {plan.attachments && plan.attachments.length > 0 ? (
              <div className="space-y-2">
                {plan.attachments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                    <span className="truncate flex-1">{a.fileName}</span>
                    <a href={`/uploads/${a.filePath?.replace(/\\/g, '/').split('/').pop()}`} target="_blank" rel="noreferrer" className="text-[#136f63] hover:text-[#0e554c] ml-2"><Download size={14} /></a>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400 text-center py-4">No attachments yet</p>}
          </div>

          {plan.childPlans && plan.childPlans.length > 0 && (
            <div className="card">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Child Plans ({plan.childPlans.length})</h3>
              <div className="space-y-2">
                {plan.childPlans.map(cp => (
                  <Link key={cp.id} to={`/plans/${cp.id}`} className="block p-2 bg-gray-50 rounded-lg hover:bg-gray-100 text-sm">
                    <span className="font-medium">{cp.title}</span>
                    <div className="flex items-center gap-2 mt-1"><StatusBadge status={cp.status} /><PerspectiveBadge perspective={cp.perspective} /></div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2"><Users size={16} />Contributors</h3>
              {isOwner && ['DRAFT', 'RETURNED_FOR_REVISION'].includes(plan.status) && (
                <button onClick={() => setShowContributorModal(true)} className="text-xs text-[#136f63] hover:text-[#0e554c] flex items-center gap-1"><Plus size={14} />Add</button>
              )}
            </div>
            {plan.contributors && plan.contributors.length > 0 ? (
              <div className="space-y-2">
                {plan.contributors.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#136f63] text-white flex items-center justify-center text-xs font-bold flex-shrink-0">{c.user.firstName?.[0]}{c.user.lastName?.[0]}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.user.firstName} {c.user.lastName}</p>
                        <p className="text-[10px] text-gray-500">{c.role?.replace(/_/g, ' ')} · {c.contributionPct}%</p>
                      </div>
                    </div>
                    {isOwner && (
                      <button onClick={() => handleRemoveContributor(c.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0"><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100 text-xs text-gray-500">
                  Owner share: {Math.max(0, 100 - plan.contributors.reduce((s, c) => s + c.contributionPct, 0))}%
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-3">No contributors yet</p>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={showApproveModal} onClose={() => setShowApproveModal(false)} title="Approve Plan">
        <p className="text-sm text-gray-600 mb-4">Are you sure you want to approve this plan?</p>
        <textarea value={actionComment} onChange={e => setActionComment(e.target.value)} className="input-field mb-4" rows={3} placeholder="Optional approval comments..." />
        <div className="flex justify-end gap-3"><button onClick={() => setShowApproveModal(false)} className="btn-secondary">Cancel</button><button onClick={handleApprove} disabled={submitting} className="btn-success">{submitting ? 'Approving...' : 'Approve'}</button></div>
      </Modal>

      <Modal isOpen={showRejectModal} onClose={() => setShowRejectModal(false)} title="Reject Plan">
        <p className="text-sm text-gray-600 mb-4">Please provide a reason for rejection.</p>
        <textarea value={actionComment} onChange={e => setActionComment(e.target.value)} className="input-field mb-4" rows={3} placeholder="Rejection reason (required)..." />
        <div className="flex justify-end gap-3"><button onClick={() => setShowRejectModal(false)} className="btn-secondary">Cancel</button><button onClick={handleReject} disabled={submitting} className="btn-danger">{submitting ? 'Rejecting...' : 'Reject'}</button></div>
      </Modal>

      <Modal isOpen={showReturnModal} onClose={() => setShowReturnModal(false)} title="Return for Revision">
        <p className="text-sm text-gray-600 mb-4">Provide feedback for the plan owner to revise.</p>
        <textarea value={actionComment} onChange={e => setActionComment(e.target.value)} className="input-field mb-4" rows={3} placeholder="Revision instructions (required)..." />
        <div className="flex justify-end gap-3"><button onClick={() => setShowReturnModal(false)} className="btn-secondary">Cancel</button><button onClick={handleReturn} disabled={submitting} className="btn-warning">{submitting ? 'Returning...' : 'Return for Revision'}</button></div>
      </Modal>

      <Modal isOpen={showContributorModal} onClose={() => { setShowContributorModal(false); setUserSearch(''); setUserResults([]); }} title="Add Contributor">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Users</label>
            <input value={userSearch} onChange={e => searchUsers(e.target.value)} className="input-field" placeholder="Type a name..." autoFocus />
          </div>
          {searching && <p className="text-sm text-gray-400 text-center py-2">Searching...</p>}
          {userResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {userResults.map(u => (
                <button key={u.id} onClick={() => handleAddContributor(u.id)} className="w-full text-left p-2 rounded-lg hover:bg-gray-50 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold">{u.firstName?.[0]}{u.lastName?.[0]}</div>
                  <div><p className="text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</p><p className="text-xs text-gray-500">{u.role?.replace(/_/g, ' ')}</p></div>
                </button>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contribution %</label>
              <input type="number" min="1" max="100" value={contribPct} onChange={e => setContribPct(Number(e.target.value))} className="input-field" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select value={contribRole} onChange={e => setContribRole(e.target.value)} className="input-field">
                <option value="CONTRIBUTOR">Contributor</option>
                <option value="CO_OWNER">Co-owner</option>
                <option value="REVIEWER">Reviewer</option>
                <option value="ADVISOR">Advisor</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400">Remaining owner share: {Math.max(0, 100 - (plan.contributors?.reduce((s, c) => s + c.contributionPct, 0) || 0) - contribPct)}%</p>
        </div>
      </Modal>
    </div>
  );
}
