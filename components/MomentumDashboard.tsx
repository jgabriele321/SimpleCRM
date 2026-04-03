import React, { useMemo } from 'react';
import { Deal, STAGE_COLORS, STAGE_LABELS, Stage } from '../types';

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

const METRIC_NEUTRAL = 'text-slate-800';
const METRIC_GREEN = 'text-emerald-600';
const METRIC_YELLOW = 'text-amber-500';
const METRIC_RED = 'text-rose-500';

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

  const proposalsColor =
    dashboard.proposalsOutDeals.length >= 5
      ? METRIC_GREEN
      : dashboard.proposalsOutDeals.length >= 3
        ? METRIC_YELLOW
        : METRIC_RED;

  const convoColor =
    dashboard.conversationsThisWeekDeals.length >= 5
      ? METRIC_GREEN
      : dashboard.conversationsThisWeekDeals.length >= 3
        ? METRIC_YELLOW
        : METRIC_RED;

  const closesColor =
    dashboard.closesLast30Deals.length >= 3
      ? METRIC_GREEN
      : dashboard.closesLast30Deals.length === 2
        ? METRIC_YELLOW
        : METRIC_RED;

  const meaningfulConvosColor =
    dashboard.meaningfulConvosThisWeekDeals.length >= 3
      ? METRIC_GREEN
      : dashboard.meaningfulConvosThisWeekDeals.length === 2
        ? METRIC_YELLOW
        : METRIC_RED;

  const Tooltip: React.FC<{ items: { id: string | number; line: React.ReactNode }[] }> = ({ items }) =>
    items.length > 0 ? (
      <div className="absolute left-0 top-full mt-1 z-50 hidden group-hover:block">
        <div className="bg-slate-900 border border-slate-700 rounded-md p-2 shadow-lg max-h-48 overflow-y-auto w-max max-w-xs">
          {items.map((i) => <div key={String(i.id)} className="text-xs py-0.5 text-slate-200 whitespace-nowrap">{i.line}</div>)}
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs text-slate-400">
          Week of {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
        <p className="text-xs text-slate-400">Won {dashboard.wonCount} · Lost {dashboard.lostCount}</p>
      </div>

      {/* Target metrics */}
      <section className="grid grid-cols-3 gap-4">
        <div className="relative group">
          <p className="text-xs text-slate-500">Proposals Out</p>
          <p className={`text-3xl font-bold tabular-nums ${proposalsColor}`}>{dashboard.proposalsOutDeals.length}<span className="text-base font-normal text-slate-400"> / 6</span></p>
          <Tooltip items={dashboard.proposalsOutDeals.map(d => ({ id: d.id, line: <>{d.title} <span className="text-slate-400">{formatCurrency(d.expectedValue || 0)}</span></> }))} />
        </div>
        <div className="relative group">
          <p className="text-xs text-slate-500">Closes (30d)</p>
          <p className={`text-3xl font-bold tabular-nums ${closesColor}`}>{dashboard.closesLast30Deals.length}<span className="text-base font-normal text-slate-400"> / 3</span></p>
          <Tooltip items={dashboard.closesLast30Deals.map(d => ({ id: d.id, line: <>{d.title} <span className="text-slate-400">{formatCurrency(d.expectedValue || 0)}</span></> }))} />
        </div>
        <div className="relative group">
          <p className="text-xs text-slate-500">Meaningful Convos</p>
          <p className={`text-3xl font-bold tabular-nums ${meaningfulConvosColor}`}>{dashboard.meaningfulConvosThisWeekDeals.length}<span className="text-base font-normal text-slate-400"> / 3</span></p>
          <Tooltip items={dashboard.meaningfulConvosThisWeekDeals.map(d => ({ id: d.id, line: <>{d.personName || d.title}</> }))} />
        </div>
      </section>

      {/* Supporting stats — compact row */}
      <section className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="relative group">
          <span className="text-slate-400">Pipeline </span><span className="font-semibold text-slate-800">{formatCurrency(dashboard.totalPipelineValue)}</span>
        </div>
        <div className="relative group">
          <span className="text-slate-400">Expected (30d) </span><span className="font-semibold text-slate-800">{formatCurrency(dashboard.expectedRevenue30)}</span>
          <Tooltip items={dashboard.expectedRevenue30Deals.map(d => {
            const w = ((d.expectedValue || 0) * (d.closeProbability || 0)) / 100;
            return { id: d.id, line: <>{d.title} <span className="text-slate-400">{formatCurrency(d.expectedValue||0)}×{d.closeProbability||0}%={formatCurrency(w)}</span></> };
          })} />
        </div>
        <div className="relative group">
          <span className="text-slate-400">Conversations </span><span className={`font-semibold ${convoColor}`}>{dashboard.conversationsThisWeekDeals.length}</span>
          <Tooltip items={dashboard.conversationsThisWeekDeals.map(d => ({ id: d.id, line: <>{d.personName || d.title}</> }))} />
        </div>
        <div className="relative group">
          <span className="text-slate-400">Proposals sent </span><span className="font-semibold text-slate-800">{dashboard.proposalsThisMonthDeals.length}</span>
          <Tooltip items={dashboard.proposalsThisMonthDeals.map(d => ({ id: d.id, line: <>{d.title} <span className="text-slate-400">{formatCurrency(d.expectedValue || 0)}</span></> }))} />
        </div>
      </section>

      {/* Funnel */}
      <section>
        <div className="space-y-1.5">
          {dashboard.funnel.map((item) => {
            const width = Math.max(6, (item.count / dashboard.maxFunnelCount) * 100);
            const barColor = STAGE_COLORS[item.stage].split(' ')[0];
            return (
              <div key={item.stage} className="flex items-center gap-2 text-xs">
                <div className="w-28 shrink-0 text-slate-500 text-right">{STAGE_LABELS[item.stage]}</div>
                <div className="flex-1 h-5 rounded bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded ${barColor}`} style={{ width: `${width}%` }} />
                </div>
                <div className="w-10 text-right text-slate-600 font-medium">{item.count}</div>
                <div className="w-16 text-right text-slate-400">{formatCurrency(item.value)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Friction Tracker */}
      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Needs Attention</h3>
        <div className="hidden md:block">
          <table className="w-full text-xs">
            <thead className="text-slate-400 border-b border-slate-200">
              <tr>
                <th className="py-1.5 text-left font-medium">Deal</th>
                <th className="py-1.5 text-left font-medium">Value</th>
                <th className="py-1.5 text-left font-medium">Stale</th>
                <th className="py-1.5 text-left font-medium">Next Action</th>
                <th className="py-1.5 text-left font-medium">Due</th>
                <th className="py-1.5 text-left font-medium">Gatekeeper</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.frictionItems.map((item) => {
                const rowBg = item.staleSeverity === 'red'
                  ? 'bg-rose-50'
                  : item.staleSeverity === 'yellow'
                    ? 'bg-amber-50/60'
                    : '';
                return (
                  <tr
                    key={String(item.deal.id)}
                    onClick={() => onEditDeal(item.deal)}
                    className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${rowBg}`}
                  >
                    <td className="py-1.5">
                      <div className="font-medium text-slate-800">{item.deal.title}</div>
                      <div className="text-slate-400">{[item.deal.personName, item.deal.companyName].filter(Boolean).join(' · ') || '-'}</div>
                    </td>
                    <td className="py-1.5 text-slate-700">{formatCurrency(item.deal.expectedValue || 0)}</td>
                    <td className="py-1.5">
                      <span className={item.staleSeverity === 'red' ? 'text-rose-600 font-semibold' : item.staleSeverity === 'yellow' ? 'text-amber-600' : 'text-slate-500'}>
                        {item.staleDays === null ? '-' : `${item.staleDays}d`}
                      </span>
                    </td>
                    <td className="py-1.5 text-slate-600 max-w-[200px] truncate">{item.deal.nextAction || '-'}</td>
                    <td className={`py-1.5 ${item.overdueNextAction ? 'text-rose-600 font-semibold' : 'text-slate-400'}`}>
                      {formatDate(item.deal.nextActionDate)}
                    </td>
                    <td className="py-1.5 text-slate-500">
                      {item.gatekept ? `${item.deal.gatekeeperName || 'Gatekept'}` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {dashboard.frictionItems.length === 0 && <p className="text-xs text-slate-400 py-2">No friction flags.</p>}
        </div>

        <div className="md:hidden space-y-1.5">
          {dashboard.frictionItems.map((item) => {
            const bg = item.staleSeverity === 'red' ? 'bg-rose-50 border-rose-200' : item.staleSeverity === 'yellow' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200';
            return (
              <button key={String(item.deal.id)} type="button" onClick={() => onEditDeal(item.deal)} className={`w-full text-left rounded border p-2.5 text-xs ${bg}`}>
                <div className="flex justify-between"><span className="font-medium text-slate-800">{item.deal.title}</span><span className="text-slate-500">{formatCurrency(item.deal.expectedValue || 0)}</span></div>
                <div className="text-slate-400 mt-0.5">{item.deal.nextAction || '-'}{item.deal.nextActionDate ? ` · ${formatDate(item.deal.nextActionDate)}` : ''}</div>
              </button>
            );
          })}
          {dashboard.frictionItems.length === 0 && <p className="text-xs text-slate-400">No friction flags.</p>}
        </div>
      </section>

      {/* Weekly + Trailing — compact inline */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <h3 className="font-semibold text-slate-500 uppercase tracking-wide mb-1.5">This Week</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-slate-600">
            <span>Conversations <b>{dashboard.conversationsHeld}</b></span>
            <span>Proposals sent <b>{dashboard.proposalsSentWeek}</b></span>
            <span>Follow-ups <b>{dashboard.followUpsMade}</b></span>
            <span>Won <b className="text-emerald-600">{dashboard.dealsWonWeek}</b></span>
            <span>Lost <b className="text-rose-500">{dashboard.dealsLostWeek}</b></span>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Trailing 90 Days</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-slate-600">
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
