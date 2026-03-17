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
      `# Prism DealFlow Export - ${today}`,
      '',
      `Generated: ${formatDateTime(now.toISOString())}`,
      `Total deals: ${deals.length}`,
      `Targeted deals: ${targetedDealIds.size}`,
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
    anchor.download = `prism-dealflow-${today}.md`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Navigation / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            
            <button
              type="button"
              onClick={handleExportMarkdown}
              title="Download full CRM markdown export"
              className="flex items-center space-x-3 text-left rounded-lg hover:bg-slate-100 px-1 py-1 transition-colors"
            >
              <div className="p-2 bg-indigo-600 rounded-lg text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Prism DealFlow</h1>
            </button>

            <div className="flex items-center space-x-4 flex-1 justify-end">
              {activeTab === 'pipeline' && (
                <div className="relative w-full max-w-md hidden md:block">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                     <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </span>
                  <input
                    type="text"
                    placeholder="Search deals, people, tags..."
                    className="w-full py-2 pl-10 pr-4 rounded-lg bg-slate-100 border-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
              )}
              
              <button 
                onClick={handleCreate}
                className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors whitespace-nowrap"
              >
                <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Deal
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
          <div className="border-t border-slate-100 bg-slate-50/50 backdrop-blur-xl">
             <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto no-scrollbar flex items-center gap-3">
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
              <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                <div className="mx-auto h-16 w-16 text-slate-300 mb-4">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                </div>
                <h3 className="mt-2 text-lg font-medium text-slate-900">No deals found</h3>
                <p className="mt-1 text-sm text-slate-500">Adjust your filters or create a new opportunity to get started.</p>
                <div className="mt-6">
                  <button onClick={handleCreate} className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
                    <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Deal
                  </button>
                </div>
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