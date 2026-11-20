import React, { useState } from 'react';
import { api } from '../../lib/api';
import { User } from '../../types';
import { ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('auditor@demo-bank.com');
  const [password, setPassword] = useState('Auditor@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.login(email, password);
      onLoginSuccess(res.user);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const setCredentials = (role: 'admin' | 'auditor') => {
    if (role === 'admin') {
      setEmail('admin@demo-bank.com');
      setPassword('Admin@123');
    } else {
      setEmail('auditor@demo-bank.com');
      setPassword('Auditor@123');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white shadow-lg mb-4">
          <ShieldCheck className="w-8 h-8 text-sky-400" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">DecisionTrace</h2>
        <p className="mt-2 text-sm text-slate-600">
          Financial Decision Flight Recorder & Audit Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200 rounded-xl sm:px-10">
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
                placeholder="name@bank.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 shadow-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Authenticating...' : 'Sign in to Dashboard'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials Fill */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Demo Credentials (Local Prototype)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCredentials('auditor')}
                className="py-1.5 px-2.5 text-xs font-medium rounded-md bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 text-left"
              >
                Auditor <span className="text-slate-400 block text-[10px]">auditor@demo-bank.com</span>
              </button>
              <button
                type="button"
                onClick={() => setCredentials('admin')}
                className="py-1.5 px-2.5 text-xs font-medium rounded-md bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 text-left"
              >
                Admin <span className="text-slate-400 block text-[10px]">admin@demo-bank.com</span>
              </button>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Visionet TechThon 2026 • Team CodeGenesis • Internal Staff Tool
        </p>
      </div>
    </div>
  );
};
