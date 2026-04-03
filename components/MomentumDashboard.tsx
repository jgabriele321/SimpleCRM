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

const METRIC_NEUTRAL = 'text-slate-100';
const METRIC_GREEN = 'text-emerald-300';
const METRIC_YELLOW = 'text-amber-300';
const METRIC_RED = 'text-rose-300';

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
      .filter((deal) => isActivePipelineStage(deal.stage))
      .map((deal) => {
        const lastTouchDate = toDate(deal.lastContactDate);
        const staleDays = lastTouchDate ? Math.floor((now.getTime() - lastTouchDate.getTime()) / DAY_MS) : null;
        const staleSeverity =
          staleDays === null ? null : staleDays > 21 ? 'red' : staleDays > 14 ? 'yellow' : null;
        const nextActionDate = toDate(deal.nextActionDate);
        const overdueNextAction = !!nextActionDate && nextActionDate < now;
        const gatekept = !!deal.isGatekept;

        if (!staleSeverity && !overdueNextAction && !gatekept) return null;

        const urgency =
          (overdueNextAction ? 300 : 0) + (staleSeverity === 'red' ? 200 : staleSeverity === 'yellow' ? 100 : 0) + (gatekept ? 50 : 0);

        return {
          deal,
          staleDays,
          staleSeverity,
          overdueNextAction,
          gatekept,
          urgency
        };
      })
      .filter((item): item is FrictionItem => item !== null)
      .sort((a, b) => b.urgency - a.urgency);

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
      const closed = stageChangedDate(d);
      return !!closed && isInRange(closed, trailing30Start, now);
    });

    const discoveryCallsThisWeekDeals = deals.filter((d) => {
      if (d.stage !== 'active_convo') return false;
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
      discoveryCallsThisWeekDeals,
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

  const discoveryColor =
    dashboard.discoveryCallsThisWeekDeals.length >= 3
      ? METRIC_GREEN
      : dashboard.discoveryCallsThisWeekDeals.length === 2
        ? METRIC_YELLOW
        : METRIC_RED;

  return (
    <div className="min-h-[calc(100vh-10rem)] rounded-2xl border border-slate-800 bg-slate-950 text-slate-100 p-4 lg:p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Deal Momentum Dashboard</h2>
          <p className="text-xs text-slate-400">
            Week of {weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
            {weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
        </div>
      </div>

      <section className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <div className="relative group rounded-xl bg-slate-900 border border-slate-800 p-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Proposals Out Now</p>
          <p className={`text-2xl font-bold ${proposalsColor}`}>{dashboard.proposalsOutDeals.length} / 6</p>
          {dashboard.proposalsOutDeals.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 hidden group-hover:block">
              <div className="bg-black/95 border border-slate-700 rounded-lg p-2 shadow-xl max-h-48 overflow-y-auto">
                {dashboard.proposalsOutDeals.map((d) => (
                  <div key={String(d.id)} className="text-xs py-0.5">
                    <span className="text-slate-100">{d.title}</span>
                    <span className="text-slate-400 ml-1">{formatCurrency(d.expectedValue || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative group rounded-xl bg-slate-900 border border-slate-800 p-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Closes Last 30 Days</p>
          <p className={`text-2xl font-bold ${closesColor}`}>{dashboard.closesLast30Deals.length} / 3</p>
          {dashboard.closesLast30Deals.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 hidden group-hover:block">
              <div className="bg-black/95 border border-slate-700 rounded-lg p-2 shadow-xl max-h-48 overflow-y-auto">
                {dashboard.closesLast30Deals.map((d) => (
                  <div key={String(d.id)} className="text-xs py-0.5">
                    <span className="text-slate-100">{d.title}</span>
                    <span className="text-slate-400 ml-1">{formatCurrency(d.expectedValue || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative group rounded-xl bg-slate-900 border border-slate-800 p-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Discovery Calls This Week</p>
          <p className={`text-2xl font-bold ${discoveryColor}`}>{dashboard.discoveryCallsThisWeekDeals.length} / 3</p>
          {dashboard.discoveryCallsThisWeekDeals.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 hidden group-hover:block">
              <div className="bg-black/95 border border-slate-700 rounded-lg p-2 shadow-xl max-h-48 overflow-y-auto">
                {dashboard.discoveryCallsThisWeekDeals.map((d) => (
                  <div key={String(d.id)} className="text-xs py-0.5 text-slate-100">
                    {d.personName || d.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="rounded-xl bg-slate-900 border border-slate-800 p-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Total Pipeline Value</p>
          <p className={`text-2xl font-bold ${METRIC_NEUTRAL}`}>{formatCurrency(dashboard.totalPipelineValue)}</p>
        </div>
        <div className="relative group rounded-xl bg-slate-900 border border-slate-800 p-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Conversations This Week</p>
          <p className={`text-2xl font-bold ${convoColor}`}>{dashboard.conversationsThisWeekDeals.length}</p>
          {dashboard.conversationsThisWeekDeals.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 hidden group-hover:block">
              <div className="bg-black/95 border border-slate-700 rounded-lg p-2 shadow-xl max-h-48 overflow-y-auto">
                {dashboard.conversationsThisWeekDeals.map((d) => (
                  <div key={String(d.id)} className="text-xs py-0.5 text-slate-100">
                    {d.personName || d.title}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="relative group rounded-xl bg-slate-900 border border-slate-800 p-3">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Expected Revenue (30 Days)</p>
          <p className={`text-2xl font-bold ${METRIC_NEUTRAL}`}>{formatCurrency(dashboard.expectedRevenue30)}</p>
          {dashboard.expectedRevenue30Deals.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 hidden group-hover:block">
              <div className="bg-black/95 border border-slate-700 rounded-lg p-2 shadow-xl max-h-48 overflow-y-auto">
                {dashboard.expectedRevenue30Deals.map((d) => {
                  const weighted = ((d.expectedValue || 0) * (d.closeProbability || 0)) / 100;
                  return (
                    <div key={String(d.id)} className="text-xs py-0.5">
                      <span className="text-slate-100">{d.title}</span>
                      <span className="text-slate-400 ml-1">
                        {formatCurrency(d.expectedValue || 0)} × {d.closeProbability || 0}% = {formatCurrency(weighted)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="relative group rounded-xl bg-slate-900 border border-slate-800 p-3 col-span-2 xl:col-span-1">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">Proposals Sent This Month</p>
          <p className={`text-2xl font-bold ${METRIC_NEUTRAL}`}>{dashboard.proposalsThisMonthDeals.length}</p>
          {dashboard.proposalsThisMonthDeals.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-50 hidden group-hover:block">
              <div className="bg-black/95 border border-slate-700 rounded-lg p-2 shadow-xl max-h-48 overflow-y-auto">
                {dashboard.proposalsThisMonthDeals.map((d) => (
                  <div key={String(d.id)} className="text-xs py-0.5">
                    <span className="text-slate-100">{d.title}</span>
                    <span className="text-slate-400 ml-1">{formatCurrency(d.expectedValue || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Pipeline Funnel</h3>
          <div className="text-xs text-slate-400">Won: {dashboard.wonCount} | Lost: {dashboard.lostCount}</div>
        </div>
        <div className="space-y-2">
          {dashboard.funnel.map((item) => {
            const width = Math.max(8, (item.count / dashboard.maxFunnelCount) * 100);
            const colorToken = STAGE_COLORS[item.stage].split(' ')[0];
            return (
              <div key={item.stage} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4 sm:col-span-3 text-xs text-slate-300">{STAGE_LABELS[item.stage]}</div>
                <div className="col-span-8 sm:col-span-6 h-6 rounded bg-slate-800 overflow-hidden">
                  <div className={`h-full ${colorToken}`} style={{ width: `${width}%` }} />
                </div>
                <div className="hidden sm:block col-span-2 text-right text-xs text-slate-300">{item.count} deals</div>
                <div className="hidden sm:block col-span-1 text-right text-xs text-slate-400">{formatCurrency(item.value)}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-3">
        <h3 className="text-sm font-semibold mb-2">Friction Tracker</h3>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 text-left font-medium">Deal</th>
                <th className="py-2 text-left font-medium">Value</th>
                <th className="py-2 text-left font-medium">Days Since Touch</th>
                <th className="py-2 text-left font-medium">Next Action</th>
                <th className="py-2 text-left font-medium">Due</th>
                <th className="py-2 text-left font-medium">Gatekeeper</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.frictionItems.map((item) => (
                <tr
                  key={String(item.deal.id)}
                  onClick={() => onEditDeal(item.deal)}
                  className="border-b border-slate-900 hover:bg-slate-800/60 cursor-pointer"
                >
                  <td className="py-2">
                    <div className="font-medium text-slate-100">{item.deal.title}</div>
                    <div className="text-slate-400">
                      {item.deal.personName || '-'} · {item.deal.companyName || '-'}
                    </div>
                  </td>
                  <td className="py-2 text-slate-200">{formatCurrency(item.deal.expectedValue || 0)}</td>
                  <td className="py-2">
                    <span
                      className={
                        item.staleSeverity === 'red'
                          ? 'text-rose-300'
                          : item.staleSeverity === 'yellow'
                            ? 'text-amber-300'
                            : 'text-slate-300'
                      }
                    >
                      {item.staleDays === null ? '-' : `${item.staleDays}d`}
                    </span>
                  </td>
                  <td className="py-2 text-slate-300">{item.deal.nextAction || '-'}</td>
                  <td className={`py-2 ${item.overdueNextAction ? 'text-rose-300 font-semibold' : 'text-slate-400'}`}>
                    {formatDate(item.deal.nextActionDate)}
                  </td>
                  <td className="py-2 text-slate-300">
                    {item.gatekept
                      ? `${item.deal.gatekeeperName || 'Gatekept'} · ${formatDate(item.deal.gatekeeperLastContacted)}`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dashboard.frictionItems.length === 0 && <p className="text-xs text-slate-400 py-3">No urgent friction flags.</p>}
        </div>

        <div className="md:hidden space-y-2">
          {dashboard.frictionItems.map((item) => (
            <button
              key={String(item.deal.id)}
              type="button"
              onClick={() => onEditDeal(item.deal)}
              className="w-full text-left rounded-lg border border-slate-800 bg-slate-950 p-3"
            >
              <p className="text-sm font-medium">{item.deal.title}</p>
              <p className="text-xs text-slate-400">
                {item.deal.personName || '-'} · {item.deal.companyName || '-'}
              </p>
              <p className="text-xs text-slate-300 mt-1">Value: {formatCurrency(item.deal.expectedValue || 0)}</p>
              <p className="text-xs text-slate-300">Next: {item.deal.nextAction || '-'}</p>
              <p className="text-xs text-slate-400">Due: {formatDate(item.deal.nextActionDate)}</p>
              {item.gatekept && (
                <p className="text-xs text-amber-300">
                  Gatekeeper: {item.deal.gatekeeperName || 'Gatekept'} ({formatDate(item.deal.gatekeeperLastContacted)})
                </p>
              )}
            </button>
          ))}
          {dashboard.frictionItems.length === 0 && <p className="text-xs text-slate-400 py-1">No urgent friction flags.</p>}
        </div>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-3">
        <h3 className="text-sm font-semibold mb-2">Weekly Activity Log</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="rounded bg-slate-950 border border-slate-800 p-2">
            <p className="text-slate-400">Conversations</p>
            <p className="text-lg font-semibold">{dashboard.conversationsHeld}</p>
          </div>
          <div className="rounded bg-slate-950 border border-slate-800 p-2">
            <p className="text-slate-400">Proposals Sent</p>
            <p className="text-lg font-semibold">{dashboard.proposalsSentWeek}</p>
          </div>
          <div className="rounded bg-slate-950 border border-slate-800 p-2">
            <p className="text-slate-400">Follow-ups Made</p>
            <p className="text-lg font-semibold">{dashboard.followUpsMade}</p>
          </div>
          <div className="rounded bg-slate-950 border border-slate-800 p-2">
            <p className="text-slate-400">Deals Won</p>
            <p className="text-lg font-semibold text-emerald-300">{dashboard.dealsWonWeek}</p>
          </div>
          <div className="rounded bg-slate-950 border border-slate-800 p-2">
            <p className="text-slate-400">Deals Lost</p>
            <p className="text-lg font-semibold text-rose-300">{dashboard.dealsLostWeek}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-slate-900 border border-slate-800 p-3">
        <h3 className="text-sm font-semibold mb-2">Trailing Metrics (90 Days)</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div className="rounded bg-slate-950 border border-slate-800 p-2">
            <p className="text-slate-400">Close Rate</p>
            <p className="text-lg font-semibold">{dashboard.closeRate.toFixed(0)}%</p>
          </div>
          <div className="rounded bg-slate-950 border border-slate-800 p-2">
            <p className="text-slate-400">Avg Deal Size</p>
            <p className="text-lg font-semibold">{formatCurrency(dashboard.avgDealSize)}</p>
          </div>
          <div className="rounded bg-slate-950 border border-slate-800 p-2">
            <p className="text-slate-400">Avg Time to Close</p>
            <p className="text-lg font-semibold">{Math.round(dashboard.avgTimeToCloseDays)}d</p>
          </div>
          <div className="rounded bg-slate-950 border border-slate-800 p-2">
            <p className="text-slate-400">Deals Lost (90 Days)</p>
            <p className="text-lg font-semibold text-rose-300">
              {dashboard.lostTrailing90Deals.length} · {formatCurrency(dashboard.lostTrailing90Value)}
            </p>
          </div>
        </div>
        {dashboard.lostTrailing90Deals.length > 0 && (
          <div className="mt-2 text-xs text-slate-400 space-y-1">
            {dashboard.lostTrailing90Deals.map((deal) => (
              <div key={String(deal.id)} title={deal.lossReason || 'No loss reason'}>
                {deal.title}: {deal.lossReason || 'No loss reason provided'}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
