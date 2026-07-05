import { ReferralPartner } from '../types';

const API_URL = '/api/referral-partners';

export const referralPartnerService = {
  getAll: async (): Promise<ReferralPartner[]> => {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error('Failed to fetch referral partners');
    return res.json();
  },

  create: async (partner: Partial<ReferralPartner>): Promise<ReferralPartner> => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partner),
    });
    if (!res.ok) throw new Error('Failed to create referral partner');
    return res.json();
  },

  update: async (id: number, updates: Partial<ReferralPartner>): Promise<ReferralPartner> => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update referral partner');
    return res.json();
  },

  delete: async (id: number): Promise<void> => {
    const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete referral partner');
  },
};
