import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ArrowRight, Check, Hexagon, LockKeyhole, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, completeOAuthLogin } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const code = searchParams.get('oauthCode');
    const error = searchParams.get('oauthError');
    if (error) { toast.error(error); navigate('/login', { replace: true }); return; }
    if (!code) return;
    setLoading(true);
    completeOAuthLogin(code).then(() => { toast.success('Welcome back!'); navigate('/', { replace: true }); }).catch((err) => { toast.error(err.response?.data?.error || 'Sign-in could not be completed'); navigate('/login', { replace: true }); }).finally(() => setLoading(false));
  }, [searchParams, completeOAuthLogin, navigate]);
  const handleSubmit = async (e) => { e.preventDefault(); setLoading(true); try { await login(email, password); toast.success('Welcome back!'); navigate('/'); } catch (err) { toast.error(err.response?.data?.error || 'Login failed'); } finally { setLoading(false); } };
  const resendVerification = async () => { if (!email) return toast.error('Enter your email address first.'); try { await api.post('/auth/resend-verification', { email }); toast.success('If your account needs verification, a new link has been sent.'); } catch { toast.error('Could not send a verification email. Please try again.'); } };
  const signInWith = (provider) => { window.location.assign(`${import.meta.env.VITE_API_URL || '/api'}/auth/oauth/${provider}`); };

  return <main className="login-page login-page--centered">
    <section className="login-content">
      <div className="login-card-wrap"><section className="login-card" aria-labelledby="login-heading"><div className="login-card-logo"><Hexagon size={47} /></div><h1 id="login-heading">Welcome Back</h1><p className="login-subtitle">Sign in to your BSC Management System</p><form onSubmit={handleSubmit}><label className="login-label" htmlFor="login-email">Email Address</label><div className="login-input-wrap"><Mail size={18} /><input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required /></div><label className="login-label" htmlFor="login-password">Password</label><div className="login-input-wrap"><LockKeyhole size={18} /><input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required /></div><div className="login-options"><label className="remember-check"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /><span><Check size={12} /></span>Remember me</label><button type="button" onClick={resendVerification}>Forgot password?</button></div><button type="submit" disabled={loading} className="login-submit">{loading ? 'Signing in…' : <>Sign In <ArrowRight size={21} /></>}</button></form><div className="continue-divider"><span>or continue with</span></div><div className="social-logins"><button type="button" onClick={() => signInWith('google')}><b className="google-mark">G</b> Google</button><button type="button" onClick={() => signInWith('microsoft')}><span className="microsoft-mark"><i /><i /><i /><i /></span> Microsoft</button></div><p className="contact-admin">Don't have an account? <button type="button" onClick={resendVerification}>Contact your administrator</button></p></section></div>
    </section>
  </main>;
}
