import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Loader2, ShieldCheck, User, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Vui lòng nhập đầy đủ thông tin đăng nhập'); return; }
    setLoading(true); setError('');
    try {
      await login(username, password);
      navigate('/workspace');
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 25% 25%, rgba(56,139,253,0.08) 0%, transparent 50%), radial-gradient(ellipse at 75% 75%, rgba(124,58,237,0.06) 0%, transparent 50%)' }}>

      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-8 shadow-2xl">

          {/* Logo */}
          <div className="flex flex-col items-center mb-7">
            <img src="/logo.png" alt="Local AI Logo" className="w-16 h-16 rounded-2xl object-cover shadow-xl mb-1" />
            <h1 className="text-[18px] font-bold text-text-primary mb-1">Local AI</h1>
            <p className="text-[15px] text-text-muted text-center leading-relaxed">
              Hệ thống xử lý văn bản nội bộ<br />
              <span className="text-danger/80">● Bảo mật Cấp III · Ngoại tuyến</span>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div>
              <label className="text-[15px] font-semibold text-text-secondary block mb-1.5">Tên đăng nhập</label>
              <div className="relative">
                <User className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Tên đăng nhập nội bộ"
                  className="input-base pl-9"
                />
              </div>
            </div>

            <div>
              <label className="text-[15px] font-semibold text-text-secondary block mb-1.5">
                Mật khẩu <span className="text-text-muted font-normal">(tối thiểu 8 ký tự)</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="input-base pl-9 pr-10"
                />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-danger/10 border border-danger/30 text-[15px] text-danger">
                <Lock className="w-3.5 h-3.5 flex-shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-[14px] font-semibold transition-all duration-200 mt-1
                ${loading ? 'bg-hover text-text-muted cursor-not-allowed' : 'bg-accent hover:bg-accent-hover text-white cursor-pointer shadow-md hover:shadow-accent/20'}`}
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin-fast" /> Đang xác thực...</>
              ) : (
                <><Lock className="w-4 h-4" /> Đăng nhập</>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-5 pt-4 border-t border-border flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
            <span className="text-[12px] text-text-muted">Dữ liệu không rời khỏi mạng nội bộ</span>
          </div>

          <div className="mt-3 p-2.5 rounded-lg bg-elevated border border-border text-center">
            <span className="text-[12px] text-text-muted">Liên hệ Admin để được cấp tài khoản</span>
          </div>
        </div>
      </div>
    </div>
  );
};
