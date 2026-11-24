import React from 'react';
import { CaseSummary } from '../../types';
import { BarChart3 } from 'lucide-react';

interface DecisionDistributionChartProps {
  cases: CaseSummary[];
}

export const DecisionDistributionChart: React.FC<DecisionDistributionChartProps> = ({ cases }) => {
  const total = cases.length;

  const approvedCases = cases.filter(
    (c) => c.status === 'APPROVED' || c.latestDecision === 'APPROVED' || c.finalDecision === 'APPROVED'
  );
  const reviewCases = cases.filter(
    (c) => c.status === 'UNDER_REVIEW' || (c.latestDecision === 'MANUAL_REVIEW' && !c.isOverridden)
  );
  const rejectedCases = cases.filter(
    (c) => c.status === 'REJECTED' || c.latestDecision === 'REJECTED' || c.finalDecision === 'REJECTED' || (c.status === 'CLOSED' && c.latestDecision === 'REJECTED')
  );

  const stats = [
    {
      label: 'Approved',
      count: approvedCases.length,
      color: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-200',
    },
    {
      label: 'Manual Review',
      count: reviewCases.length,
      color: 'bg-amber-500',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    {
      label: 'Rejected',
      count: rejectedCases.length,
      color: 'bg-rose-500',
      textColor: 'text-rose-700',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-200',
    },
  ];

  const maxCount = Math.max(...stats.map((s) => s.count), 1);

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Decisions by Outcome</h3>
            <p className="text-xs text-slate-500">Distribution across active financial cases</p>
          </div>
        </div>
        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
          {total} Total Cases
        </span>
      </div>

      {total === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400">No decision cases to display.</div>
      ) : (
        <div className="space-y-3">
          {stats.map((item) => {
            const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
            const barWidthPercent = total > 0 ? Math.max(8, Math.round((item.count / maxCount) * 100)) : 0;

            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    {item.label}
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-slate-900">{item.count}</span>
                    <span className="text-slate-400 text-[11px]">({percentage}%)</span>
                  </div>
                </div>

                {/* Bar */}
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full ${item.color} transition-all duration-500 rounded-full`}
                    style={{ width: `${barWidthPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
