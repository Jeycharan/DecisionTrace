import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { CaseSummary } from '../../types';
import { Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

interface CasesListProps {
  onSelectCase: (caseId: string) => void;
}

export const CasesList: React.FC<CasesListProps> = ({ onSelectCase }) => {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const res = await api.getCases({
        page,
        limit: 15,
        search: search || undefined,
        status: statusFilter || undefined,
        caseType: typeFilter || undefined,
      });
      setCases(res.data);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages || 1);
    } catch (err) {
      console.error('Failed to load cases:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [page, statusFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCases();
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Financial Cases</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-tracked decision records and event history
          </p>
        </div>
        <button
          onClick={fetchCases}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by case ID (e.g. loan_case_1001)..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </form>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-sky-500"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="CLOSED">Closed</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-sky-500"
          >
            <option value="">All Types</option>
            <option value="LOAN">Loan</option>
            <option value="PAYMENT">Payment</option>
            <option value="INSURANCE">Insurance</option>
            <option value="KYC">KYC</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading cases...</div>
        ) : cases.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No matching cases found. Try adjusting your filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Case ID</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Subject Ref</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Decision Outcome</th>
                  <th className="py-2.5 px-3">Risk Score</th>
                  <th className="py-2.5 px-3">Events</th>
                  <th className="py-2.5 px-3">Last Activity</th>
                  <th className="py-2.5 px-4 text-right sticky right-0 bg-slate-50">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {cases.map((c) => {
                  const src = (c.sourceSystem || '').toLowerCase();
                  const id = c.caseId.toLowerCase();
                  const sourceLabel = src.includes('minibank') || id.startsWith('minibank')
                    ? 'MiniBank'
                    : src.includes('commercial') || id.includes('comm')
                    ? 'Commercial Core'
                    : src.includes('retail') || id.includes('prime') || id.includes('high_risk') || id.includes('loan_case')
                    ? 'Retail LOS'
                    : c.sourceSystem || 'Loan Engine';

                  const sourceClass = sourceLabel === 'MiniBank'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : sourceLabel === 'Commercial Core'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-sky-50 text-sky-700 border-sky-200';

                  return (
                    <tr
                      key={c._id}
                      onClick={() => onSelectCase(c.caseId)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-2.5 px-3">
                        <div
                          className="font-mono font-bold text-slate-900 truncate max-w-[140px] sm:max-w-[170px]"
                          title={c.caseId}
                        >
                          {c.caseId}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${sourceClass}`}>
                          {sourceLabel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                          {c.caseType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 truncate max-w-[120px]" title={c.subjectRef}>
                        {c.subjectRef}
                      </td>
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
                      <td className="py-2.5 px-3 font-mono">
                        {c.latestRiskScore == null ? (
                          <span className="text-slate-400">—</span>
                        ) : c.latestRiskScore < 40 ? (
                          <span className="px-2 py-0.5 rounded font-bold text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {c.latestRiskScore}/100
                          </span>
                        ) : c.latestRiskScore < 70 ? (
                          <span className="px-2 py-0.5 rounded font-bold text-xs bg-amber-50 text-amber-700 border border-amber-200">
                            {c.latestRiskScore}/100
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded font-bold text-xs bg-rose-50 text-rose-700 border border-rose-200">
                            {c.latestRiskScore}/100
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] font-mono text-slate-500">
                        {c.eventCount}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-500">
                        {new Date(c.lastEventAt).toLocaleDateString()} {new Date(c.lastEventAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-4 text-right sticky right-0 bg-white">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectCase(c.caseId);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors border border-sky-200/50"
                        >
                          <Eye className="w-3.5 h-3.5" /> Open
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {cases.length} of {total} cases
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
