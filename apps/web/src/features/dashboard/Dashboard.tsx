import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { CaseSummary } from '../../types';
import { DecisionDistributionChart } from './DecisionDistributionChart';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  ShieldCheck,
  AlertOctagon,
  RefreshCw,
  Search,
  XCircle,
  GitCompare,
} from 'lucide-react';

interface DashboardProps {
  onSelectCase: (caseId: string) => void;
  onNavigateToCases: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectCase, onNavigateToCases }) => {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);

  // Integrity "Verify All" states
  const [verifyingAll, setVerifyingAll] = useState(false);
  const [verificationMap, setVerificationMap] = useState<
    Record<string, { verified: boolean; chainConsistent: boolean; failure?: any }>
  >({});
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const [failedCases, setFailedCases] = useState<
    Array<{ caseId: string; failureReason: string; brokenSequence: number; details?: string }>
  >([]);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await api.getCases({ limit: 15 });
        setCases(res.data);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleVerifyAll = async () => {
    if (cases.length === 0) return;
    setVerifyingAll(true);
    const newMap: Record<string, { verified: boolean; chainConsistent: boolean; failure?: any }> = {};
    const failures: Array<{ caseId: string; failureReason: string; brokenSequence: number; details?: string }> = [];

    try {
      await Promise.all(
        cases.map(async (c) => {
          try {
            const res = await api.verifyCase(c.caseId);
            const isOk = res.verified || res.chainConsistent;
            newMap[c.caseId] = {
              verified: res.verified,
              chainConsistent: res.chainConsistent,
              failure: res.failure,
            };
            if (!isOk) {
              failures.push({
                caseId: c.caseId,
                failureReason: res.failure?.reason || 'Integrity Violation',
                brokenSequence: res.failure?.sequence || 1,
                details: res.failure?.details,
              });
            }
          } catch (err: any) {
            newMap[c.caseId] = {
              verified: false,
              chainConsistent: false,
              failure: { reason: 'VERIFY_ERROR', sequence: 0, details: err.message },
            };
            failures.push({
              caseId: c.caseId,
              failureReason: 'VERIFICATION_FAILED',
              brokenSequence: 0,
              details: err.message,
            });
          }
        })
      );
      setVerificationMap(newMap);
      setFailedCases(failures);
      setLastVerifiedAt(new Date().toLocaleTimeString());
    } finally {
      setVerifyingAll(false);
    }
  };

  // Reconciled counts
  const totalCases = cases.length;
  const approved = cases.filter(
    (c) => c.status === 'APPROVED' || c.latestDecision === 'APPROVED' || c.finalDecision === 'APPROVED'
  ).length;
  const rejected = cases.filter(
    (c) =>
      c.status === 'REJECTED' ||
      c.latestDecision === 'REJECTED' ||
      c.finalDecision === 'REJECTED' ||
      (c.status === 'CLOSED' && c.latestDecision === 'REJECTED')
  ).length;
  const underReview = cases.filter((c) => c.status === 'UNDER_REVIEW').length;
  const overrides = cases.filter((c) => Boolean(c.isOverridden)).length;

  // Verified OK count
  const verifiedOkCount = Object.values(verificationMap).filter(
    (v) => v.verified || v.chainConsistent
  ).length;

  // Helper: Source system badge
  const getSourceDisplay = (c: CaseSummary) => {
    const src = (c.sourceSystem || '').toLowerCase();
    const id = c.caseId.toLowerCase();
    if (src.includes('minibank') || id.startsWith('minibank')) {
      return { label: 'MiniBank', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (src.includes('commercial') || id.includes('comm')) {
      return { label: 'Commercial Core', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    if (src.includes('retail') || id.includes('prime') || id.includes('loan_case') || id.includes('high_risk')) {
      return { label: 'Retail LOS', badgeClass: 'bg-sky-50 text-sky-700 border-sky-200' };
    }
    return { label: c.sourceSystem || 'Loan Engine', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  // Helper: Risk Score Color-Coding (0-39 green, 40-69 amber, 70+ red)
  const getRiskScoreBadge = (score: number | null) => {
    if (score == null) return <span className="text-slate-400 font-mono text-xs">—</span>;
    if (score < 40) {
      return (
        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
          {score}/100
        </span>
      );
    }
    if (score < 70) {
      return (
        <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-amber-50 text-amber-700 border border-amber-200">
          {score}/100
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-rose-50 text-rose-700 border border-rose-200">
        {score}/100
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Critical Tamper Alert Banner (Displayed if any case fails verification) */}
      {failedCases.length > 0 && (
        <div className="p-4 sm:p-5 bg-rose-50 border-2 border-rose-500 rounded-2xl text-rose-950 shadow-md space-y-3 animate-in fade-in duration-300">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5 font-bold text-rose-800 text-sm sm:text-base">
              <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
              <span>CRITICAL INTEGRITY FAILURE: Tampering Detected in {failedCases.length} Case Chain(s)</span>
            </div>
            <button
              onClick={() => setFailedCases([])}
              className="text-xs font-semibold text-rose-700 hover:text-rose-900 px-2 py-1 rounded bg-rose-100 hover:bg-rose-200 transition-colors"
            >
              Dismiss Banner
            </button>
          </div>

          <p className="text-xs text-rose-800 leading-relaxed">
            The cryptographic verification engine detected hash chain linkage breaks or altered stored payloads.
            Inspect the identified cases immediately:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 font-mono text-xs">
            {failedCases.map((fc) => (
              <div
                key={fc.caseId}
                className="bg-white/90 p-3 rounded-xl border border-rose-300 flex items-center justify-between gap-2 shadow-sm"
              >
                <div>
                  <span className="font-bold text-rose-950 block">{fc.caseId}</span>
                  <span className="text-[11px] text-rose-700">
                    Broken at Seq #{fc.brokenSequence} • Reason: <strong>{fc.failureReason}</strong>
                  </span>
                </div>
                <button
                  onClick={() => onSelectCase(fc.caseId)}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-sans font-semibold shrink-0 transition-colors"
                >
                  Inspect →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/20 text-sky-300 border border-sky-400/30 mb-3">
            <Shield className="w-3.5 h-3.5" /> Decision Flight Recorder
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

      {/* 3. Reconciled Summary Metrics Grid (6 Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Tracked Cases */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Total Cases</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 font-mono">
            {loading ? '—' : totalCases}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">All indexed cases</div>
        </div>

        {/* Approved */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-emerald-600 font-mono">
            {loading ? '—' : approved}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">Sanctioned decisions</div>
        </div>

        {/* Rejected */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Rejected</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-rose-600 font-mono">
            {loading ? '—' : rejected}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">Declined or closed</div>
        </div>

        {/* Under Review */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Under Review</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-amber-600 font-mono">
            {loading ? '—' : underReview}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">Pending underwriter</div>
        </div>

        {/* Overrides */}
        <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium uppercase tracking-wider">Overrides</span>
            <GitCompare className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-purple-600 font-mono">
            {loading ? '—' : overrides}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 truncate">Human supervisory</div>
        </div>

        {/* Integrity Card (Verified OK / Total + Verify All button) */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 p-4 sm:p-5 rounded-xl border border-slate-800 text-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-300">
            <span className="text-xs font-medium uppercase tracking-wider">Integrity</span>
            <ShieldCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-bold font-mono">
            {lastVerifiedAt ? (
              <span className={failedCases.length === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {verifiedOkCount} / {totalCases} OK
              </span>
            ) : (
              <span className="text-slate-400 text-base">Unchecked</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-1">
            <span className="text-[10px] text-slate-400 truncate">
              {lastVerifiedAt ? `Verified: ${lastVerifiedAt}` : 'Ready to verify'}
            </span>
            <button
              onClick={handleVerifyAll}
              disabled={verifyingAll || totalCases === 0}
              className="px-2 py-1 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-[10px] font-bold rounded flex items-center gap-1 transition-colors shrink-0"
              title="Audit and verify all case cryptographic hash chains"
            >
              {verifyingAll ? (
                <>
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Verifying...
                </>
              ) : (
                'Verify All'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 4. Chart Section */}
      <DecisionDistributionChart cases={cases} />

      {/* 5. Recent Decisions Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
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
              Run <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">npm run seed:cases</code> to ingest decision cases into the ledger.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="min-w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Verified</th>
                  <th className="py-2.5 px-3">Case ID</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Subject</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Decision Outcome</th>
                  <th className="py-2.5 px-3">Risk Score</th>
                  <th className="py-2.5 px-3">Events</th>
                  <th className="py-2.5 px-3">Last Activity</th>
                  <th className="py-2.5 px-4 text-right sticky right-0 bg-slate-50 shadow-sm">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map((c) => {
                  const src = getSourceDisplay(c);
                  const verStatus = verificationMap[c.caseId];

                  return (
                    <tr key={c._id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Verified Tick / Cross */}
                      <td className="py-2.5 px-3 text-center">
                        {verStatus ? (
                          verStatus.verified || verStatus.chainConsistent ? (
                            <span title="Hash Chain Verified Intact" className="inline-flex items-center">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            </span>
                          ) : (
                            <span
                              title={`Tamper Detected at Seq #${verStatus.failure?.sequence || 1}: ${verStatus.failure?.reason || 'Integrity Failure'}`}
                              className="inline-flex items-center"
                            >
                              <AlertOctagon className="w-4 h-4 text-rose-600 animate-pulse" />
                            </span>
                          )
                        ) : (
                          <span title="Unchecked — click 'Verify All' above" className="inline-flex items-center">
                            <Shield className="w-3.5 h-3.5 text-slate-300 hover:text-slate-500 transition-colors" />
                          </span>
                        )}
                      </td>

                      {/* Truncated Case ID with Tooltip */}
                      <td className="py-2.5 px-3">
                        <div
                          className="font-mono font-bold text-slate-900 truncate max-w-[130px] sm:max-w-[160px] cursor-help"
                          title={c.caseId}
                        >
                          {c.caseId}
                        </div>
                      </td>

                      {/* Source Column */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${src.badgeClass}`}
                        >
                          {src.label}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-2.5 px-3">
                        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {c.caseType}
                        </span>
                      </td>

                      {/* Subject Ref */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate max-w-[110px]" title={c.subjectRef}>
                        {c.subjectRef}
                      </td>

                      {/* Status + Overridden Tag */}
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
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
                          {c.isOverridden && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                              Overridden
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Decision Outcome */}
                      <td className="py-2.5 px-3">
                        {c.isOverridden && c.initialDecision && c.finalDecision ? (
                          <span className="text-purple-900 font-semibold text-[11px]">
                            Initial: <span className="font-mono">{c.initialDecision}</span> → Final:{' '}
                            <span className="font-mono">{c.finalDecision}</span>
                          </span>
                        ) : (
                          <span className="font-medium text-slate-800">{c.latestDecision || '—'}</span>
                        )}
                      </td>

                      {/* Color-Coded Risk Score */}
                      <td className="py-2.5 px-3">
                        {getRiskScoreBadge(c.latestRiskScore)}
                      </td>

                      {/* Events */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{c.eventCount}</td>

                      {/* Last Activity */}
                      <td className="py-2.5 px-3 text-[11px] text-slate-500">
                        {new Date(c.lastEventAt).toLocaleTimeString()}
                      </td>

                      {/* Unclipped Sticky Action Column */}
                      <td className="py-2.5 px-4 text-right sticky right-0 bg-white group-hover:bg-slate-50/90 shadow-sm shrink-0">
                        <button
                          onClick={() => onSelectCase(c.caseId)}
                          className="text-xs font-semibold text-sky-600 hover:text-sky-800 hover:underline inline-flex items-center gap-1"
                        >
                          Inspect →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
