import React, { useEffect, useState, useMemo } from 'react';
import { Deal, FilterState, Stage, STAGE_LABELS, STAGE_COLORS } from './types';
import { dealService } from './services/dealService';
import { DealCard } from './components/DealCard';
import { DealForm } from './components/DealForm';
import { PipelineStats } from './components/PipelineStats';
import { MomentumDashboard } from './components/MomentumDashboard';

type Tab = 'dashboard' | 'pipeline';

const TARGETED_DEALS_KEY = 'prism_targeted_deals';
const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value?: string) => (value ? new Date(value) : null);
const isValidDate = (value?: string) => {
  const date = toDate(value);
  return !!date && !Number.isNaN(date.getTime());
};

const formatDate = (value?: string) => {
  if (!isValidDate(value)) return '-';
  return new Date(value!).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (value?: string) => {
  if (!isValidDate(value)) return '-';
  return new Date(value!).toLocaleString('en-US');
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const toggleTargeted = async (dealId: string | number) => {
    try {
      const updated = await dealService.toggleTarget(dealId);
      setDeals(prev => prev.map(d => d.id === updated.id ? updated : d));
    } catch (err) {
      console.error('Failed to toggle target', err);
    }
  };

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    stages: [],
    priorities: [],
    tags: [],
    hideClosed: true,
  });

  // Fetch Deals
  useEffect(() => {
    loadDeals();
  }, []);

  const loadDeals = async () => {
    try {
      setIsLoading(true);
      const data = await dealService.getAll();
      setDeals(data);
    } catch (err) {
      setError('Failed to load deals.');
    } finally {
      setIsLoading(false);
    }
  };

  // Actions
  const handleCreate = () => {
    setSelectedDeal(null);
    setIsModalOpen(true);
  };

  const handleEdit = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsModalOpen(true);
  };

  const handleSave = async (dealData: Partial<Deal>) => {
    try {
      if (selectedDeal) {
        // Update
        const updated = await dealService.update(selectedDeal.id, dealData);
        setDeals(prev => prev.map(d => d.id === updated.id ? updated : d));
      } else {
        // Create
        // @ts-ignore - ID handled by service
        const created = await dealService.create(dealData);
        setDeals(prev => [created, ...prev]);
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const handleDelete = async (id: string | number) => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    try {
      await dealService.delete(id);
      setDeals(prev => prev.filter(d => d.id !== id));
      setIsModalOpen(false);
    } catch (err) {
      alert('Failed to delete');
    }
  };

  // Derived State (Filtered + Sorted Deals)
  const filteredDeals = useMemo(() => {
    const filtered = deals.filter(deal => {
      // Search
      const searchContent = (deal.title + deal.personName + deal.companyName + deal.notes + deal.tags.join(' ')).toLowerCase();
      if (filters.search && !searchContent.includes(filters.search.toLowerCase())) return false;
      
      // Stage
      if (filters.stages.length > 0 && !filters.stages.includes(deal.stage)) return false;
      
      // Closed Toggle
      if (filters.hideClosed && (deal.stage === 'closed_won' || deal.stage === 'closed_lost')) return false;

      return true;
    });

    // Sort: targeted deals first, then by closeProbability desc, then expectedValue desc
    return filtered.sort((a, b) => {
      const aTargeted = a.isTargeted ? 1 : 0;
      const bTargeted = b.isTargeted ? 1 : 0;
      if (bTargeted !== aTargeted) return bTargeted - aTargeted;
      
      const probDiff = Number(b.closeProbability) - Number(a.closeProbability);
      if (probDiff !== 0) return probDiff;
      
      return Number(b.expectedValue) - Number(a.expectedValue);
    });
  }, [deals, filters]);

  // Handle Filter Toggles
  const toggleStageFilter = (stage: Stage) => {
    setFilters(prev => ({
      ...prev,
      stages: prev.stages.includes(stage) 
        ? prev.stages.filter(s => s !== stage)
        : [...prev.stages, stage]
    }));
  };

  const handleExportMarkdown = () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekStart = new Date(now);
    const day = weekStart.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    weekStart.setDate(weekStart.getDate() + offset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const stageBreakdown = Object.entries(STAGE_LABELS).map(([stage, label]) => {
      const stageDeals = deals.filter((deal) => deal.stage === stage);
      const value = stageDeals.reduce((sum, deal) => sum + (deal.expectedValue || 0), 0);
      return { stage, label, count: stageDeals.length, value };
    });

    const proposalsOut = deals.filter((deal) => deal.stage === 'proposal_sent').length;
    const activePipeline = deals.filter((deal) => !['closed_won', 'closed_lost', 'nurture'].includes(deal.stage));
    const totalPipelineValue = activePipeline.reduce((sum, deal) => sum + (deal.expectedValue || 0), 0);
    const expectedRevenue30 = deals
      .filter((deal) => {
        if (!isValidDate(deal.expectedCloseDate)) return false;
        const closeDate = new Date(deal.expectedCloseDate!);
        const inWindow = closeDate >= now && closeDate <= new Date(now.getTime() + 30 * DAY_MS);
        return inWindow;
      })
      .reduce((sum, deal) => sum + ((deal.expectedValue || 0) * (deal.closeProbability || 0)) / 100, 0);
    const conversationsThisWeek = deals.filter((deal) => {
      const lastContact = toDate(deal.lastContactDate);
      const stageChanged = toDate(deal.stageChangedAt);
      const lastTouchInWeek = !!lastContact && lastContact >= weekStart && lastContact <= weekEnd;
      const stageChangeInWeek = !!stageChanged && stageChanged >= weekStart && stageChanged <= weekEnd;
      return lastTouchInWeek || stageChangeInWeek;
    }).length;

    const lines: string[] = [
      `# Daedalus Deal Dashboard Export - ${today}`,
      '',
      `Generated: ${formatDateTime(now.toISOString())}`,
      `Total deals: ${deals.length}`,
      `Targeted deals: ${deals.filter(d => d.isTargeted).length}`,
      '',
      '## Momentum Snapshot',
      '',
      `- Proposals out now: ${proposalsOut} / 10`,
      `- Total pipeline value: ${formatCurrency(totalPipelineValue)}`,
      `- Expected revenue (next 30 days): ${formatCurrency(expectedRevenue30)}`,
      `- Conversations this week: ${conversationsThisWeek}`,
      '',
      '## Stage Breakdown',
      '',
      '| Stage | Deals | Total Value |',
      '|---|---:|---:|',
      ...stageBreakdown.map((item) => `| ${item.label} | ${item.count} | ${formatCurrency(item.value)} |`),
      '',
      '## Active Filters',
      '',
      `- Search: ${filters.search || '(none)'}`,
      `- Stage filters: ${filters.stages.length ? filters.stages.map((s) => STAGE_LABELS[s]).join(', ') : '(none)'}`,
      `- Hide closed: ${filters.hideClosed ? 'Yes' : 'No'}`,
      '',
      '## Deal Details',
      ''
    ];

    deals.forEach((deal, index) => {
      const daysSinceTouch = isValidDate(deal.lastContactDate)
        ? Math.floor((now.getTime() - new Date(deal.lastContactDate!).getTime()) / DAY_MS)
        : null;
      const isTargeted = deal.isTargeted ? 'Yes' : 'No';

      lines.push(
        `### ${index + 1}. ${deal.title}`,
        '',
        `- ID: ${deal.id}`,
        `- Targeted: ${isTargeted}`,
        `- Stage: ${STAGE_LABELS[deal.stage] || deal.stage}`,
        `- Priority: ${deal.priority}`,
        `- Person: ${deal.personName || '-'}`,
        `- Company: ${deal.companyName || '-'}`,
        `- Expected value: ${formatCurrency(deal.expectedValue || 0)}`,
        `- Close probability: ${deal.closeProbability || 0}%`,
        `- Expected close date: ${formatDate(deal.expectedCloseDate)}`,
        `- Last contact date: ${formatDate(deal.lastContactDate)}`,
        `- Days since touch: ${daysSinceTouch ?? '-'}`,
        `- Next action: ${deal.nextAction || '-'}`,
        `- Next action date: ${formatDate(deal.nextActionDate)}`,
        `- Gatekept: ${deal.isGatekept ? 'Yes' : 'No'}`,
        `- Gatekeeper: ${deal.gatekeeperName || '-'}`,
        `- Gatekeeper last contacted: ${formatDate(deal.gatekeeperLastContacted)}`,
        `- Loss reason: ${deal.lossReason || '-'}`,
        `- Stage changed at: ${formatDateTime(deal.stageChangedAt)}`,
        `- Tags: ${deal.tags?.length ? deal.tags.join(', ') : '-'}`,
        `- Notes: ${deal.notes || '-'}`,
        `- Created at: ${formatDateTime(deal.createdAt)}`,
        `- Updated at: ${formatDateTime(deal.updatedAt)}`,
        ''
      );
    });

    const markdown = lines.join('\n');
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `daedalus-deals-${today}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Navigation / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 pb-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            
            <button
              type="button"
              onClick={handleExportMarkdown}
              title="Download full CRM markdown export"
              className="flex items-center gap-2 text-left rounded hover:bg-slate-50 px-1 py-1 transition-colors"
            >
              <span className="text-lg font-bold tracking-tight text-slate-900">DDD</span>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            </button>

            <div className="flex items-center gap-3 flex-1 justify-end">
              {activeTab === 'pipeline' && (
                <div className="relative w-full max-w-sm hidden md:block">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                     <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search deals..."
                    className="w-full py-1.5 pl-9 pr-3 rounded-md bg-slate-100 border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
              )}
              <a
                href="/people"
                className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                People
              </a>
              <button 
                onClick={handleCreate}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap"
              >
                + New Deal
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'dashboard'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Momentum
            </button>
            <button
              onClick={() => setActiveTab('pipeline')}
              className={`pb-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pipeline' 
                  ? 'border-indigo-600 text-indigo-600' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              Pipeline View
            </button>
          </div>
        </div>

        {/* Filter Bar (Only show in Pipeline view) */}
        {activeTab === 'pipeline' && (
          <div className="border-t border-slate-100 bg-slate-50">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 overflow-x-auto no-scrollbar flex items-center gap-2">
               <div className="flex items-center pr-4 border-r border-slate-200 mr-2">
                 <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-slate-600 select-none">
                   <input 
                    type="checkbox" 
                    checked={filters.hideClosed} 
                    onChange={() => setFilters(prev => ({ ...prev, hideClosed: !prev.hideClosed }))}
                    className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300" 
                   />
                   <span>Active Pipeline Only</span>
                 </label>
               </div>
               
               {Object.keys(STAGE_LABELS).map((key) => {
                 const stage = key as Stage;
                 const isActive = filters.stages.includes(stage);
                 const baseColor = STAGE_COLORS[stage].split(' ')[1].replace('text-', '');
                 
                 return (
                   <button
                      key={stage}
                      onClick={() => toggleStageFilter(stage)}
                      className={`
                        px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border
                        ${isActive 
                          ? `${STAGE_COLORS[stage]} ring-1 ring-offset-1 ring-${baseColor}` 
                          : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}
                      `}
                   >
                     {STAGE_LABELS[stage]}
                   </button>
                 );
               })}
             </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : activeTab === 'dashboard' ? (
          <MomentumDashboard deals={deals} onEditDeal={handleEdit} />
        ) : (
          <>
            {filteredDeals.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-slate-500">No deals match your filters.</p>
                <button onClick={handleCreate} className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                  + Create a deal
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredDeals.map(deal => (
                  <DealCard 
                    key={deal.id} 
                    deal={deal} 
                    onClick={handleEdit}
                    isTargeted={deal.isTargeted}
                    onToggleTarget={() => toggleTargeted(deal.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Sticky Pipeline Summary - Only show on pipeline view */}
      {activeTab === 'pipeline' && <PipelineStats deals={filteredDeals} />}

      {/* Modals */}
      <DealForm 
        isOpen={isModalOpen}
        initialData={selectedDeal}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
      
    </div>
  );
}

export default App;