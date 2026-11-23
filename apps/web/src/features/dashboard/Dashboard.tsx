import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { CaseSummary } from '../../types';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
  Search,
} from 'lucide-react';

interface DashboardProps {
  onSelectCase: (caseId: string) => void;
  onNavigateToCases: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectCase, onNavigateToCases }) => {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.getCases({ limit: 10 });
        setCases(res.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalCases = cases.length;
  const underReview = cases.filter((c) => c.status === 'UNDER_REVIEW').length;
  const approved = cases.filter((c) => c.status === 'APPROVED').length;
  const totalEvents = cases.reduce((acc, c) => acc + c.eventCount, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/20 text-sky-300 border border-sky-400/30 mb-3">
            <Shield className="w-3.5 h-3.5" /> Prototype Flight Recorder
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Financial Decision Traceability</h1>
          <p className="mt-2 text-slate-300 max-w-xl text-sm leading-relaxed">
            Audit evidence snapshots, track decision lifecycles, and verify cryptographically sealed SHA-256 event chains.
          </p>
        </div>
        <button
          onClick={onNavigateToCases}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl font-medium text-sm transition-colors shadow-sm shrink-0"
        >
          <Search className="w-4 h-4" /> Browse All Cases
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Tracked Cases</span>
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900">{loading ? '—' : totalCases}</div>
          <div className="mt-1 text-xs text-slate-500">Indexed financial decision cases</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Under Review</span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-amber-600">{loading ? '—' : underReview}</div>
          <div className="mt-1 text-xs text-slate-500">Awaiting reviewer or dispute action</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Approved Decisions</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-emerald-600">{loading ? '—' : approved}</div>
          <div className="mt-1 text-xs text-slate-500">Deterministic or overridden approvals</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm font-medium">Hash-chained events</span>
            <Layers className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="mt-3 text-3xl font-bold text-indigo-600">{loading ? '—' : totalEvents}</div>
          <div className="mt-1 text-xs text-slate-500">In hash chains across cases</div>
        </div>
      </div>

      {/* Recent Decisions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent Financial Decisions</h2>
            <p className="text-xs text-slate-500 mt-0.5">Chronologically ordered decision records</p>
          </div>
          <button
            onClick={onNavigateToCases}
            className="text-xs font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1"
          >
            View all <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading recent cases...</div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center">
            <AlertTriangle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No cases recorded yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Run <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">npm run send-events</code> to ingest sample loan decisions into the ledger.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Case ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Decision Outcome</th>
                  <th className="py-3 px-4">Risk Score</th>
                  <th className="py-3 px-4">Events</th>
                  <th className="py-3 px-4">Last Activity</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((c) => (
                  <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-900">
                      {c.caseId}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                        {c.caseType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">{c.subjectRef}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : c.status === 'UNDER_REVIEW'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {c.isOverridden && c.initialDecision && c.finalDecision ? (
                        <span className="text-purple-900 font-semibold text-xs">
                          Initial: <span className="font-mono">{c.initialDecision}</span> → Final: <span className="font-mono">{c.finalDecision}</span> <span className="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold uppercase">(override)</span>
                        </span>
                      ) : (
                        <span className="font-medium text-slate-800">{c.latestDecision || '—'}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {c.latestRiskScore != null ? `${c.latestRiskScore}/100` : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-xs">{c.eventCount}</td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {new Date(c.lastEventAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => onSelectCase(c.caseId)}
                        className="text-xs font-medium text-sky-600 hover:text-sky-800 hover:underline"
                      >
                        Inspect Timeline →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
