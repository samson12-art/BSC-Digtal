import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Hexagon, Eye, EyeOff, LogIn } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-[#f6f8f7]">
      <div className="hidden lg:flex lg:w-1/2 bg-[#101918] relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#136f63] rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-400 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16">
          <div className="w-14 h-14 bg-[#136f63] rounded-xl flex items-center justify-center mb-8">
            <Hexagon size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Balanced Scorecard<br/>Management System</h1>
          <p className="text-base text-[#8a9e97] mb-8">Enterprise Performance Management & Strategic Planning Platform</p>
          <div className="space-y-4 text-[#8a9e97]">
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#136f63] rounded-full" /><span>Strategic Objective Alignment</span></div>
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#136f63] rounded-full" /><span>KPI Tracking & Performance Analytics</span></div>
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#136f63] rounded-full" /><span>Hierarchical Approval Workflow</span></div>
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#136f63] rounded-full" /><span>Role-Based Access Control</span></div>
            <div className="flex items-center gap-3"><div className="w-1.5 h-1.5 bg-[#136f63] rounded-full" /><span>Real-time Dashboards & Reports</span></div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-[#f6f8f7]">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-[#136f63] rounded-xl flex items-center justify-center"><Hexagon size={22} className="text-white" /></div>
            <div><h1 className="font-bold" style={{color:'#17211f'}}>BSC System</h1><p className="text-xs" style={{color:'#6c7774'}}>Insurance Corp</p></div>
          </div>
          <h2 className="text-2xl font-bold mb-1" style={{color:'#17211f'}}>Sign in to your account</h2>
          <p className="mb-8" style={{color:'#6c7774'}}>Access your balanced scorecard dashboard</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-field" placeholder="Enter your email" required />
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="input-field pr-10" placeholder="Enter your password" required />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{color:'#6c7774'}}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base">
              {loading ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> : <><LogIn size={18} />Sign In</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
