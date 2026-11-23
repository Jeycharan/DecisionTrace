import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { CaseSummary, LedgerEvent, VerificationResult, Checkpoint, ReplayComparison } from '../../types';
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  AlertOctagon,
  Copy,
  Check,
  Clock,
  Layers,
  FileCode,
  ChevronDown,
  ChevronUp,
  Bookmark,
  RefreshCw,
  Play,
  CheckCircle2,
  GitCompare,
  Printer,
} from 'lucide-react';

interface CaseDetailProps {
  caseId: string;
  onBack: () => void;
}

export const CaseDetail: React.FC<CaseDetailProps> = ({ caseId, onBack }) => {
  const [caseDoc, setCaseDoc] = useState<CaseSummary | null>(null);
  const [events, setEvents] = useState<LedgerEvent[]>([]);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayComparison | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [expandedPayloads, setExpandedPayloads] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<'timeline' | 'checkpoints'>('timeline');

  const loadCaseData = async () => {
    setLoading(true);
    try {
      const [c, evs, ckpts] = await Promise.all([
        api.getCase(caseId),
        api.getCaseEvents(caseId),
        api.getCaseCheckpoints(caseId).catch(() => []),
      ]);
      setCaseDoc(c);
      setEvents(evs);
      setCheckpoints(ckpts);
    } catch (err) {
      console.error('Failed to load case detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCaseData();
  }, [caseId]);

  const handleVerify = async () => {
    setVerifying(true);
    try {
      const result = await api.verifyCase(caseId);
      setVerificationResult(result);
    } catch (err) {
      console.error('Verification call failed:', err);
    } finally {
      setVerifying(false);
    }
  };

  const handleReplay = async () => {
    setReplaying(true);
    try {
      const res = await api.replayCase(caseId);
      setReplayResult(res);
    } catch (err) {
      console.error('Replay failed:', err);
    } finally {
      setReplaying(false);
    }
  };

  const handleExportReport = async () => {
    const token = localStorage.getItem('dt_token');
    try {
      const res = await fetch(`/api/v1/cases/${encodeURIComponent(caseId)}/report`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const html = await res.text();
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
      }
    } catch (err) {
      console.error('Failed to export report:', err);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(label);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const togglePayload = (eventId: string) => {
    setExpandedPayloads((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600 mb-2" />
        Loading case flight recorder...
      </div>
    );
  }

  if (!caseDoc) {
    return (
      <div className="p-8 bg-white rounded-xl border border-slate-200 text-center">
        <p className="text-slate-600 text-sm">Case not found.</p>
        <button onClick={onBack} className="mt-4 text-xs font-semibold text-sky-600">
          ← Back to Cases
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Cases
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportReport}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors"
            title="Export Certified Audit Certificate"
          >
            <Printer className="w-3.5 h-3.5 text-sky-600" /> Export Audit Report (PDF)
          </button>
          <span className="text-xs text-slate-500 font-mono">Tenant: {caseDoc.tenantId}</span>
          <button
            onClick={loadCaseData}
            className="p-1.5 text-slate-500 hover:text-slate-700 bg-white border border-slate-200 rounded-lg shadow-sm"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Case Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                {caseDoc.caseId}
              </h1>
              <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-700">
                {caseDoc.caseType}
              </span>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  caseDoc.status === 'APPROVED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : caseDoc.status === 'REJECTED'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : caseDoc.status === 'UNDER_REVIEW'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {caseDoc.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-mono">
              Subject Ref: <span className="font-semibold text-slate-700">{caseDoc.subjectRef}</span> (Pseudonymous identifier)
            </p>
          </div>

          {/* Quick Metrics Badge */}
          <div className="flex items-center gap-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-center">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Latest Outcome</span>
              <span className="font-bold text-slate-900 text-sm">{caseDoc.latestDecision || 'None'}</span>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-center">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Risk Score</span>
              <span className="font-bold text-slate-900 text-sm">
                {caseDoc.latestRiskScore != null ? `${caseDoc.latestRiskScore}/100` : '—'}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg text-center">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Event Count</span>
              <span className="font-bold text-indigo-600 text-sm font-mono">{caseDoc.eventCount}</span>
            </div>
          </div>
        </div>

        {/* Verification Trigger Banner */}
        <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Cryptographic Integrity Verification</h2>
              <p className="text-xs text-slate-500">
                Audit SHA-256 hash linkages and verify against HMAC-signed checkpoints.
              </p>
            </div>
          </div>

          <button
            onClick={handleVerify}
            disabled={verifying}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 shrink-0"
          >
            {verifying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verifying Hashes...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 text-sky-400" /> Verify Case Integrity
              </>
            )}
          </button>
        </div>

        {/* Verification Result Breakdown */}
        {verificationResult && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs space-y-3 transition-all ${
              verificationResult.verified
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : verificationResult.chainConsistent
                ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                : 'bg-rose-50/70 border-rose-200 text-rose-950'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {verificationResult.verified ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : verificationResult.chainConsistent ? (
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                ) : (
                  <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <div>
                  <span className="font-bold text-sm">
                    {verificationResult.verified
                      ? 'Verified Against Signed Checkpoint Anchor'
                      : verificationResult.chainConsistent
                      ? 'Hash Chain Internally Consistent (Anchor Caveat)'
                      : 'Integrity Verification FAILED — Tampering Detected'}
                  </span>
                  <span className="block text-[11px] opacity-80 mt-0.5">
                    Verified {verificationResult.checkedEvents} events at{' '}
                    {new Date(verificationResult.verifiedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wider bg-white/80 border border-current">
                {verificationResult.checkpointStatus}
              </span>
            </div>

            {/* Failure Diagnostic Box */}
            {verificationResult.failure && (
              <div className="p-3 bg-white rounded-lg border border-rose-300 text-rose-900 font-mono space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-xs">
                  <AlertOctagon className="w-4 h-4 text-rose-600" /> Tamper Detected at Sequence #
                  {verificationResult.failure.sequence}
                </div>
                <div className="text-[11px]">
                  Reason Code: <span className="font-semibold text-rose-700">{verificationResult.failure.reason}</span>
                </div>
                {verificationResult.failure.details && (
                  <div className="text-[11px] text-slate-600">{verificationResult.failure.details}</div>
                )}
                <div className="text-[10px] text-slate-400">Event ID: {verificationResult.failure.eventId}</div>
              </div>
            )}

            {/* Checkpoint Coverage Indicator */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-current/10">
              <div className="bg-white/60 p-2 rounded">
                <span className="block text-[10px] opacity-70">Total Checked Events</span>
                <span className="font-bold font-mono">{verificationResult.checkedEvents}</span>
              </div>
              <div className="bg-white/60 p-2 rounded">
                <span className="block text-[10px] opacity-70">Signed Checkpoint Sequence</span>
                <span className="font-bold font-mono">
                  {verificationResult.checkpointCoverage.latestCheckpointSequence != null
                    ? `#${verificationResult.checkpointCoverage.latestCheckpointSequence}`
                    : 'None yet'}
                </span>
              </div>
              <div className="bg-white/60 p-2 rounded">
                <span className="block text-[10px] opacity-70">Uncovered Events</span>
                <span className="font-bold font-mono">
                  {verificationResult.checkpointCoverage.uncoveredEventCount}
                </span>
              </div>
            </div>

            {/* Caveat & Limitations Notice */}
            {verificationResult.limitations.length > 0 && (
              <div className="pt-2 border-t border-current/10 space-y-1 text-[11px] opacity-85">
                <div className="font-semibold text-[10px] uppercase tracking-wider">Audit Notice & Limitations:</div>
                {verificationResult.limitations.map((lim, idx) => (
                  <p key={idx}>• {lim}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Replay Trigger Banner */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Deterministic Replay Engine</h2>
              <p className="text-xs text-slate-500">
                Execute the frozen decision snapshot against the exact historical underwriting ruleset.
              </p>
            </div>
          </div>

          <button
            onClick={handleReplay}
            disabled={replaying}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-900 hover:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50 shrink-0"
          >
            {replaying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Evaluating Rules...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-indigo-300" /> Replay Decision Logic
              </>
            )}
          </button>
        </div>

        {/* Replay Result Breakdown */}
        {replayResult && (
          <div
            className={`mt-4 p-4 rounded-xl border text-xs space-y-3 transition-all ${
              replayResult.reproducible
                ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                : 'bg-amber-50/70 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {replayResult.reproducible ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0" />
                )}
                <div>
                  <span className="font-bold text-sm">
                    {replayResult.reproducible
                      ? '100% Deterministic Reproducibility Confirmed'
                      : 'Logic Divergence or Historical Rule Unavailable'}
                  </span>
                  <span className="block text-[11px] opacity-80 mt-0.5 font-mono">
                    Ruleset: {replayResult.rulesetId}@{replayResult.rulesetVersion} • Replayed at{' '}
                    {new Date(replayResult.replayedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase tracking-wider bg-white/80 border border-current">
                {replayResult.versionStatus}
              </span>
            </div>

            {/* Comparison Pill Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-current/10">
              <div className="bg-white/80 p-3 rounded-lg border border-slate-200 space-y-1 text-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Original Stored Outcome
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{replayResult.original.outcome}</span>
                  {replayResult.original.riskScore != null && (
                    <span className="text-xs font-mono text-slate-500">
                      Score: {replayResult.original.riskScore}/100
                    </span>
                  )}
                </div>
                {replayResult.original.reasonCodes.length > 0 && (
                  <div className="text-[10px] text-slate-500 font-mono">
                    Reasons: {replayResult.original.reasonCodes.join(', ')}
                  </div>
                )}
              </div>

              <div className="bg-white/80 p-3 rounded-lg border border-slate-200 space-y-1 text-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  Replayed Evaluation Output
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">
                    {replayResult.replayed ? replayResult.replayed.outcome : 'N/A'}
                  </span>
                  {replayResult.replayed?.riskScore != null && (
                    <span className="text-xs font-mono text-slate-500">
                      Score: {replayResult.replayed.riskScore}/100
                    </span>
                  )}
                </div>
                {replayResult.replayed?.reasonCodes && replayResult.replayed.reasonCodes.length > 0 && (
                  <div className="text-[10px] text-slate-500 font-mono">
                    Reasons: {replayResult.replayed.reasonCodes.join(', ')}
                  </div>
                )}
              </div>
            </div>

            {/* Explanation & Differences */}
            <div className="text-[11px] leading-relaxed pt-1">
              <p className="font-medium">{replayResult.explanation}</p>
              {replayResult.differences.length > 0 && (
                <ul className="list-disc pl-4 mt-1 space-y-0.5 text-rose-800 font-mono text-[10px]">
                  {replayResult.differences.map((diff, dIdx) => (
                    <li key={dIdx}>{diff}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'timeline'
              ? 'border-sky-600 text-sky-700 bg-white/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" /> Case Timeline ({events.length})
        </button>
        <button
          onClick={() => setActiveTab('checkpoints')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'checkpoints'
              ? 'border-sky-600 text-sky-700 bg-white/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Bookmark className="w-4 h-4" /> Signed Checkpoints ({checkpoints.length})
        </button>
      </div>

      {/* Tab: Checkpoints List */}
      {activeTab === 'checkpoints' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Signed Checkpoints</h2>
            <p className="text-xs text-slate-500">
              Checkpoints provide an anchor against deletion of recent events. Prototype signs using HMAC-SHA-256.
            </p>
          </div>

          {checkpoints.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No checkpoints recorded yet. Checkpoints are automatically generated every 10 events.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {checkpoints.map((ckpt) => (
                <div key={ckpt._id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-bold text-slate-900">Checkpoint #{ckpt.sequence}</span>
                    <span className="text-slate-400">{new Date(ckpt.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs grid grid-cols-1 md:grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg font-mono">
                    <div>
                      <span className="text-slate-400 text-[10px] block">Checkpoint ID</span>
                      <span className="text-slate-800">{ckpt.checkpointId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px] block">Algorithm & Key</span>
                      <span className="text-slate-800">{ckpt.signatureAlgorithm} ({ckpt.keyId})</span>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-slate-400 text-[10px] block">Sealed Event Hash</span>
                      <span className="text-indigo-600 break-all">{ckpt.eventHash}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Chronological Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="p-12 bg-white rounded-xl border border-slate-200 text-center text-slate-400 text-sm">
              No events found for this case.
            </div>
          ) : (
            <div className="relative pl-6 sm:pl-8 border-l-2 border-slate-200 space-y-6 my-2">
              {events.map((event) => {
                const decision = event.payload?.decision as Record<string, unknown> | undefined;
                const rules = event.payload?.rules as Record<string, unknown> | undefined;
                const model = event.payload?.model as Record<string, unknown> | undefined;
                const override = event.payload?.override as Record<string, unknown> | undefined;
                const reasonCodes = event.payload?.reasonCodes as string[] | undefined;
                const evidence = (event.payload?.evidence || event.payload?.application) as Record<string, unknown> | undefined;
                const shapFactors = (event.payload?.shapFactors || event.payload?.featureContributions || (model as any)?.featureContributions || (decision as any)?.shapFactors) as Array<{ feature?: string; feature_label?: string; feature_value?: number; shap_value?: number; direction?: string; impact_percentage?: number }> | undefined;
                const approver = (override?.approver || override?.approvedBy || event.payload?.reviewedBy || event.payload?.approver || event.payload?.assignedTo) as string | undefined;
                const overrideReason = (override?.reason || event.payload?.reason) as string | undefined;

                const isBrokenEvent = Boolean(
                  verificationResult?.failure && verificationResult.failure.sequence === event.sequence
                );
                const checkpointMismatch = Boolean(
                  verificationResult?.checkpointFailures?.find((cf) => cf.sequence === event.sequence)
                );
                const isTampered = isBrokenEvent || checkpointMismatch;
                const detectionReason = isBrokenEvent
                  ? verificationResult?.failure?.reason === 'EVENT_HASH_MISMATCH'
                    ? 'Hash Mismatch (Canonical recomputed SHA-256 does not match stored eventHash)'
                    : verificationResult?.failure?.reason === 'PREVIOUS_HASH_MISMATCH'
                    ? 'Broken Previous-Hash Link (prevHash does not match prior eventHash)'
                    : verificationResult?.failure?.reason === 'SEQUENCE_GAP'
                    ? 'Missing Sequence Number (Discontinuity in sequence chain)'
                    : `Integrity Failure: ${verificationResult?.failure?.reason}`
                  : checkpointMismatch
                  ? 'Checkpoint Mismatch (Event hash diverges from HMAC-signed checkpoint anchor)'
                  : null;

                const isExpanded = expandedPayloads[event.eventId];

                return (
                  <div key={event._id} className="relative group">
                    {/* Timeline Node Badge */}
                    <div
                      className={`absolute -left-[35px] sm:-left-[43px] top-4 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold shadow-sm transition-all ${
                        isTampered
                          ? 'bg-rose-600 text-white border-2 border-rose-700 animate-pulse ring-4 ring-rose-200'
                          : 'bg-white border-2 border-slate-300 group-hover:border-sky-600 text-slate-700'
                      }`}
                    >
                      {event.sequence}
                    </div>

                    {/* Event Card */}
                    <div
                      className={`rounded-xl border shadow-sm p-5 space-y-4 transition-all ${
                        isTampered
                          ? 'border-2 border-rose-500 bg-rose-50/40 shadow-lg shadow-rose-100 ring-1 ring-rose-400'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Tamper Alert Banner */}
                      {isTampered && (
                        <div className="p-3.5 bg-rose-100 border border-rose-300 rounded-lg text-rose-900 text-xs space-y-1.5 shadow-sm">
                          <div className="flex items-center gap-2 font-bold text-sm text-rose-700">
                            <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 animate-bounce" />
                            FIRST BROKEN EVENT DETECTED (Sequence #{event.sequence})
                          </div>
                          <div className="text-xs">
                            <span className="font-semibold text-rose-950">Detected by:</span>{' '}
                            <span className="font-mono bg-rose-200/80 text-rose-950 px-2 py-0.5 rounded font-bold">
                              {detectionReason}
                            </span>
                          </div>
                          {verificationResult?.failure?.details && (
                            <div className="text-[11px] text-rose-800 font-mono bg-white/70 p-2 rounded border border-rose-200">
                              Diagnostic: {verificationResult.failure.details}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${
                              event.eventType === 'DECISION_MADE'
                                ? 'bg-sky-100 text-sky-800'
                                : event.eventType === 'DECISION_OVERRIDDEN'
                                ? 'bg-purple-100 text-purple-800'
                                : event.eventType === 'APPROVAL_CONFIRMED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : event.eventType === 'EVIDENCE_CAPTURED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {event.eventType}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            ID: {event.eventId}
                          </span>
                          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                            Seq #{event.sequence}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1 font-mono text-[11px]" title="Timestamp">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(event.occurredAt).toLocaleString()}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-[11px] text-slate-600">
                            src: {event.sourceSystem}
                          </span>
                        </div>
                      </div>

                      {/* Event Context & Badges */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {/* Decision Outcome & Risk Score */}
                        {Boolean(decision?.outcome) && (
                          <div className="p-2.5 rounded-lg bg-sky-50/70 border border-sky-100">
                            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Decision Outcome</span>
                            <span className="font-bold text-sky-900 text-sm">{String(decision?.outcome)}</span>
                            {decision?.riskScore != null && (
                              <span className="text-slate-500 block text-[11px] mt-0.5 font-mono">
                                Risk Score: <strong>{String(decision.riskScore)}</strong>/100
                              </span>
                            )}
                          </div>
                        )}

                        {/* Ruleset & Model Metadata */}
                        {Boolean(rules || model) && (
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 font-mono text-[11px] space-y-1">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold font-sans">Logic Versioning</span>
                            {Boolean(rules) && (
                              <div className="text-slate-700 truncate">
                                Rule: <span className="font-semibold text-slate-900">{String(rules?.rulesetId ?? '')}@{String(rules?.rulesetVersion ?? '')}</span>
                              </div>
                            )}
                            {Boolean(model) && (
                              <div className="text-slate-700 truncate">
                                Model: <span className="font-semibold text-indigo-700">{String(model?.modelId ?? '')}@{String(model?.modelVersion ?? '')}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Snapshot Reference */}
                        {Boolean(event.snapshotId) && (
                          <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs flex items-center gap-2">
                            <Bookmark className="w-4 h-4 text-indigo-500 shrink-0" />
                            <div>
                              <span className="text-[10px] text-indigo-500 block uppercase font-semibold">Evidence Snapshot</span>
                              <span className="font-mono text-[11px] font-semibold">{event.snapshotId}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Evidence Snapshot Details */}
                      {Boolean(evidence && Object.keys(evidence).length > 0) && (
                        <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/70 text-xs space-y-2">
                          <div className="flex items-center justify-between text-amber-900 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <Bookmark className="w-3.5 h-3.5 text-amber-600" /> Evidence Snapshot (Frozen Attributes)
                            </span>
                            {event.snapshotId && (
                              <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                                {event.snapshotId}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                            {Object.entries(evidence || {}).map(([k, v]) => (
                              <div key={k} className="bg-white/90 p-2 rounded border border-amber-100">
                                <span className="text-slate-400 text-[10px] block truncate uppercase">{k}</span>
                                <span className="font-bold text-slate-800 truncate block">
                                  {typeof v === 'number'
                                    ? v.toLocaleString()
                                    : typeof v === 'object'
                                    ? JSON.stringify(v)
                                    : String(v)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* SHAP Explainability Factors */}
                      {Boolean(shapFactors && shapFactors.length > 0) && (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                          <div className="flex items-center justify-between text-slate-700 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-indigo-500" /> Explainable AI (SHAP Feature Contributions)
                            </span>
                            <span className="text-[10px] uppercase font-mono text-slate-400">Additive Attributions</span>
                          </div>
                          <div className="space-y-1.5">
                            {shapFactors!.map((factor, fIdx) => {
                              const isRiskIncrease =
                                factor.direction === 'increases_risk' ||
                                (factor.shap_value != null && factor.shap_value > 0);
                              return (
                                <div
                                  key={fIdx}
                                  className="flex items-center justify-between gap-2 p-1.5 rounded bg-white border border-slate-100 text-[11px]"
                                >
                                  <span className="font-medium text-slate-800 truncate">
                                    {factor.feature_label || factor.feature}
                                    {factor.feature_value != null && (
                                      <span className="text-slate-400 ml-1 font-mono">
                                        ({Number(factor.feature_value).toLocaleString()})
                                      </span>
                                    )}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {factor.impact_percentage != null && (
                                      <span className="font-mono text-[10px] text-slate-500">
                                        {Number(factor.impact_percentage).toFixed(1)}%
                                      </span>
                                    )}
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                        isRiskIncrease
                                          ? 'bg-rose-100 text-rose-800'
                                          : 'bg-emerald-100 text-emerald-800'
                                      }`}
                                    >
                                      {isRiskIncrease ? 'Increases Risk' : 'Reduces Risk'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Human Override with Reason & Approver */}
                      {Boolean(override || event.eventType === 'DECISION_OVERRIDDEN') && (
                        <div className="p-3 rounded-lg bg-purple-50/70 border border-purple-200 text-xs space-y-2">
                          <div className="flex items-center justify-between text-purple-900 font-semibold">
                            <span className="flex items-center gap-1.5">
                              <GitCompare className="w-3.5 h-3.5 text-purple-600" /> Human Supervisory Override
                            </span>
                            {approver && (
                              <span className="text-[11px] font-mono text-purple-800">
                                Approver: <strong className="font-bold">{approver}</strong>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 font-mono text-xs flex-wrap">
                            <div className="bg-white px-2.5 py-1.5 rounded border border-purple-100">
                              <span className="text-[10px] text-slate-400 block uppercase">Original Decision</span>
                              <span className="font-bold text-slate-700">
                                {String(override?.originalOutcome || 'MANUAL_REVIEW')}
                              </span>
                            </div>
                            <span className="text-purple-600 font-bold">→</span>
                            <div className="bg-white px-2.5 py-1.5 rounded border border-purple-100">
                              <span className="text-[10px] text-purple-500 block uppercase font-semibold">Overridden To</span>
                              <span className="font-bold text-purple-900">
                                {String(override?.newOutcome || 'APPROVED')}
                              </span>
                            </div>
                            {override?.approvedAmount != null && (
                              <div className="bg-white px-2.5 py-1.5 rounded border border-purple-100">
                                <span className="text-[10px] text-slate-400 block uppercase">Approved Limit</span>
                                <span className="font-bold text-emerald-700">
                                  INR {Number(override.approvedAmount).toLocaleString()}
                                </span>
                              </div>
                            )}
                          </div>
                          {overrideReason && (
                            <div className="p-2 bg-white rounded border border-purple-100 text-purple-950 text-xs">
                              <span className="font-bold text-purple-800">Justification: </span>
                              {overrideReason}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Reason Codes if present */}
                      {Boolean(reasonCodes && reasonCodes.length > 0) && (
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          <span className="text-slate-500 text-[11px]">Reason Codes:</span>
                          {reasonCodes?.map((code, cIdx) => (
                            <span key={cIdx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                              {code}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Hash Chain Cryptographic Link Box */}
                      <div className="p-3 bg-slate-900 text-slate-100 rounded-lg font-mono text-[11px] space-y-1.5">
                        <div className="flex items-center justify-between text-slate-400 text-[10px] pb-1 border-b border-slate-800">
                          <span>SHA-256 HASH CHAIN LINK</span>
                          <span>SEQ #{event.sequence}</span>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 text-[10px]">eventHash:</span>
                          <span className="text-sky-300 font-bold truncate">{event.eventHash}</span>
                          <button
                            onClick={() => copyToClipboard(event.eventHash, `hash_${event.sequence}`)}
                            className="p-1 hover:text-white text-slate-400"
                            title="Copy full hash"
                          >
                            {copiedHash === `hash_${event.sequence}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400 text-[10px]">prevHash:</span>
                          <span className="text-slate-400 truncate">
                            {event.previousHash === 'GENESIS' ? (
                              <span className="text-amber-400 font-bold">GENESIS</span>
                            ) : (
                              event.previousHash
                            )}
                          </span>
                          {event.previousHash !== 'GENESIS' && (
                            <button
                              onClick={() => copyToClipboard(event.previousHash || '', `prev_${event.sequence}`)}
                              className="p-1 hover:text-white text-slate-400"
                              title="Copy previous hash"
                            >
                              {copiedHash === `prev_${event.sequence}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Raw Payload View */}
                      <div>
                        <button
                          onClick={() => togglePayload(event.eventId)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          {isExpanded ? 'Hide Validated Payload' : 'Inspect Raw Payload (JSON)'}
                          {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>

                        {isExpanded && (
                          <pre className="mt-2 p-3 bg-slate-950 text-slate-200 rounded-lg text-[11px] font-mono overflow-x-auto max-h-60">
                            {JSON.stringify(event.payload, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
