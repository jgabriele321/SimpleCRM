import React, { useEffect, useState, useMemo } from 'react';
import { Deal, FilterState, Stage, STAGE_LABELS, STAGE_COLORS } from './types';
import { dealService } from './services/dealService';
import { DealCard } from './components/DealCard';
import { DealForm } from './components/DealForm';
import { PipelineStats } from './components/PipelineStats';

function App() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // UI State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

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

  // Derived State (Filtered Deals)
  const filteredDeals = useMemo(() => {
    return deals.filter(deal => {
      // Search
      const searchContent = (deal.title + deal.personName + deal.companyName + deal.notes + deal.tags.join(' ')).toLowerCase();
      if (filters.search && !searchContent.includes(filters.search.toLowerCase())) return false;
      
      // Stage
      if (filters.stages.length > 0 && !filters.stages.includes(deal.stage)) return false;
      
      // Closed Toggle
      if (filters.hideClosed && (deal.stage === 'closed_won' || deal.stage === 'closed_lost')) return false;

      return true;
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Top Navigation / Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-600 rounded-lg text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Prism DealFlow</h1>
            </div>

            <div className="flex items-center space-x-4 flex-1 justify-end">
              <div className="relative w-full max-w-md">
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
              
              <button 
                onClick={handleCreate}
                className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors whitespace-nowrap"
              >
                <svg className="w-5 h-5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                New Deal
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
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
               // Extract base color name for border logic
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
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : filteredDeals.length === 0 ? (
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
              />
            ))}
          </div>
        )}
      </main>

      {/* Sticky Pipeline Summary */}
      <PipelineStats deals={filteredDeals} />

      {/* Modals */}
      <DealForm 
        isOpen={isModalOpen}
        initialData={selectedDeal}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
      
      {/* Delete button only visible when editing */}
      {isModalOpen && selectedDeal && (
        <div className="fixed z-50 bottom-6 left-6 md:left-auto md:right-auto md:w-full md:pointer-events-none md:flex md:justify-center">
             {/* We actually put the delete button inside the form usually, but for this 'editor' feel, let's put it on the modal. 
                Wait, the modal covers the screen. The Delete button is inside DealForm? 
                Actually, the requirement said "Right/side or modal: deal detail editor".
                I put it in a modal. I will add a Delete button to the modal footer or a specific danger zone.
                Let's stick to the DealForm implementing the UI. 
             */}
        </div>
      )}

    </div>
  );
}

export default App;