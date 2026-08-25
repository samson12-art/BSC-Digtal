import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, BarChart3, Check, ChevronDown, FileText, Goal, Hexagon, LockKeyhole, Mail, Moon, ShieldCheck, Sun, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

const features = [
  { icon: Goal, title: 'Strategic Alignment', text: 'Align organizational goals with strategic objectives.' },
  { icon: BarChart3, title: 'KPI Tracking', text: 'Track KPIs in real-time and analyze performance trends.' },
  { icon: UsersRound, title: 'Approval Workflow', text: 'Streamlined hierarchical approvals and notifications.' },
  { icon: FileText, title: 'Dashboards & Reports', text: 'Real-time dashboards and actionable reports.' },
];

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); try { await login(email, password); toast.success('Welcome back!'); navigate('/'); } catch (err) { toast.error(err.response?.data?.error || 'Login failed'); } finally { setLoading(false); } };
  const resendVerification = async () => { if (!email) return toast.error('Enter your email address first.'); try { await api.post('/auth/resend-verification', { email }); toast.success('If your account needs verification, a new link has been sent.'); } catch { toast.error('Could not send a verification email. Please try again.'); } };

  return <main className={`login-page ${dark ? 'login-page--dark' : ''}`}>
    <header className="login-header"><div className="login-brand"><Hexagon aria-hidden="true" /><span>BSC Management System</span></div><div className="login-controls"><button className="theme-toggle" type="button" onClick={() => setDark(!dark)} aria-label="Toggle colour theme"><Sun size={18} className={!dark ? 'active' : ''} /><Moon size={18} className={dark ? 'active' : ''} /></button><button className="language-button" type="button">EN <ChevronDown size={15} /></button></div></header>
    <section className="login-content">
      <aside className="login-features" aria-label="Platform features">{features.map(({ icon: Icon, title, text }) => <div className="login-feature" key={title}><span className="feature-icon"><Icon size={26} /></span><div><h2>{title}</h2><p>{text}</p></div></div>)}</aside>
      <div className="login-card-wrap"><section className="login-card" aria-labelledby="login-heading"><div className="login-card-logo"><Hexagon size={47} /></div><h1 id="login-heading">Welcome Back</h1><p className="login-subtitle">Sign in to your BSC Management System</p><form onSubmit={handleSubmit}><label className="login-label" htmlFor="login-email">Email Address</label><div className="login-input-wrap"><Mail size={18} /><input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required /></div><label className="login-label" htmlFor="login-password">Password</label><div className="login-input-wrap"><LockKeyhole size={18} /><input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required /></div><div className="login-options"><label className="remember-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span><Check size={12} /></span>Remember me</label><button type="button" onClick={resendVerification}>Forgot password?</button></div><button type="submit" disabled={loading} className="login-submit">{loading ? 'Signing in…' : <>Sign In <ArrowRight size={21} /></>}</button></form><div className="continue-divider"><span>or continue with</span></div><div className="social-logins"><button type="button" onClick={() => toast('Google sign-in is not configured yet.')}><b className="google-mark">G</b> Google</button><button type="button" onClick={() => toast('Microsoft sign-in is not configured yet.')}><span className="microsoft-mark"><i /><i /><i /><i /></span> Microsoft</button></div><p className="contact-admin">Don't have an account? <button type="button" onClick={resendVerification}>Contact your administrator</button></p></section></div>
      <aside className="login-visual" aria-hidden="true"><div className="visual-glow" /><div className="visual-monitor"><div className="monitor-top"><i /><i /><i /></div><div className="chart-line" /><div className="chart-bars"><i /><i /><i /><i /><i /><i /></div></div><div className="visual-kpi"><small>KPI Progress</small><b>78%</b><div className="donut" /></div></aside>
    </section>
    <footer className="login-footer"><div><ShieldCheck size={24} /><p><b>Secure</b><span>Your data is always protected</span></p></div><div><Check size={24} /><p><b>Reliable</b><span>99.9% system uptime</span></p></div><div><BarChart3 size={24} /><p><b>Scalable</b><span>Built for growth and performance</span></p></div><small>© 2025 BSC Management System. All rights reserved.</small></footer>
  </main>;
}
