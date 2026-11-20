import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { CaseSummary, LedgerEvent, VerificationResult, Checkpoint } from '../../types';
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
                const isExpanded = expandedPayloads[event.eventId];

                return (
                  <div key={event._id} className="relative group">
                    {/* Timeline Node Badge */}
                    <div className="absolute -left-[35px] sm:-left-[43px] top-4 w-7 h-7 rounded-full bg-white border-2 border-slate-300 group-hover:border-sky-600 flex items-center justify-center text-[11px] font-mono font-bold text-slate-700 shadow-sm transition-colors">
                      {event.sequence}
                    </div>

                    {/* Event Card */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4 hover:border-slate-300 transition-colors">
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
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500">
                          <span className="flex items-center gap-1" title="Source event time">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(event.occurredAt).toLocaleTimeString()}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span className="font-mono text-[11px] text-slate-600">
                            src: {event.sourceSystem}
                          </span>
                        </div>
                      </div>

                      {/* Event Context & Badges */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {/* Decision Outcome if present */}
                        {Boolean(decision?.outcome) && (
                          <div className="p-2.5 rounded-lg bg-sky-50/70 border border-sky-100">
                            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Outcome</span>
                            <span className="font-bold text-sky-900 text-sm">{String(decision?.outcome)}</span>
                            {decision?.riskScore != null && (
                              <span className="text-slate-500 block text-[11px]">Risk Score: {String(decision.riskScore)}/100</span>
                            )}
                          </div>
                        )}

                        {/* Override Details if present */}
                        {Boolean(override) && (
                          <div className="p-2.5 rounded-lg bg-purple-50/70 border border-purple-100">
                            <span className="text-purple-600 block text-[10px] uppercase font-semibold">Human Override</span>
                            <span className="font-bold text-purple-900 text-sm">
                              {String(override?.originalOutcome)} → {String(override?.newOutcome)}
                            </span>
                            {Boolean(override?.approvedAmount) && (
                              <span className="text-purple-700 block text-[11px]">
                                Amount: INR {Number(override?.approvedAmount).toLocaleString()}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Ruleset & Model Metadata */}
                        {Boolean(rules || model) && (
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 font-mono text-[11px] space-y-0.5">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Logic Version</span>
                            {Boolean(rules) && (
                              <div className="text-slate-700">
                                Rules: <span className="font-semibold">{String(rules?.rulesetId ?? '')}@{String(rules?.rulesetVersion ?? '')}</span>
                              </div>
                            )}
                            {Boolean(model) && (
                              <div className="text-slate-700">
                                Model: <span className="font-semibold">{String(model?.modelId ?? '')}@{String(model?.modelVersion ?? '')}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Snapshot Reference */}
                        {Boolean(event.snapshotId) && (
                          <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100 text-indigo-900 text-xs flex items-center gap-2">
                            <Bookmark className="w-4 h-4 text-indigo-500 shrink-0" />
                            <div>
                              <span className="text-[10px] text-indigo-500 block uppercase font-semibold">Snapshot Sealed</span>
                              <span className="font-mono text-[11px] font-semibold">{event.snapshotId}</span>
                            </div>
                          </div>
                        )}
                      </div>

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

                      {/* Human Override Reason text */}
                      {Boolean(event.payload?.reason) && (
                        <div className="p-3 bg-purple-50/40 rounded-lg border border-purple-100/70 text-xs text-purple-900">
                          <span className="font-semibold text-purple-800">Justification: </span>
                          {String(event.payload.reason)}
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
