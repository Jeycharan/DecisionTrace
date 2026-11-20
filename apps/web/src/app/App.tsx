import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { User } from '../types';
import { Login } from '../features/auth/Login';
import { Dashboard } from '../features/dashboard/Dashboard';
import { CasesList } from '../features/cases/CasesList';
import { CaseDetail } from '../features/cases/CaseDetail';
import { Settings } from '../features/settings/Settings';
import {
  ShieldCheck,
  LayoutDashboard,
  FileText,
  Sliders,
  LogOut,
  User as UserIcon,
} from 'lucide-react';

type View = 'dashboard' | 'cases' | 'case-detail' | 'settings';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const me = await api.getMe();
        setUser(me);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, []);

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setCurrentView('dashboard');
  };

  const handleSelectCase = (caseId: string) => {
    setSelectedCaseId(caseId);
    setCurrentView('case-detail');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500 text-sm">
        <ShieldCheck className="w-8 h-8 animate-pulse text-sky-600 mr-3" />
        Initialising DecisionTrace Flight Recorder...
      </div>
    );
  }

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      {/* Global Navigation Header */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Product Title */}
          <div className="flex items-center gap-6">
            <div
              onClick={() => setCurrentView('dashboard')}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md group-hover:bg-sky-500 transition-colors">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold tracking-tight text-base sm:text-lg block leading-none">
                  DecisionTrace
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Financial Flight Recorder</span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentView === 'dashboard'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <LayoutDashboard className="w-4 h-4" /> Dashboard
              </button>
              <button
                onClick={() => setCurrentView('cases')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentView === 'cases' || currentView === 'case-detail'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <FileText className="w-4 h-4" /> Cases
              </button>
              <button
                onClick={() => setCurrentView('settings')}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 ${
                  currentView === 'settings'
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Sliders className="w-4 h-4" /> Settings
              </button>
            </nav>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-white leading-tight">{user.displayName}</span>
              <span className="text-[10px] font-mono text-sky-400 leading-tight">
                {user.role} • {user.tenantId}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold">
              <UserIcon className="w-4 h-4 text-slate-300" />
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Row */}
        <div className="md:hidden flex items-center justify-around border-t border-slate-800 py-2 text-xs">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-1 py-1 px-3 rounded ${
              currentView === 'dashboard' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
          </button>
          <button
            onClick={() => setCurrentView('cases')}
            className={`flex items-center gap-1 py-1 px-3 rounded ${
              currentView === 'cases' || currentView === 'case-detail'
                ? 'bg-slate-800 text-white font-bold'
                : 'text-slate-400'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Cases
          </button>
          <button
            onClick={() => setCurrentView('settings')}
            className={`flex items-center gap-1 py-1 px-3 rounded ${
              currentView === 'settings' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Settings
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentView === 'dashboard' && (
          <Dashboard
            onSelectCase={handleSelectCase}
            onNavigateToCases={() => setCurrentView('cases')}
          />
        )}

        {currentView === 'cases' && (
          <CasesList onSelectCase={handleSelectCase} />
        )}

        {currentView === 'case-detail' && selectedCaseId && (
          <CaseDetail caseId={selectedCaseId} onBack={() => setCurrentView('cases')} />
        )}

        {currentView === 'settings' && <Settings user={user} />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        DecisionTrace • Team CodeGenesis • Visionet TechThon 2026 • Round 2 Hackathon Prototype
      </footer>
    </div>
  );
};
