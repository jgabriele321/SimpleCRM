import React, { useMemo } from 'react';
import { Deal, STAGE_LABELS, Stage } from '../types';

interface MomentumDashboardProps {
  deals: Deal[];
  onEditDeal: (deal: Deal) => void;
}

type FrictionItem = {
  deal: Deal;
  staleDays: number | null;
  staleSeverity: 'yellow' | 'red' | null;
  overdueNextAction: boolean;
  gatekept: boolean;
  urgency: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const startOfWeekMonday = (reference: Date) => {
  const d = new Date(reference);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

const endOfWeekSunday = (reference: Date) => {
  const start = startOfWeekMonday(reference);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

const toDate = (value?: string) => (value ? new Date(value) : null);

const isInRange = (date: Date | null, start: Date, end: Date) => {
  if (!date || Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    notation: value >= 100000 ? 'compact' : 'standard',
    compactDisplay: 'short'
  }).format(value);

const formatDate = (value?: string) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const METRIC_GREEN = 'text-emerald-600';
const METRIC_YELLOW = 'text-amber-600';
const METRIC_RED = 'text-rose-600';

const CARD_BG_GREEN = 'bg-emerald-50 border-emerald-200';
const CARD_BG_YELLOW = 'bg-amber-50 border-amber-200';
const CARD_BG_RED = 'bg-rose-50 border-rose-200';

const FUNNEL_BAR_COLORS: Record<Stage, string> = {
  signal: 'bg-slate-400',
  active_convo: 'bg-cyan-500',
  ready_for_proposal: 'bg-violet-500',
  proposal_sent: 'bg-purple-500',
  verbal_yes: 'bg-lime-500',
  closed_won: 'bg-emerald-500',
  closed_lost: 'bg-rose-500',
  nurture: 'bg-amber-400',
};

const FUNNEL_STAGES: Stage[] = [
  'signal',
  'active_convo',
  'ready_for_proposal',
  'proposal_sent',
  'verbal_yes',
  'nurture'
];

/** Stages that count as active pipeline / friction (excludes closed + nurture). */
const ACTIVE_PIPELINE_STAGES: Stage[] = [
  'signal',
  'active_convo',
  'ready_for_proposal',
  'proposal_sent',
  'verbal_yes'
];

const isActivePipelineStage = (stage: Stage) => ACTIVE_PIPELINE_STAGES.includes(stage);

/** When the deal last changed stage (used for win/loss timing — do not fall back to updatedAt). */
const stageChangedDate = (d: Deal) => toDate(d.stageChangedAt);

/** Backfilled deals: created directly as closed_won (no stageChangedAt) or stageChangedAt within 24h of createdAt. */
const isBackfilled = (d: Deal) => {
  if (d.stage === 'closed_won' && !d.stageChangedAt) return true;
  const created = toDate(d.createdAt);
  const changed = stageChangedDate(d);
  if (!created || !changed) return false;
  return Math.abs(changed.getTime() - created.getTime()) < DAY_MS;
};

const MEANINGFUL_CONVO_STAGES: Stage[] = [
  'active_convo',
  'ready_for_proposal',
  'proposal_sent',
  'verbal_yes'
];

/** True if the deal entered proposal_sent during [start, end] (uses proposalSentAt; legacy fallback if still in proposal_sent). */
const enteredProposalSentInRange = (d: Deal, start: Date, end: Date) => {
  const sentAt = toDate(d.proposalSentAt);
  if (sentAt && isInRange(sentAt, start, end)) return true;
  if (!d.proposalSentAt && d.stage === 'proposal_sent') {
    const sc = stageChangedDate(d);
    return !!sc && isInRange(sc, start, end);
  }
  return false;
};

export const MomentumDashboard: React.FC<MomentumDashboardProps> = ({ deals, onEditDeal }) => {
  const now = new Date();
  const weekStart = startOfWeekMonday(now);
  const weekEnd = endOfWeekSunday(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const next30 = new Date(now);
  next30.setDate(now.getDate() + 30);
  const trailing90Start = new Date(now);
  trailing90Start.setDate(now.getDate() - 90);

  const dashboard = useMemo(() => {
    const proposalsOutDeals = deals.filter((d) => d.stage === 'proposal_sent' || d.stage === 'verbal_yes');
    const pipelineDeals = deals.filter((d) => !['closed_won', 'closed_lost', 'nurture'].includes(d.stage));
    const totalPipelineValue = pipelineDeals.reduce((sum, d) => sum + (d.expectedValue || 0), 0);

    const expectedRevenue30Deals = deals.filter((d) => {
      const closeDate = toDate(d.expectedCloseDate);
      return isInRange(closeDate, now, next30);
    });
    const expectedRevenue30 = expectedRevenue30Deals.reduce(
      (sum, d) => sum + ((d.expectedValue || 0) * (d.closeProbability || 0)) / 100, 0
    );

    const conversationsThisWeekDeals = deals.filter((d) => {
      if (!isActivePipelineStage(d.stage)) return false;
      const lastContact = toDate(d.lastContactDate);
      return isInRange(lastContact, weekStart, weekEnd);
    });

    const proposalsThisMonthDeals = deals.filter((d) => enteredProposalSentInRange(d, monthStart, monthEnd));

    const funnel = FUNNEL_STAGES.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage);
      return {
        stage,
        count: stageDeals.length,
        value: stageDeals.reduce((sum, d) => sum + (d.expectedValue || 0), 0)
      };
    });

    const wonCount = deals.filter((d) => d.stage === 'closed_won').length;
    const lostCount = deals.filter((d) => d.stage === 'closed_lost').length;
    const maxFunnelCount = Math.max(...funnel.map((f) => f.count), 1);

    const frictionItems: FrictionItem[] = deals
      .filter((deal) => isActivePipelineStage(deal.stage) && deal.stage !== 'closed_lost')
      .map((deal) => {
        const lastTouchDate = toDate(deal.lastContactDate);
        const staleDays = lastTouchDate ? Math.floor((now.getTime() - lastTouchDate.getTime()) / DAY_MS) : null;
        const staleSeverity =
          staleDays === null ? null : staleDays >= 14 ? 'red' : staleDays >= 7 ? 'yellow' : null;
        const nextActionDate = toDate(deal.nextActionDate);
        const overdueNextAction = !!nextActionDate && nextActionDate < now;
        const gatekept = !!deal.isGatekept;

        if (!staleSeverity && !overdueNextAction && !gatekept) return null;

        return {
          deal,
          staleDays,
          staleSeverity,
          overdueNextAction,
          gatekept,
          urgency: 0
        };
      })
      .filter((item): item is FrictionItem => item !== null)
      .sort((a, b) => {
        if (a.overdueNextAction !== b.overdueNextAction) return a.overdueNextAction ? -1 : 1;
        return (b.staleDays || 0) - (a.staleDays || 0);
      });

    const conversationsHeld = deals.filter((d) => {
      if (!isActivePipelineStage(d.stage)) return false;
      return isInRange(toDate(d.lastContactDate), weekStart, weekEnd);
    }).length;

    const proposalsSentWeek = deals.filter((d) => enteredProposalSentInRange(d, weekStart, weekEnd)).length;

    const followUpsMade = deals.filter((d) => {
      const lastContact = toDate(d.lastContactDate);
      const stageChanged = stageChangedDate(d);
      return isInRange(lastContact, weekStart, weekEnd) && !isInRange(stageChanged, weekStart, weekEnd);
    }).length;

    const dealsWonWeek = deals.filter((d) => {
      if (d.stage !== 'closed_won') return false;
      if (isBackfilled(d)) return false;
      const closed = stageChangedDate(d);
      return !!closed && isInRange(closed, weekStart, weekEnd);
    }).length;

    const dealsLostWeek = deals.filter((d) => {
      if (d.stage !== 'closed_lost') return false;
      const closed = stageChangedDate(d);
      return !!closed && isInRange(closed, weekStart, weekEnd);
    }).length;

    const closedTrailing90 = deals.filter((d) => {
      if (d.stage !== 'closed_won' && d.stage !== 'closed_lost') return false;
      if (isBackfilled(d)) return false;
      const closeDate = stageChangedDate(d);
      return !!closeDate && isInRange(closeDate, trailing90Start, now);
    });
    const wonTrailing90 = closedTrailing90.filter((d) => d.stage === 'closed_won');
    const lostTrailing90 = closedTrailing90.filter((d) => d.stage === 'closed_lost');
    const closeRate =
      wonTrailing90.length + lostTrailing90.length > 0
        ? (wonTrailing90.length / (wonTrailing90.length + lostTrailing90.length)) * 100
        : 0;
    const avgDealSize =
      wonTrailing90.length > 0 ? wonTrailing90.reduce((sum, d) => sum + (d.expectedValue || 0), 0) / wonTrailing90.length : 0;
    const avgTimeToCloseDays =
      wonTrailing90.length > 0
        ? wonTrailing90.reduce((sum, d) => {
            const createdAt = toDate(d.createdAt);
            const closedAt = stageChangedDate(d);
            if (!createdAt || !closedAt) return sum;
            return sum + Math.max(0, Math.round((closedAt.getTime() - createdAt.getTime()) / DAY_MS));
          }, 0) / wonTrailing90.length
        : 0;

    const lostTrailing90Deals = lostTrailing90;
    const lostTrailing90Value = lostTrailing90Deals.reduce((sum, d) => sum + (d.expectedValue || 0), 0);

    const trailing30Start = new Date(now);
    trailing30Start.setDate(now.getDate() - 30);
    const closesLast30Deals = deals.filter((d) => {
      if (d.stage !== 'closed_won') return false;
      if (isBackfilled(d)) return false;
      const closed = stageChangedDate(d);
      return !!closed && isInRange(closed, trailing30Start, now);
    });

    const meaningfulConvosThisWeekDeals = deals.filter((d) => {
      if (!MEANINGFUL_CONVO_STAGES.includes(d.stage)) return false;
      const lastContact = toDate(d.lastContactDate);
      return isInRange(lastContact, weekStart, weekEnd);
    });

    return {
      proposalsOutDeals,
      totalPipelineValue,
      expectedRevenue30,
      expectedRevenue30Deals,
      conversationsThisWeekDeals,
      proposalsThisMonthDeals,
      closesLast30Deals,
      meaningfulConvosThisWeekDeals,
      funnel,
      wonCount,
      lostCount,
      maxFunnelCount,
      frictionItems,
      conversationsHeld,
      proposalsSentWeek,
      followUpsMade,
      dealsWonWeek,
      dealsLostWeek,
      closeRate,
      avgDealSize,
      avgTimeToCloseDays,
      lostTrailing90Deals,
      lostTrailing90Value
    };
  }, [deals, monthEnd, monthStart, next30, now, trailing90Start, weekEnd, weekStart]);

  const pickColor = (value: number, greenAt: number, yellowAt: number) =>
    value >= greenAt ? { text: METRIC_GREEN, card: CARD_BG_GREEN } :
    value >= yellowAt ? { text: METRIC_YELLOW, card: CARD_BG_YELLOW } :
    { text: METRIC_RED, card: CARD_BG_RED };

  const proposalsStyle = pickColor(dashboard.proposalsOutDeals.length, 5, 3);
  const closesStyle = pickColor(dashboard.closesLast30Deals.length, 3, 2);
  const convosStyle = pickColor(dashboard.meaningfulConvosThisWeekDeals.length, 3, 2);
  const touchesStyle = pickColor(dashboard.conversationsThisWeekDeals.length, 5, 3);

  const [frictionExpanded, setFrictionExpanded] = React.useState(false);
  const FRICTION_CAP = 6;
  const visibleFriction = frictionExpanded ? dashboard.frictionItems : dashboard.frictionItems.slice(0, FRICTION_CAP);
  const hasHiddenFriction = dashboard.frictionItems.length > FRICTION_CAP;

  const Tooltip: React.FC<{ items: { id: string | number; line: React.ReactNode }[] }> = ({ items }) =>
    items.length > 0 ? (
      <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block">
        <div className="bg-slate-900 border border-slate-700 rounded-md p-2 shadow-lg max-h-48 overflow-y-auto w-max max-w-xs">
          {items.map((i) => <div key={String(i.id)} className="text-xs py-0.5 text-slate-200 whitespace-nowrap">{i.line}</div>)}
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      {/* ── Target metrics ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Proposals Out', value: dashboard.proposalsOutDeals.length, target: 6, style: proposalsStyle,
            tooltip: dashboard.proposalsOutDeals.map(d => ({ id: d.id, line: <>{d.title} <span className="text-slate-400">{formatCurrency(d.expectedValue || 0)}</span></> })) },
          { label: 'Closes (30d)', value: dashboard.closesLast30Deals.length, target: 3, style: closesStyle,
            tooltip: dashboard.closesLast30Deals.map(d => ({ id: d.id, line: <>{d.title} <span className="text-slate-400">{formatCurrency(d.expectedValue || 0)}</span></> })) },
          { label: 'Meaningful Convos', value: dashboard.meaningfulConvosThisWeekDeals.length, target: 3, style: convosStyle,
            tooltip: dashboard.meaningfulConvosThisWeekDeals.map(d => ({ id: d.id, line: <>{d.personName || d.title}</> })) },
        ].map((m) => (
          <div key={m.label} className={`relative group rounded-lg border p-3 ${m.style.card}`}>
            <p className="text-xs font-medium text-slate-500">{m.label}</p>
            <p className={`text-3xl font-bold tabular-nums leading-tight ${m.style.text}`}>
              {m.value}<span className="text-lg font-normal text-slate-400">/{m.target}</span>
            </p>
            <Tooltip items={m.tooltip} />
          </div>
        ))}
      </section>

      {/* ── Supporting stats ── */}
      <section className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
        <span className="text-slate-500">Pipeline <span className="font-semibold text-slate-800">{formatCurrency(dashboard.totalPipelineValue)}</span></span>
        <span className="text-slate-300">|</span>
        <span className="relative group text-slate-500">Expected (30d) <span className="font-semibold text-slate-800">{formatCurrency(dashboard.expectedRevenue30)}</span>
          <Tooltip items={dashboard.expectedRevenue30Deals.map(d => {
            const w = ((d.expectedValue || 0) * (d.closeProbability || 0)) / 100;
            return { id: d.id, line: <>{d.title} <span className="text-slate-400">{formatCurrency(d.expectedValue||0)}*{d.closeProbability||0}%={formatCurrency(w)}</span></> };
          })} />
        </span>
        <span className="text-slate-300">|</span>
        <span className="relative group text-slate-500">Conversations <span className={`font-semibold ${touchesStyle.text}`}>{dashboard.conversationsThisWeekDeals.length}</span>
          <Tooltip items={dashboard.conversationsThisWeekDeals.map(d => ({ id: d.id, line: <>{d.personName || d.title}</> }))} />
        </span>
        <span className="text-slate-300">|</span>
        <span className="relative group text-slate-500">Proposals sent <span className="font-semibold text-slate-800">{dashboard.proposalsThisMonthDeals.length}</span>
          <Tooltip items={dashboard.proposalsThisMonthDeals.map(d => ({ id: d.id, line: <>{d.title} <span className="text-slate-400">{formatCurrency(d.expectedValue || 0)}</span></> }))} />
        </span>
        <span className="ml-auto text-xs text-slate-400">Won {dashboard.wonCount} · Lost {dashboard.lostCount}</span>
      </section>

      {/* ── Funnel ── */}
      <section>
        <div className="space-y-1">
          {dashboard.funnel.map((item) => {
            const pct = Math.max(4, (item.count / dashboard.maxFunnelCount) * 100);
            return (
              <div key={item.stage} className="flex items-center gap-2 text-xs">
                <div className="w-24 shrink-0 text-right text-slate-500 truncate">{STAGE_LABELS[item.stage]}</div>
                <div className="flex-1 h-5 rounded-sm bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-sm ${FUNNEL_BAR_COLORS[item.stage]}`} style={{ width: `${pct}%` }} />
                </div>
                <div className="w-6 text-right tabular-nums font-medium text-slate-700">{item.count}</div>
                <div className="w-14 text-right tabular-nums text-slate-400">{formatCurrency(item.value)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Friction Tracker ── */}
      {(dashboard.frictionItems.length > 0 || true) && (
        <section>
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Needs Attention</h3>

          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400">
                  <th className="py-1 text-left font-medium">Deal</th>
                  <th className="py-1 text-right font-medium w-20">Value</th>
                  <th className="py-1 text-right font-medium w-12">Stale</th>
                  <th className="py-1 text-left font-medium pl-3">Next Action</th>
                  <th className="py-1 text-left font-medium w-16">Due</th>
                  <th className="py-1 text-left font-medium w-24">Gatekeeper</th>
                </tr>
              </thead>
              <tbody>
                {visibleFriction.map((item) => {
                  const rowBg = item.staleSeverity === 'red' ? 'bg-rose-50' : item.staleSeverity === 'yellow' ? 'bg-amber-50/50' : '';
                  return (
                    <tr key={String(item.deal.id)} onClick={() => onEditDeal(item.deal)} className={`border-b border-slate-100 cursor-pointer hover:bg-slate-50 ${rowBg}`}>
                      <td className="py-1.5">
                        <span className="font-medium text-slate-800">{item.deal.title}</span>
                        <span className="text-slate-400 ml-1">{[item.deal.personName, item.deal.companyName].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="py-1.5 text-right text-slate-600 tabular-nums">{formatCurrency(item.deal.expectedValue || 0)}</td>
                      <td className="py-1.5 text-right">
                        <span className={item.staleSeverity === 'red' ? 'text-rose-600 font-semibold' : item.staleSeverity === 'yellow' ? 'text-amber-600 font-medium' : 'text-slate-400'}>
                          {item.staleDays === null ? '-' : `${item.staleDays}d`}
                        </span>
                      </td>
                      <td className="py-1.5 pl-3 text-slate-600 max-w-[220px] truncate">{item.deal.nextAction || '-'}</td>
                      <td className={`py-1.5 ${item.overdueNextAction ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>{formatDate(item.deal.nextActionDate)}</td>
                      <td className="py-1.5 text-slate-400">{item.gatekept ? item.deal.gatekeeperName || 'Yes' : '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {hasHiddenFriction && !frictionExpanded && (
              <button type="button" onClick={() => setFrictionExpanded(true)} className="text-xs text-indigo-600 hover:text-indigo-800 mt-1">
                Show all {dashboard.frictionItems.length} items
              </button>
            )}
            {frictionExpanded && hasHiddenFriction && (
              <button type="button" onClick={() => setFrictionExpanded(false)} className="text-xs text-indigo-600 hover:text-indigo-800 mt-1">
                Show less
              </button>
            )}
            {dashboard.frictionItems.length === 0 && <p className="text-xs text-slate-400 py-2">No friction flags right now.</p>}
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-1.5">
            {visibleFriction.map((item) => {
              const bg = item.staleSeverity === 'red' ? 'bg-rose-50 border-rose-200' : item.staleSeverity === 'yellow' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
              return (
                <button key={String(item.deal.id)} type="button" onClick={() => onEditDeal(item.deal)} className={`w-full text-left rounded border p-2 text-xs ${bg}`}>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-800">{item.deal.title}</span>
                    <span className="text-slate-500">{formatCurrency(item.deal.expectedValue || 0)}</span>
                  </div>
                  <div className="text-slate-400 mt-0.5">{item.deal.nextAction || '-'}{item.deal.nextActionDate ? ` · ${formatDate(item.deal.nextActionDate)}` : ''}</div>
                </button>
              );
            })}
            {hasHiddenFriction && !frictionExpanded && (
              <button type="button" onClick={() => setFrictionExpanded(true)} className="text-xs text-indigo-600">
                Show all {dashboard.frictionItems.length}
              </button>
            )}
            {dashboard.frictionItems.length === 0 && <p className="text-xs text-slate-400">No friction flags.</p>}
          </div>
        </section>
      )}

      {/* ── Weekly + Trailing ── */}
      <section className="border-t border-slate-200 pt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-600">
        <div>
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">This Week</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <span>Conversations <b>{dashboard.conversationsHeld}</b></span>
            <span>Proposals <b>{dashboard.proposalsSentWeek}</b></span>
            <span>Follow-ups <b>{dashboard.followUpsMade}</b></span>
            <span>Won <b className="text-emerald-600">{dashboard.dealsWonWeek}</b></span>
            <span>Lost <b className="text-rose-500">{dashboard.dealsLostWeek}</b></span>
          </div>
        </div>
        <div>
          <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Trailing 90 Days</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5">
            <span>Close rate <b>{dashboard.closeRate.toFixed(0)}%</b></span>
            <span>Avg size <b>{formatCurrency(dashboard.avgDealSize)}</b></span>
            <span>Avg close <b>{Math.round(dashboard.avgTimeToCloseDays)}d</b></span>
            <span>Lost <b className="text-rose-500">{dashboard.lostTrailing90Deals.length}</b> · {formatCurrency(dashboard.lostTrailing90Value)}</span>
          </div>
          {dashboard.lostTrailing90Deals.length > 0 && (
            <div className="mt-1 text-slate-400 space-y-0.5">
              {dashboard.lostTrailing90Deals.map((deal) => (
                <div key={String(deal.id)}>{deal.title}: {deal.lossReason || 'no reason'}</div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
