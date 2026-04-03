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

const inputClass = 'w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
const labelClass = 'block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        
        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-900">
            {initialData ? 'Edit Deal' : 'New Deal'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 space-y-4">

          <div>
            <label className={labelClass}>Last Contact</label>
            <input
              type="date"
              className={inputClass}
              value={formData.lastContactDate?.split('T')[0] || ''}
              onChange={(e) => handleChange('lastContactDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
            />
          </div>

          <div>
            <label className={labelClass}>Deal Title *</label>
            <input
              type="text"
              required
              className={inputClass}
              placeholder="e.g. Intro Call with Acme Corp"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Company</label>
              <input type="text" className={inputClass} placeholder="Acme Corp" value={formData.companyName || ''} onChange={(e) => handleChange('companyName', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Contact</label>
              <input type="text" className={inputClass} placeholder="Alice Johnson" value={formData.personName || ''} onChange={(e) => handleChange('personName', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Value ($)</label>
              <input type="number" min="0" className={inputClass} value={formData.expectedValue} onChange={(e) => handleChange('expectedValue', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Probability</label>
              <input type="number" min="0" max="100" className={inputClass} value={formData.closeProbability} onChange={(e) => handleChange('closeProbability', Number(e.target.value))} />
            </div>
            <div>
              <label className={labelClass}>Priority</label>
              <select className={inputClass} value={formData.priority} onChange={(e) => handleChange('priority', e.target.value as Priority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Stage</label>
              <select
                className={inputClass}
                value={formData.stage}
                onChange={(e) => {
                  const nextStage = e.target.value as Stage;
                  handleChange('stage', nextStage);
                  if (nextStage !== 'closed_lost') handleChange('lossReason', undefined);
                }}
              >
                {Object.entries(STAGE_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Expected Close</label>
              <input
                type="date"
                className={inputClass}
                value={formData.expectedCloseDate?.split('T')[0] || ''}
                onChange={(e) => handleChange('expectedCloseDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
              />
            </div>
          </div>

          {formData.stage === 'closed_lost' && (
            <div>
              <label className={labelClass}>Loss Reason *</label>
              <input
                type="text"
                required
                className={`${inputClass} border-rose-300 focus:ring-rose-500`}
                placeholder="Why was this deal lost?"
                value={formData.lossReason || ''}
                onChange={(e) => handleChange('lossReason', e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Next Action</label>
              <input
                type="text"
                placeholder="e.g. Send contract"
                className={inputClass}
                value={formData.nextAction || ''}
                onChange={(e) => handleChange('nextAction', e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Due Date</label>
              <input
                type="date"
                className={inputClass}
                value={formData.nextActionDate?.split('T')[0] || ''}
                onChange={(e) => handleChange('nextActionDate', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
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
                className="rounded text-amber-600 focus:ring-amber-500 border-slate-300"
              />
              <span>Gatekept</span>
            </label>

            {formData.isGatekept && (
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className={labelClass}>Gatekeeper</label>
                  <input type="text" className={inputClass} placeholder="Name" value={formData.gatekeeperName || ''} onChange={(e) => handleChange('gatekeeperName', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Last Contacted</label>
                  <input
                    type="date"
                    className={inputClass}
                    value={formData.gatekeeperLastContacted?.split('T')[0] || ''}
                    onChange={(e) => handleChange('gatekeeperLastContacted', e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea
              rows={3}
              className={`${inputClass} font-mono`}
              placeholder="Context, blockers, stakeholders..."
              value={formData.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
            />
          </div>

          <div>
             <label className={labelClass}>Tags (Enter to add)</label>
             <input 
                type="text"
                className={`${inputClass} mb-2`}
                placeholder="Add tag..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
             />
             {formData.tags && formData.tags.length > 0 && (
               <div className="flex flex-wrap gap-1.5">
                 {formData.tags.map(tag => (
                   <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700">
                     {tag}
                     <button type="button" onClick={() => removeTag(tag)} className="ml-1 text-slate-400 hover:text-slate-600">×</button>
                   </span>
                 ))}
               </div>
             )}
          </div>
        </form>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};
