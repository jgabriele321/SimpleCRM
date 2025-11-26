import React from 'react';
import { Deal } from '../types';

interface PipelineStatsProps {
  deals: Deal[];
}

export const PipelineStats: React.FC<PipelineStatsProps> = ({ deals }) => {
  // Filter out closed deals for pipeline calculations
  const activeDeals = deals.filter(d => !['closed_won', 'closed_lost'].includes(d.stage));
  
  const totalValue = activeDeals.reduce((sum, d) => sum + (d.expectedValue || 0), 0);
  const weightedValue = activeDeals.reduce((sum, d) => sum + ((d.expectedValue || 0) * (d.closeProbability || 0) / 100), 0);
  const avgProb = activeDeals.length > 0 
    ? activeDeals.reduce((sum, d) => sum + (d.closeProbability || 0), 0) / activeDeals.length 
    : 0;

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: 'compact',
    compactDisplay: 'short'
  }).format(val);

  return (
    <div className="sticky bottom-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between overflow-x-auto no-scrollbar">
        
        <div className="flex items-center space-x-6 min-w-max">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Active Deals</span>
            <span className="text-xl font-bold text-slate-800">{activeDeals.length}</span>
          </div>
          
          <div className="w-px h-8 bg-slate-200 mx-2"></div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Nominal Pipeline</span>
            <span className="text-xl font-bold text-slate-800">{formatCurrency(totalValue)}</span>
          </div>

          <div className="w-px h-8 bg-slate-200 mx-2"></div>

          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600">Weighted Forecast</span>
            <span className="text-xl font-bold text-emerald-600">{formatCurrency(weightedValue)}</span>
          </div>

           <div className="hidden sm:flex flex-col ml-4">
             <span className="text-[10px] text-slate-400">Avg. Probability: <span className="text-slate-700 font-semibold">{Math.round(avgProb)}%</span></span>
           </div>
        </div>

        {/* Mini Stage Breakdown (Desktop only) */}
        <div className="hidden md:flex items-center space-x-2">
            <div className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                Lead: <b>{activeDeals.filter(d => d.stage === 'lead').length}</b>
            </div>
            <div className="px-2 py-1 bg-blue-50 rounded text-xs text-blue-700">
                Contact: <b>{activeDeals.filter(d => d.stage === 'contacted').length}</b>
            </div>
            <div className="px-2 py-1 bg-cyan-50 rounded text-xs text-cyan-700">
                Active: <b>{activeDeals.filter(d => d.stage === 'active_convo').length}</b>
            </div>
             <div className="px-2 py-1 bg-purple-50 rounded text-xs text-purple-700">
                Prop: <b>{activeDeals.filter(d => d.stage === 'proposal_sent').length}</b>
            </div>
        </div>

      </div>
    </div>
  );
};