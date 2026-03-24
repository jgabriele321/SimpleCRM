import React, { useState, useEffect } from 'react';
import { Deal, Stage, Priority, STAGE_LABELS } from '../types';

interface DealFormProps {
  initialData?: Deal | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (deal: Partial<Deal>) => Promise<void>;
}

const DEFAULT_DEAL: Partial<Deal> = {
  title: '',
  stage: 'signal',
  priority: 'medium',
  closeProbability: 20,
  expectedValue: 0,
  tags: [],
  isGatekept: false,
  notes: '',
};

export const DealForm: React.FC<DealFormProps> = ({ initialData, isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Deal>>(DEFAULT_DEAL);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData(DEFAULT_DEAL);
    }
    setTagInput('');
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (field: keyof Deal, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!formData.tags?.includes(tagInput.trim())) {
        handleChange('tags', [...(formData.tags || []), tagInput.trim()]);
      }
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    handleChange('tags', formData.tags?.filter(t => t !== tagToRemove) || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    if (formData.stage === 'closed_lost' && !formData.lossReason?.trim()) {
      alert('Please add a loss reason for closed lost deals.');
      return;
    }
    
    setIsSaving(true);
    try {
      let payload: Partial<Deal> = { ...formData };
      if (initialData) {
        const actionChanged = (formData.nextAction || '') !== (initialData.nextAction || '');
        const dateUnchanged =
          (formData.nextActionDate || '') === (initialData.nextActionDate || '');
        if (actionChanged && dateUnchanged) {
          // null clears the field on the server (undefined is omitted from JSON)
          payload = { ...payload, nextActionDate: null as unknown as string | undefined };
        }
      }
      await onSave(payload);
      onClose();
    } catch (error) {
      console.error(error);
      alert('Error saving deal');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header - Changed to bg-white */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
          <h2 className="text-xl font-bold text-slate-800">
            {initialData ? 'Edit Deal' : 'New Deal'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* Last Contact Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last Contact Date</label>
            <input
              type="date"
              className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={formData.lastContactDate?.split('T')[0] || ''}
              onChange={(e) => handleChange('lastContactDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            />
          </div>

          {/* Top Row: Title, Company, Person */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-1 md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Deal Title *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow"
                placeholder="e.g. Intro Call with Acme Corp"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company Name</label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Acme Corp"
                value={formData.companyName || ''}
                onChange={(e) => handleChange('companyName', e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contact Person</label>
              <input
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Alice Johnson"
                value={formData.personName || ''}
                onChange={(e) => handleChange('personName', e.target.value)}
              />
            </div>
          </div>

          {/* Metrics Row: Value, Probability, Priority */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expected Value ($)</label>
              <input
                type="number"
                min="0"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                value={formData.expectedValue}
                onChange={(e) => handleChange('expectedValue', Number(e.target.value))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Probability (%)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={formData.closeProbability}
                  onChange={(e) => handleChange('closeProbability', Number(e.target.value))}
                />
                <div className="absolute right-3 top-2.5 text-slate-400 text-sm pointer-events-none">%</div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.priority}
                onChange={(e) => handleChange('priority', e.target.value as Priority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Stage & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Stage</label>
              <select
                className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.stage}
                onChange={(e) => {
                  const nextStage = e.target.value as Stage;
                  handleChange('stage', nextStage);
                  if (nextStage !== 'closed_lost') {
                    handleChange('lossReason', undefined);
                  }
                }}
              >
                {Object.entries(STAGE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Expected Close Date</label>
              <input
                type="date"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={formData.expectedCloseDate?.split('T')[0] || ''}
                onChange={(e) => handleChange('expectedCloseDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
              />
            </div>
          </div>

          {/* Gatekeeper Tracking */}
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-100 space-y-4">
            <label className="flex items-center space-x-2 text-sm font-medium text-amber-900 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!formData.isGatekept}
                onChange={(e) => {
                  const checked = e.target.checked;
                  handleChange('isGatekept', checked);
                  if (!checked) {
                    handleChange('gatekeeperName', undefined);
                    handleChange('gatekeeperLastContacted', undefined);
                  }
                }}
                className="rounded text-amber-600 focus:ring-amber-500 border-amber-300"
              />
              <span>This deal is gatekept</span>
            </label>

            {formData.isGatekept && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Gatekeeper Name</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded border border-amber-200 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 text-sm"
                    placeholder="Name of intermediary"
                    value={formData.gatekeeperName || ''}
                    onChange={(e) => handleChange('gatekeeperName', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Last Contacted</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 rounded border border-amber-200 bg-white text-slate-900 focus:ring-2 focus:ring-amber-500 text-sm"
                    value={formData.gatekeeperLastContacted?.split('T')[0] || ''}
                    onChange={(e) =>
                      handleChange('gatekeeperLastContacted', e.target.value ? new Date(e.target.value).toISOString() : undefined)
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* Loss Reason */}
          {formData.stage === 'closed_lost' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Loss Reason *</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 rounded-lg border border-rose-200 bg-rose-50 text-slate-900 focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                placeholder="Why was this deal lost?"
                value={formData.lossReason || ''}
                onChange={(e) => handleChange('lossReason', e.target.value)}
              />
            </div>
          )}

          {/* Action Planning */}
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 space-y-4">
            <div className="flex items-center space-x-2 text-indigo-800 font-medium mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span>Stay Organized</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Next Action</label>
                <input
                  type="text"
                  placeholder="e.g. Email contract PDF"
                  className="w-full px-3 py-2 rounded border border-indigo-200 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={formData.nextAction || ''}
                  onChange={(e) => handleChange('nextAction', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-1">Due Date</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 rounded border border-indigo-200 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 text-sm"
                  value={formData.nextActionDate?.split('T')[0] || ''}
                  onChange={(e) => handleChange('nextActionDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Context / Notes</label>
            <textarea
              rows={4}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
              placeholder="Meeting notes, blockers, key stakeholders..."
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>

          {/* Tags */}
          <div>
             <label className="block text-sm font-medium text-slate-700 mb-1">Tags (Press Enter to add)</label>
             <input 
                type="text"
                className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-indigo-500 mb-2"
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
             />
             <div className="flex flex-wrap gap-2">
               {formData.tags?.map(tag => (
                 <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-slate-100 text-slate-800">
                   {tag}
                   <button 
                    type="button" 
                    onClick={() => removeTag(tag)}
                    className="ml-1.5 text-slate-400 hover:text-slate-600 focus:outline-none"
                   >
                     ×
                   </button>
                 </span>
               ))}
             </div>
          </div>
        </form>

        {/* Footer Actions - Changed to bg-white */}
        <div className="px-6 py-4 border-t border-slate-100 bg-white flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Deal'}
          </button>
        </div>
      </div>
    </div>
  );
};