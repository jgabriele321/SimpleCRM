import React from 'react';
import { Deal } from '../types';

interface PipelineStatsProps {
  deals: Deal[];
}

export const PipelineStats: React.FC<PipelineStatsProps> = ({ deals }) => {
  const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  const totalValue = activeDeals.reduce((sum, d) => sum + (d.expectedValue || 0), 0);
  const weightedValue = activeDeals.reduce((sum, d) => sum + ((d.expectedValue || 0) * (d.closeProbability || 0) / 100), 0);
  const avgProb = activeDeals.length > 0
    ? activeDeals.reduce((sum, d) => sum + (d.closeProbability || 0), 0) / activeDeals.length
    : 0;

  const fmt = (val: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact', compactDisplay: 'short'
  }).format(val);

  const stageCounts = [
    { label: 'Sig', count: activeDeals.filter(d => d.stage === 'signal').length },
    { label: 'Act', count: activeDeals.filter(d => d.stage === 'active_convo').length },
    { label: 'Rdy', count: activeDeals.filter(d => d.stage === 'ready_for_proposal').length },
    { label: 'Prop', count: activeDeals.filter(d => d.stage === 'proposal_sent').length },
    { label: 'Yes', count: activeDeals.filter(d => d.stage === 'verbal_yes').length },
  ];

  return (
    <div className="sticky bottom-0 z-40 bg-white border-t border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between text-xs">
        <div className="flex items-center gap-5">
          <div>
            <span className="text-slate-400">{activeDeals.length} deals</span>
          </div>
          <div>
            <span className="text-slate-400">Pipeline </span>
            <span className="font-semibold text-slate-700">{fmt(totalValue)}</span>
          </div>
          <div>
            <span className="text-slate-400">Weighted </span>
            <span className="font-semibold text-emerald-600">{fmt(weightedValue)}</span>
          </div>
          <div className="hidden sm:block">
            <span className="text-slate-400">Avg prob </span>
            <span className="font-semibold text-slate-700">{Math.round(avgProb)}%</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2">
          {stageCounts.map(s => (
            <span key={s.label} className="text-slate-500">
              {s.label} <span className="font-semibold text-slate-700">{s.count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
