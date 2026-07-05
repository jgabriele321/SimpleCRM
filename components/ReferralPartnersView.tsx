import React from 'react';
import { Deal, ReferralPartner, STAGE_LABELS } from '../types';

interface ReferralPartnersViewProps {
  partners: ReferralPartner[];
  deals: Deal[];
  onNew: () => void;
  onEditPartner: (partner: ReferralPartner) => void;
  onEditDeal: (deal: Deal) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : null;

export const ReferralPartnersView: React.FC<ReferralPartnersViewProps> = ({ partners, deals, onNew, onEditPartner, onEditDeal }) => {
  const dealsByPartner = (id: number) => deals.filter((d) => d.referralPartnerId === id);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Referral Partners</h2>
          <p className="text-sm text-slate-500">People who send us clients — keep these relationships warm.</p>
        </div>
        <button onClick={onNew} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap">
          + New Referral Partner
        </button>
      </div>

      {partners.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-slate-500">No referral partners yet.</p>
          <button onClick={onNew} className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700">+ Add your first one</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {partners.map((p) => {
            const s = p.stats || { dealCount: 0, wonCount: 0, openCount: 0, totalValue: 0, wonValue: 0 };
            const theirDeals = dealsByPartner(p.id);
            const hasAddress = !!p.mailingAddress?.trim();
            return (
              <div key={p.id} className="bg-white rounded-lg border border-slate-200 hover:border-slate-300 transition-colors flex flex-col">
                <button onClick={() => onEditPartner(p)} className="p-4 text-left border-b border-slate-100">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-[15px] font-semibold text-slate-900">{p.name}</h3>
                      {(p.company || p.relationship) && (
                        <p className="text-xs text-slate-500 mt-0.5">{[p.company, p.relationship].filter(Boolean).join(' · ')}</p>
                      )}
                    </div>
                    <span
                      title={hasAddress ? 'Mailing address on file' : 'No mailing address — add one for gifts'}
                      className={`text-base ${hasAddress ? '' : 'grayscale opacity-40'}`}
                    >🎁</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-3 text-xs">
                    <span className="text-slate-600"><span className="font-semibold text-slate-900">{s.dealCount}</span> referred</span>
                    <span className="text-emerald-700"><span className="font-semibold">{s.wonCount}</span> won</span>
                    <span className="text-slate-600"><span className="font-semibold text-slate-900">{s.openCount}</span> open</span>
                    <span className="text-slate-600">{fmt(s.wonValue)} won · {fmt(s.totalValue)} total</span>
                  </div>
                  {fmtDate(p.lastThankYouSent) && (
                    <p className="text-[11px] text-amber-700 mt-2">Last thank-you: {fmtDate(p.lastThankYouSent)}</p>
                  )}
                </button>

                {theirDeals.length > 0 && (
                  <div className="p-3 flex flex-col gap-1">
                    {theirDeals.slice(0, 6).map((d) => (
                      <button
                        key={d.id}
                        onClick={() => onEditDeal(d)}
                        className="flex items-center justify-between gap-2 text-left text-xs px-2 py-1 rounded hover:bg-slate-50"
                      >
                        <span className="truncate text-slate-700">{d.title}</span>
                        <span className="text-slate-400 whitespace-nowrap">{STAGE_LABELS[d.stage]}</span>
                      </button>
                    ))}
                    {theirDeals.length > 6 && <span className="text-[11px] text-slate-400 px-2">+{theirDeals.length - 6} more</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
