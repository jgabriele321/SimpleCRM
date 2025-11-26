import { Deal, Stage } from '../types';

// TOGGLE THIS TO SWITCH BETWEEN LOCAL STORAGE DEMO AND REAL BACKEND
const USE_LOCAL_STORAGE = true;
const STORAGE_KEY = 'prism_crm_deals';
const API_URL = '/api/deals';

const MOCK_DATA: Deal[] = [
  {
    id: '1',
    title: 'Enterprise License - Acme Corp',
    personName: 'Alice Johnson',
    companyName: 'Acme Corp',
    stage: 'active_convo',
    tags: ['enterprise', 'saas', 'Q3'],
    priority: 'high',
    expectedValue: 50000,
    closeProbability: 60,
    nextAction: 'Send technical specs',
    nextActionDate: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days
    lastContactDate: new Date(Date.now() - 86400000 * 5).toISOString(),
    notes: 'They are very interested in the SSO features. Need to confirm compliance requirements.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Startup Plan - Beta Inc',
    personName: 'Bob Smith',
    companyName: 'Beta Inc',
    stage: 'proposal_sent',
    tags: ['inbound', 'startup'],
    priority: 'medium',
    expectedValue: 5000,
    closeProbability: 80,
    nextAction: 'Follow up on proposal',
    nextActionDate: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Consulting Project - Gamma',
    companyName: 'Gamma Group',
    stage: 'lead',
    tags: ['consulting'],
    priority: 'low',
    expectedValue: 12000,
    closeProbability: 20,
    nextAction: 'Initial outreach',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Legacy Contract Renewal',
    stage: 'closed_won',
    tags: ['renewal'],
    priority: 'high',
    expectedValue: 25000,
    closeProbability: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

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
      return JSON.parse(stored);
    } else {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch deals');
      return res.json();
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