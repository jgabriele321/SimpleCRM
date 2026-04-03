import React from 'react';
import { Deal, STAGE_LABELS, STAGE_COLORS, PRIORITY_COLORS } from '../types';

interface DealCardProps {
  deal: Deal;
  onClick: (deal: Deal) => void;
  isTargeted: boolean;
  onToggleTarget: () => void;
}

export const DealCard: React.FC<DealCardProps> = ({ deal, onClick, isTargeted, onToggleTarget }) => {
  const formattedValue = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(deal.expectedValue);

  const nextActionDate = deal.nextActionDate
    ? new Date(deal.nextActionDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  const overdue = deal.nextActionDate ? new Date(deal.nextActionDate) < new Date() : false;

  const handleTargetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleTarget();
  };

  return (
    <div
      onClick={() => onClick(deal)}
      className={`group rounded-lg border cursor-pointer flex flex-col h-full transition-colors ${
        isTargeted
          ? 'bg-white border-l-[3px] border-l-indigo-500 border-t-slate-200 border-r-slate-200 border-b-slate-200'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-slate-900 leading-snug group-hover:text-indigo-600 transition-colors">
            {deal.title}
          </h3>
          <span className="text-base font-semibold text-slate-800 shrink-0">{formattedValue}</span>
        </div>

        <div className="text-sm text-slate-500 leading-tight">
          {[deal.personName, deal.companyName].filter(Boolean).join(' · ') || '\u00A0'}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${STAGE_COLORS[deal.stage]}`}>
            {STAGE_LABELS[deal.stage]}
          </span>
          <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLORS[deal.priority]}`}>
            {deal.priority}
          </span>
          {deal.closeProbability > 0 && (
            <span className="text-[10px] text-slate-400 ml-auto">{deal.closeProbability}%</span>
          )}
        </div>

        {deal.nextAction && (
          <div className="text-sm text-slate-600">
            <span className="text-slate-400 text-xs">Next:</span>{' '}
            {deal.nextAction}
            {nextActionDate && (
              <span className={`text-xs ml-1 ${overdue ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>
                ({nextActionDate})
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleTargetClick}
              title={isTargeted ? 'Remove from focus' : 'Add to focus'}
              className={`p-0.5 rounded transition-colors ${
                isTargeted ? 'text-indigo-500' : 'text-slate-300 hover:text-slate-400'
              }`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" fill={isTargeted ? 'currentColor' : 'none'} />
              </svg>
            </button>
            {deal.tags.length > 0 && (
              <div className="flex gap-1">
                {deal.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">
                    {tag}
                  </span>
                ))}
                {deal.tags.length > 2 && <span className="text-[10px] text-slate-400">+{deal.tags.length - 2}</span>}
              </div>
            )}
          </div>
          {deal.isGatekept && (
            <span className="text-[10px] text-amber-600 font-medium">Gatekept</span>
          )}
        </div>
      </div>
    </div>
  );
};
