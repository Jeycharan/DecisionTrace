import { CaseModel } from '../cases/case.model';
import { LedgerEventModel } from '../events/event.model';
import { CheckpointModel } from '../checkpoints/checkpoint.model';
import { verifyCase } from '../ledger/verification.service';
import { replayDecision } from '../replay/replay.service';
import { NotFoundError } from '../../shared/errors';

export interface AuditReportData {
  generatedAt: string;
  case: any;
  verification: any;
  replay: any;
  events: any[];
  checkpoints: any[];
}

export async function generateAuditReportData(
  tenantId: string,
  caseId: string
): Promise<AuditReportData> {
  const generatedAt = new Date().toISOString();

  const caseDoc = await CaseModel.findOne({ tenantId, caseId }).lean();
  if (!caseDoc) {
    throw new NotFoundError('Case', caseId);
  }

  const [events, checkpoints, verification] = await Promise.all([
    LedgerEventModel.find({ tenantId, caseId }).sort({ sequence: 1 }).lean(),
    CheckpointModel.find({ tenantId, caseId }).sort({ sequence: 1 }).lean(),
    verifyCase(tenantId, caseId),
  ]);

  // Attempt replay if decision exists
  let replay = null;
  try {
    replay = await replayDecision(tenantId, caseId);
  } catch {
    replay = null;
  }

  return {
    generatedAt,
    case: caseDoc,
    verification,
    replay,
    events,
    checkpoints,
  };
}

export function renderAuditReportHtml(data: AuditReportData): string {
  const { generatedAt, case: c, verification: v, replay: r, events, checkpoints } = data;

  const isVerified = v.verified;
  const statusColor = isVerified ? '#047857' : v.chainConsistent ? '#b45309' : '#b91c1c';
  const statusBadge = isVerified
    ? 'VERIFIED AGAINST SIGNED CHECKPOINT'
    : v.chainConsistent
    ? 'CHAIN CONSISTENT (NO SIGNED CHECKPOINT)'
    : 'VERIFICATION FAILED (TAMPER DETECTED)';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>DecisionTrace Audit Report — ${c.caseId}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; line-height: 1.5; font-size: 12px; margin: 0; padding: 20px; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; margin: 0; color: #0f172a; }
    .subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 11px; text-transform: uppercase; font-family: monospace; letter-spacing: 0.5px; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; }
    .meta-item span.label { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 2px; }
    .meta-item span.value { font-size: 13px; font-weight: 700; color: #0f172a; font-family: monospace; }
    h2 { font-size: 14px; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 24px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11px; }
    th { background: #f1f5f9; text-align: left; padding: 6px 8px; font-weight: 600; border-bottom: 1px solid #cbd5e1; font-size: 10px; text-transform: uppercase; color: #475569; }
    td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .box { padding: 12px; border-radius: 6px; margin-bottom: 16px; border: 1px solid; }
    .box-green { background: #ecfdf5; border-color: #a7f3d0; color: #065f46; }
    .box-amber { background: #fffbeb; border-color: #fde68a; color: #92400e; }
    .box-red { background: #fef2f2; border-color: #fecaca; color: #991b1b; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 16px; text-align: right;">
    <button onclick="window.print()" style="padding: 8px 16px; background: #0f172a; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px;">
      🖨 Print / Save as PDF
    </button>
  </div>

  <div class="header">
    <div>
      <h1 class="title">DecisionTrace™ Audit Certificate</h1>
      <div class="subtitle">Financial Decision Flight Recorder • Verification & Integrity Report</div>
    </div>
    <div style="text-align: right;">
      <div class="mono" style="font-size: 11px; color: #64748b;">Report Generated: ${new Date(generatedAt).toISOString()}</div>
      <div class="mono" style="font-size: 11px; color: #64748b;">Tenant: ${c.tenantId}</div>
    </div>
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <span class="label">Case Identifier</span>
      <span class="value">${c.caseId}</span>
    </div>
    <div class="meta-item">
      <span class="label">Case Type</span>
      <span class="value">${c.caseType}</span>
    </div>
    <div class="meta-item">
      <span class="label">Current Status</span>
      <span class="value">${c.status}</span>
    </div>
    <div class="meta-item">
      <span class="label">Latest Decision</span>
      <span class="value">${c.latestDecision || 'None'}</span>
    </div>
    <div class="meta-item">
      <span class="label">Subject Reference</span>
      <span class="value">${c.subjectRef}</span>
    </div>
    <div class="meta-item">
      <span class="label">Risk Score</span>
      <span class="value">${c.latestRiskScore != null ? `${c.latestRiskScore}/100` : 'N/A'}</span>
    </div>
    <div class="meta-item">
      <span class="label">Event Count</span>
      <span class="value">${c.eventCount}</span>
    </div>
    <div class="meta-item">
      <span class="label">First / Last Recorded</span>
      <span class="value" style="font-size: 10px;">${new Date(c.firstEventAt).toLocaleDateString()} — ${new Date(c.lastEventAt).toLocaleDateString()}</span>
    </div>
  </div>

  <h2>1. Cryptographic Hash Chain & Checkpoint Verification</h2>
  <div class="box ${isVerified ? 'box-green' : v.chainConsistent ? 'box-amber' : 'box-red'}">
    <div style="font-size: 13px; font-weight: 700; margin-bottom: 4px;">
      Status: ${statusBadge}
    </div>
    <div>Checked ${v.checkedEvents} ledger events in chronological sequence. SHA-256 chain continuity: <strong>${v.chainConsistent ? 'PASS' : 'FAIL'}</strong>. Checkpoint authenticity: <strong>${v.checkpointStatus}</strong>.</div>
    ${v.failure ? `<div style="margin-top: 8px; font-family: monospace; font-size: 11px;">🚨 Failure at Sequence #${v.failure.sequence}: ${v.failure.reason} (${v.failure.details || ''})</div>` : ''}
    ${v.checkpointCoverage?.latestCheckpointSequence != null ? `<div style="margin-top: 4px; font-size: 11px;">Signed anchor covers events through sequence #${v.checkpointCoverage.latestCheckpointSequence}. (${v.checkpointCoverage.uncoveredEventCount} events pending next periodic checkpoint).</div>` : ''}
  </div>

  ${r ? `
  <h2>2. Deterministic Rule Replay & Explanation</h2>
  <div class="box ${r.reproducible ? 'box-green' : 'box-amber'}">
    <div style="font-size: 13px; font-weight: 700; margin-bottom: 4px;">
      Reproducibility: ${r.reproducible ? '100% DETERMINISTIC MATCH' : 'DISCREPANCY DETECTED'}
    </div>
    <div>Ruleset: <span class="mono"><strong>${r.rulesetId}@${r.rulesetVersion}</strong></span> • Original Outcome: <strong>${r.original.outcome}</strong> • Replayed Outcome: <strong>${r.replayed ? r.replayed.outcome : 'N/A'}</strong></div>
    <div style="margin-top: 4px; font-size: 11px;">${r.explanation}</div>
  </div>
  ` : ''}

  <h2>3. Chronological Event Ledger</h2>
  <table>
    <thead>
      <tr>
        <th>Seq</th>
        <th>Event Type</th>
        <th>Source Time (UTC)</th>
        <th>Recorded (UTC)</th>
        <th>Source System</th>
        <th>Event Hash (SHA-256)</th>
        <th>Prev Hash</th>
      </tr>
    </thead>
    <tbody>
      ${events.map((e: any) => `
        <tr>
          <td class="mono" style="font-weight: 700;">#${e.sequence}</td>
          <td style="font-weight: 600;">${e.eventType}</td>
          <td class="mono">${new Date(e.occurredAt).toISOString().replace('T', ' ').slice(0, 19)}</td>
          <td class="mono">${new Date(e.recordedAt).toISOString().replace('T', ' ').slice(0, 19)}</td>
          <td class="mono">${e.sourceSystem}</td>
          <td class="mono" style="font-size: 9px; word-break: break-all;">${e.eventHash.slice(0, 20)}...</td>
          <td class="mono" style="font-size: 9px;">${e.previousHash === 'GENESIS' ? 'GENESIS' : e.previousHash.slice(0, 12) + '...'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h2>4. Signed Checkpoints</h2>
  ${checkpoints.length === 0 ? '<div style="color: #64748b; font-style: italic;">No checkpoints recorded yet.</div>' : `
  <table>
    <thead>
      <tr>
        <th>Checkpoint ID</th>
        <th>Sequence</th>
        <th>Algorithm / Key</th>
        <th>Created At</th>
        <th>Sealed Hash</th>
      </tr>
    </thead>
    <tbody>
      ${checkpoints.map((ck: any) => `
        <tr>
          <td class="mono">${ck.checkpointId}</td>
          <td class="mono" style="font-weight: 700;">#${ck.sequence}</td>
          <td class="mono">${ck.signatureAlgorithm} (${ck.keyId})</td>
          <td class="mono">${new Date(ck.createdAt).toISOString()}</td>
          <td class="mono" style="font-size: 9px; word-break: break-all;">${ck.eventHash}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  `}

  <div class="footer">
    <div>DecisionTrace Platform • Team CodeGenesis • Visionet TechThon 2026</div>
    <div>Document Classification: Internal Audit • Synthetic Demo Data</div>
  </div>
</body>
</html>`;
}
