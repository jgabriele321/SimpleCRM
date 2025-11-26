import React from 'react';
import { Deal, STAGE_LABELS, STAGE_COLORS, PRIORITY_COLORS } from '../types';

interface DealCardProps {
  deal: Deal;
  onClick: (deal: Deal) => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, onClick }) => {
  const stageColor = STAGE_COLORS[deal.stage] || 'bg-slate-100';
  const priorityColor = PRIORITY_COLORS[deal.priority] || 'text-slate-500';
  
  // Format currency
  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(deal.expectedValue);

  // Format date
  const nextActionDate = deal.nextActionDate 
    ? new Date(deal.nextActionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div 
      onClick={() => onClick(deal)}
      className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col h-full relative"
    >
      {/* Top Border Indicator for Stage */}
      <div className={`h-1.5 w-full ${stageColor.split(' ')[0].replace('bg-', 'bg-')}`}></div>

      <div className="p-5 flex-1 flex flex-col">
        {/* Header: Priority & Date */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center space-x-2">
            <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${priorityColor}`}>
              {deal.priority}
            </span>
            <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${stageColor}`}>
              {STAGE_LABELS[deal.stage]}
            </span>
          </div>
          {deal.closeProbability > 0 && (
            <span className="text-xs font-semibold text-slate-400">
              {deal.closeProbability}% Prob.
            </span>
          )}
        </div>

        {/* Title & Entities */}
        <h3 className="text-lg font-bold text-slate-800 leading-tight mb-1 group-hover:text-indigo-600 transition-colors">
          {deal.title}
        </h3>
        <div className="text-sm text-slate-500 mb-4 flex flex-col">
          {deal.companyName && (
            <span className="flex items-center">
              <svg className="w-3.5 h-3.5 mr-1.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              {deal.companyName}
            </span>
          )}
          {deal.personName && (
            <span className="flex items-center mt-0.5">
              <svg className="w-3.5 h-3.5 mr-1.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              {deal.personName}
            </span>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 w-full my-3"></div>

        {/* Next Action Context */}
        {deal.nextAction && (
           <div className="mb-4 bg-indigo-50/50 p-2 rounded border border-indigo-50">
             <div className="text-xs text-indigo-500 font-semibold uppercase mb-0.5">Next Step</div>
             <div className="text-sm text-indigo-900 line-clamp-2">
               {deal.nextAction}
             </div>
             {nextActionDate && (
               <div className={`text-xs mt-1 ${new Date(deal.nextActionDate!) < new Date() ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                 Due {nextActionDate}
               </div>
             )}
           </div>
        )}

        <div className="mt-auto pt-2 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {deal.tags.slice(0, 2).map(tag => (
                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                  #{tag}
                </span>
              ))}
              {deal.tags.length > 2 && <span className="text-[10px] text-slate-400">+{deal.tags.length - 2}</span>}
            </div>
            <div className="text-lg font-bold text-slate-700">
              {formattedValue}
            </div>
        </div>
      </div>
    </div>
  );
};