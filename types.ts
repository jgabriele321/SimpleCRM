export type Stage = 
  | 'signal'
  | 'active_convo'
  | 'ready_for_proposal'
  | 'proposal_sent'
  | 'verbal_yes'
  | 'closed_won'
  | 'closed_lost'
  | 'nurture';

export type Priority = 'low' | 'medium' | 'high';

export interface Deal {
  id: string | number;
  title: string;
  personName?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  stage: Stage;
  tags: string[]; // Stored as JSON string in DB, array here
  priority: Priority;
  expectedValue: number;
  closeProbability: number; // 0-100
  expectedCloseDate?: string; // ISO date string
  lastContactDate?: string; // ISO date string
  nextActionDate?: string; // ISO date string
  nextAction?: string;
  gatekeeperName?: string;
  gatekeeperLastContacted?: string; // ISO date string
  stageChangedAt?: string; // ISO date string
  /** Set when deal transitions into proposal_sent (persists after leaving the stage). */
  proposalSentAt?: string;
  lossReason?: string;
  isGatekept?: boolean;
  notes?: string;
  isTargeted: boolean;
  /** Creator of the deal — "Johnny" or "Joe". Set server-side from login. */
  owner?: string;
  /** Id of the ReferralPartner who sent us this deal (null/undefined if none). */
  referralPartnerId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralPartnerStats {
  dealCount: number;
  wonCount: number;
  openCount: number;
  totalValue: number;
  wonValue: number;
}

export interface ReferralPartner {
  id: number;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  /** Mailing address — for thank-you gifts / Christmas baskets. */
  mailingAddress?: string;
  /** How we know them. */
  relationship?: string;
  /** Gift hints, e.g. "likes red wine", "kosher", "has 2 kids". */
  giftNotes?: string;
  notes?: string;
  /** Last time we sent a thank-you / gift. */
  lastThankYouSent?: string | null;
  /** Computed referral stats (present on the list endpoint). */
  stats?: ReferralPartnerStats;
  createdAt?: string;
  updatedAt?: string;
}

export interface FilterState {
  search: string;
  stages: Stage[];
  priorities: Priority[];
  tags: string[];
  owners: string[];
  hideClosed: boolean;
}

export const OWNER_COLORS: Record<string, string> = {
  Johnny: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Joe: 'bg-teal-50 text-teal-700 border-teal-200',
};

export const STAGE_LABELS: Record<Stage, string> = {
  signal: 'Signal / Early Lead',
  active_convo: 'Active Conversation',
  ready_for_proposal: 'Ready for Proposal',
  proposal_sent: 'Proposal Out',
  verbal_yes: 'Verbal Yes / Awaiting Start',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
  nurture: 'Nurture',
};

export const STAGE_COLORS: Record<Stage, string> = {
  signal: 'bg-slate-100 text-slate-700 border-slate-200',
  active_convo: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  ready_for_proposal: 'bg-violet-50 text-violet-700 border-violet-200',
  proposal_sent: 'bg-purple-50 text-purple-700 border-purple-200',
  verbal_yes: 'bg-lime-50 text-lime-700 border-lime-200',
  closed_won: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  closed_lost: 'bg-rose-50 text-rose-700 border-rose-200',
  nurture: 'bg-amber-50 text-amber-700 border-amber-200',
};

export const normalizeStage = (stage?: string): Stage => {
  switch (stage) {
    case 'lead':
      return 'signal';
    case 'contacted':
      return 'active_convo';
    case 'proposal':
      return 'proposal_sent';
    case 'negotiation':
      return 'verbal_yes';
    case 'signal':
    case 'active_convo':
    case 'ready_for_proposal':
    case 'proposal_sent':
    case 'verbal_yes':
    case 'closed_won':
    case 'closed_lost':
    case 'nurture':
      return stage;
    default:
      return 'signal';
  }
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'text-slate-500 bg-slate-100',
  medium: 'text-amber-600 bg-amber-50',
  high: 'text-rose-600 bg-rose-50 font-bold',
};