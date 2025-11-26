export type Stage = 
  | 'lead'
  | 'contacted'
  | 'active_convo'
  | 'proposal_sent'
  | 'verbal_yes'
  | 'closed_won'
  | 'closed_lost';

export type Priority = 'low' | 'medium' | 'high';

export interface Deal {
  id: string | number;
  title: string;
  personName?: string;
  companyName?: string;
  stage: Stage;
  tags: string[]; // Stored as JSON string in DB, array here
  priority: Priority;
  expectedValue: number;
  closeProbability: number; // 0-100
  expectedCloseDate?: string; // ISO date string
  lastContactDate?: string; // ISO date string
  nextActionDate?: string; // ISO date string
  nextAction?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterState {
  search: string;
  stages: Stage[];
  priorities: Priority[];
  tags: string[];
  hideClosed: boolean;
}

export const STAGE_LABELS: Record<Stage, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  active_convo: 'Active Conversation',
  proposal_sent: 'Proposal Sent',
  verbal_yes: 'Verbal Yes',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

export const STAGE_COLORS: Record<Stage, string> = {
  lead: 'bg-slate-100 text-slate-700 border-slate-200',
  contacted: 'bg-blue-50 text-blue-700 border-blue-200',
  active_convo: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  proposal_sent: 'bg-purple-50 text-purple-700 border-purple-200',
  verbal_yes: 'bg-lime-50 text-lime-700 border-lime-200',
  closed_won: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  closed_lost: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'text-slate-500 bg-slate-100',
  medium: 'text-amber-600 bg-amber-50',
  high: 'text-rose-600 bg-rose-50 font-bold',
};