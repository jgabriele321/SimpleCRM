import { Deal, normalizeStage } from '../types';

// TOGGLE THIS TO SWITCH BETWEEN LOCAL STORAGE DEMO AND REAL BACKEND
const USE_LOCAL_STORAGE = false;
const STORAGE_KEY = 'prism_crm_deals';
const API_URL = '/api/deals';

// Start with empty data - no sample deals
const MOCK_DATA: Deal[] = [];

// Helper to simulate delay for realism
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const dealService = {
  getAll: async (): Promise<Deal[]> => {
    if (USE_LOCAL_STORAGE) {
      await delay(300);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_DATA));
        return MOCK_DATA;
      }
      return JSON.parse(stored).map((deal: Deal) => ({
        ...deal,
        stage: normalizeStage(deal.stage)
      }));
    } else {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch deals');
      const deals = await res.json();
      return deals.map((deal: Deal) => ({
        ...deal,
        stage: normalizeStage(deal.stage)
      }));
    }
  },

  create: async (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>): Promise<Deal> => {
    if (USE_LOCAL_STORAGE) {
      await delay(400);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const newDeal: Deal = {
        ...deal,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [newDeal, ...stored];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return newDeal;
    } else {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deal),
      });
      if (!res.ok) throw new Error('Failed to create deal');
      return res.json();
    }
  },

  update: async (id: string | number, updates: Partial<Deal>): Promise<Deal> => {
    if (USE_LOCAL_STORAGE) {
      await delay(300);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const index = stored.findIndex((d: Deal) => d.id.toString() === id.toString());
      if (index === -1) throw new Error('Deal not found');
      
      const updatedDeal = { ...stored[index], ...updates, updatedAt: new Date().toISOString() };
      stored[index] = updatedDeal;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      return updatedDeal;
    } else {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update deal');
      return res.json();
    }
  },

  toggleTarget: async (id: string | number): Promise<Deal> => {
    if (USE_LOCAL_STORAGE) {
      await delay(200);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const index = stored.findIndex((d: Deal) => d.id.toString() === id.toString());
      if (index === -1) throw new Error('Deal not found');
      stored[index].isTargeted = !stored[index].isTargeted;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
      return stored[index];
    } else {
      const res = await fetch(`${API_URL}/${id}/target`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to toggle target');
      return res.json();
    }
  },

  delete: async (id: string | number): Promise<void> => {
    if (USE_LOCAL_STORAGE) {
      await delay(300);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      const filtered = stored.filter((d: Deal) => d.id.toString() !== id.toString());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } else {
      const res = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete deal');
    }
  },
};