import React, { useState, useEffect } from 'react';
import { ReferralPartner } from '../types';

interface ReferralPartnerFormProps {
  initialData?: ReferralPartner | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (partner: Partial<ReferralPartner>) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
}

const EMPTY: Partial<ReferralPartner> = { name: '' };

const inputClass = 'w-full px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500';
const labelClass = 'block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1';

export const ReferralPartnerForm: React.FC<ReferralPartnerFormProps> = ({ initialData, isOpen, onClose, onSave, onDelete }) => {
  const [form, setForm] = useState<Partial<ReferralPartner>>(EMPTY);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(initialData ? initialData : EMPTY);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const change = (field: keyof ReferralPartner, value: any) => setForm((prev) => ({ ...prev, [field]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) return;
    setIsSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      console.error(err);
      alert('Error saving referral partner');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!initialData?.id || !onDelete) return;
    if (!confirm(`Remove referral partner "${initialData.name}"? Their referred deals stay, just unlinked.`)) return;
    setIsSaving(true);
    try {
      await onDelete(initialData.id);
      onClose();
    } catch {
      alert('Failed to delete');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-900">{initialData ? 'Edit Referral Partner' : 'New Referral Partner'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <form onSubmit={submit} className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Name *</label>
              <input type="text" required className={inputClass} placeholder="Ethan Cole" value={form.name || ''} onChange={(e) => change('name', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Company</label>
              <input type="text" className={inputClass} placeholder="(optional)" value={form.company || ''} onChange={(e) => change('company', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} placeholder="ethan@example.com" value={form.email || ''} onChange={(e) => change('email', e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input type="tel" className={inputClass} placeholder="+1 555 123 4567" value={form.phone || ''} onChange={(e) => change('phone', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelClass}>How we know them</label>
            <input type="text" className={inputClass} placeholder="College friend, former client, etc." value={form.relationship || ''} onChange={(e) => change('relationship', e.target.value)} />
          </div>

          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">🎁 Thank-you / Gift info</p>
            <div className="space-y-3">
              <div>
                <label className={labelClass}>Mailing address (for baskets/gifts)</label>
                <textarea rows={2} className={inputClass} placeholder="123 Main St, Suite 4&#10;Austin, TX 78701" value={form.mailingAddress || ''} onChange={(e) => change('mailingAddress', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Gift notes</label>
                  <input type="text" className={inputClass} placeholder="Likes red wine, has 2 kids" value={form.giftNotes || ''} onChange={(e) => change('giftNotes', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Last thank-you sent</label>
                  <input type="date" className={inputClass} value={form.lastThankYouSent ? String(form.lastThankYouSent).split('T')[0] : ''} onChange={(e) => change('lastThankYouSent', e.target.value ? new Date(e.target.value).toISOString() : null)} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Notes</label>
            <textarea rows={3} className={inputClass} placeholder="Context, what they typically refer, etc." value={form.notes || ''} onChange={(e) => change('notes', e.target.value)} />
          </div>
        </form>

        <div className="px-5 py-3 border-t border-slate-100 flex justify-between items-center gap-2">
          <div>
            {initialData && onDelete && (
              <button onClick={remove} disabled={isSaving} className="px-3 py-1.5 rounded-md text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50">
                Delete
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
            <button onClick={submit} disabled={isSaving} className="px-4 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
