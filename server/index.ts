import 'dotenv/config';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import path from 'path';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3003;
const isProduction = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// Serve static files in production
if (isProduction) {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// Helpers
const normalizeStage = (stage?: string) => {
  if (!stage) return 'signal';
  if (stage === 'lead') return 'signal';
  if (stage === 'contacted') return 'active_convo';
  if (stage === 'proposal') return 'proposal_sent';
  if (stage === 'negotiation') return 'verbal_yes';
  return stage;
};

const parseTags = (deal: any) => ({
  ...deal,
  stage: normalizeStage(deal.stage),
  tags: deal.tags ? JSON.parse(deal.tags) : []
});

const serializeTags = (data: any) => ({
  ...data,
  stage: normalizeStage(data.stage),
  tags: data.tags ? JSON.stringify(data.tags) : '[]'
});

// Normalize the referral-partner link on an incoming deal payload: drop the
// nested relation object (not a column) and coerce the id to a number or null.
const coerceReferral = (data: any) => {
  delete data.referralPartner;
  if (data.referralPartnerId === '' || data.referralPartnerId === undefined || data.referralPartnerId === null) {
    data.referralPartnerId = null;
  } else {
    const n = Number(data.referralPartnerId);
    data.referralPartnerId = Number.isFinite(n) ? n : null;
  }
  return data;
};

// Map the Caddy-authenticated basic-auth username (forwarded as X-CRM-User)
// to the deal owner label used for Johnny/Joe attribution & filtering.
const OWNER_MAP: Record<string, string> = {
  Jgabriele321: 'Johnny',
  Joe: 'Joe',
  Hunter: 'Hunter',
};
// Read the Caddy-forwarded basic-auth username. Crucially, ignore an unresolved
// Caddy placeholder ("{http.auth.user.id}"), which is forwarded verbatim when a
// request skipped basic-auth (e.g. Bearer automation). That is NOT a real user
// and must not count as a logged-in session.
const crmUser = (req: any): string => {
  const u = (req.headers['x-crm-user'] || '').toString().trim();
  return u.startsWith('{') ? '' : u;
};

const resolveOwner = (req: any): string => {
  const user = crmUser(req);
  if (!user) return 'Johnny';
  return OWNER_MAP[user] || user;
};

// Writes are authorized either by a valid Bearer token (automation, e.g. COSTA)
// or by having passed Caddy basic-auth (which forwards a real X-CRM-User). This
// keeps a Bearer check on the app side even though Caddy lets Bearer requests
// skip basic-auth, so a bogus Bearer can't write.
const writeAuthorized = (req: any): boolean => {
  const secret = process.env.CRM_API_SECRET;
  const auth = req.headers.authorization;
  if (secret && auth === `Bearer ${secret}`) return true;
  return crmUser(req).length > 0;
};

// Routes
app.get('/api/deals', async (req, res) => {
  try {
    const deals = await prisma.deal.findMany({
      orderBy: { updatedAt: 'desc' }
    });
    res.json(deals.map(parseTags));
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Failed to fetch deals' });
  }
});

app.post('/api/deals', async (req, res) => {
  if (!writeAuthorized(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const data: any = serializeTags(req.body);
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    delete data.proposalSentAt;
    delete data.stageChangedAt;
    coerceReferral(data);
    // Owner is the creator (from auth), not client-supplied.
    data.owner = resolveOwner(req);
    const st = normalizeStage(data.stage);
    if (st === 'proposal_sent') {
      data.proposalSentAt = new Date();
    }
    const deal = await prisma.deal.create({ data });
    res.json(parseTags(deal));
  } catch (error) {
    res.status(500).json({ error: 'Failed to create deal' });
  }
});

app.put('/api/deals/:id', async (req, res) => {
  if (!writeAuthorized(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { id } = req.params;
  try {
    const currentDeal = await prisma.deal.findUnique({
      where: { id: Number(id) }
    });

    if (!currentDeal) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    const data: any = serializeTags(req.body);
    delete data.stageChangedAt;
    delete data.proposalSentAt;
    delete data.owner; // owner is set at creation and stays with the creator
    coerceReferral(data);

    const newStage = normalizeStage(
      typeof req.body.stage === 'string' ? req.body.stage : currentDeal.stage
    );
    const oldStage = normalizeStage(currentDeal.stage);
    if (typeof req.body.stage === 'string' && req.body.stage !== currentDeal.stage) {
      data.stageChangedAt = new Date();
    }
    if (newStage === 'proposal_sent' && oldStage !== 'proposal_sent') {
      data.proposalSentAt = new Date();
    }

    const deal = await prisma.deal.update({
      where: { id: Number(id) },
      data
    });
    res.json(parseTags(deal));
  } catch (error) {
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

app.patch('/api/deals/:id/target', async (req, res) => {
  if (!writeAuthorized(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { id } = req.params;
  try {
    const deal = await prisma.deal.findUnique({ where: { id: Number(id) } });
    if (!deal) { res.status(404).json({ error: 'Deal not found' }); return; }
    const updated = await prisma.deal.update({
      where: { id: Number(id) },
      data: { isTargeted: !deal.isTargeted }
    });
    res.json(parseTags(updated));
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle target' });
  }
});

const MUTABLE_FIELDS = new Set([
  'title', 'personName', 'companyName', 'email', 'phone', 'stage', 'tags', 'priority',
  'expectedValue', 'closeProbability', 'expectedCloseDate', 'lastContactDate',
  'nextActionDate', 'nextAction', 'gatekeeperName', 'gatekeeperLastContacted',
  'lossReason', 'isGatekept', 'isTargeted', 'notes', 'referralPartnerId',
]);

const DATE_FIELDS = new Set([
  'expectedCloseDate', 'lastContactDate', 'nextActionDate', 'gatekeeperLastContacted',
]);

const CRM_SECRET = process.env.CRM_API_SECRET;

app.get('/api/deals/export', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!CRM_SECRET || !authHeader || authHeader !== `Bearer ${CRM_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const { stage, search } = req.query;
    const where: any = {};

    if (typeof stage === 'string' && stage.length > 0) {
      const stages = stage.split(',').map(s => normalizeStage(s.trim()));
      where.stage = { in: stages };
    }

    const deals = await prisma.deal.findMany({ where, orderBy: { updatedAt: 'desc' } });
    let parsed = deals.map(parseTags);

    if (typeof search === 'string' && search.length > 0) {
      const q = search.toLowerCase();
      parsed = parsed.filter((d: any) =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.personName || '').toLowerCase().includes(q) ||
        (d.companyName || '').toLowerCase().includes(q)
      );
    }

    const stageCounts: Record<string, number> = {};
    const allDeals = await prisma.deal.findMany();
    allDeals.forEach(d => {
      const s = normalizeStage(d.stage);
      stageCounts[s] = (stageCounts[s] || 0) + 1;
    });

    const activePipeline = allDeals.filter(d => !['closed_won', 'closed_lost', 'nurture'].includes(normalizeStage(d.stage)));
    const totalPipelineValue = activePipeline.reduce((sum, d) => sum + (d.expectedValue || 0), 0);
    const proposalsOut = allDeals.filter(d => normalizeStage(d.stage) === 'proposal_sent').length;

    res.json({
      totalDeals: allDeals.length,
      returnedDeals: parsed.length,
      proposalsOut,
      totalPipelineValue,
      stageCounts,
      deals: parsed
    });
  } catch (error) {
    console.error('Error exporting deals:', error);
    res.status(500).json({ error: 'Failed to export deals' });
  }
});

app.post('/api/deals/batch-update', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!CRM_SECRET || !authHeader || authHeader !== `Bearer ${CRM_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const { updates } = req.body;
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 25) {
    res.status(400).json({ error: 'updates must be an array of 1-25 items' });
    return;
  }

  const applied: { id: number; title: string; fieldsUpdated: string[] }[] = [];
  const skipped: { match: any; reason: string }[] = [];
  const ambiguous: { match: any; reason: string; count: number }[] = [];

  for (const item of updates) {
    if (!item.match || !item.set || typeof item.match !== 'object' || typeof item.set !== 'object') {
      skipped.push({ match: item.match || null, reason: 'invalid_format' });
      continue;
    }

    const invalidFields = Object.keys(item.set).filter(k => !MUTABLE_FIELDS.has(k));
    if (invalidFields.length > 0) {
      skipped.push({ match: item.match, reason: `unknown_fields: ${invalidFields.join(', ')}` });
      continue;
    }

    let matches: any[];
    try {
      if (item.match.id !== undefined) {
        const deal = await prisma.deal.findUnique({ where: { id: Number(item.match.id) } });
        matches = deal ? [deal] : [];
      } else if (item.match.title) {
        matches = await prisma.deal.findMany({
          where: { title: { contains: item.match.title } }
        });
      } else {
        skipped.push({ match: item.match, reason: 'no_valid_match_key' });
        continue;
      }
    } catch {
      skipped.push({ match: item.match, reason: 'match_query_failed' });
      continue;
    }

    if (matches.length === 0) {
      skipped.push({ match: item.match, reason: 'no_match' });
      continue;
    }
    if (matches.length > 1) {
      ambiguous.push({ match: item.match, reason: 'multiple_matches', count: matches.length });
      continue;
    }

    const deal = matches[0];
    const updateData: any = {};
    const fieldsUpdated: string[] = [];

    for (const [key, value] of Object.entries(item.set)) {
      if (DATE_FIELDS.has(key) && typeof value === 'string') {
        updateData[key] = new Date(value);
      } else if (key === 'tags' && Array.isArray(value)) {
        updateData[key] = JSON.stringify(value);
      } else if (key === 'stage' && typeof value === 'string') {
        updateData[key] = normalizeStage(value);
      } else if (key === 'referralPartnerId') {
        const n = Number(value);
        updateData[key] = (value === null || value === '' || !Number.isFinite(n)) ? null : n;
      } else {
        updateData[key] = value;
      }
      fieldsUpdated.push(key);
    }

    if (updateData.stage && updateData.stage !== deal.stage) {
      updateData.stageChangedAt = new Date();
    }
    const newSt = updateData.stage ? normalizeStage(updateData.stage as string) : normalizeStage(deal.stage);
    const oldSt = normalizeStage(deal.stage);
    if (newSt === 'proposal_sent' && oldSt !== 'proposal_sent') {
      updateData.proposalSentAt = new Date();
    }

    try {
      await prisma.deal.update({ where: { id: deal.id }, data: updateData });
      applied.push({ id: deal.id, title: deal.title, fieldsUpdated });
    } catch (err) {
      skipped.push({ match: item.match, reason: 'update_failed' });
    }
  }

  res.json({ success: true, applied, skipped, ambiguous });
});

app.delete('/api/deals/:id', async (req, res) => {
  if (!writeAuthorized(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const { id } = req.params;
  try {
    await prisma.deal.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete deal' });
  }
});

// ---- Referral Partners (people who send us clients) ----

const PARTNER_DATE_FIELDS = new Set(['lastThankYouSent']);

// Keep only real ReferralPartner columns and coerce date fields.
const cleanPartner = (body: any) => {
  const allowed = ['name', 'company', 'email', 'phone', 'mailingAddress', 'relationship', 'giftNotes', 'notes', 'lastThankYouSent'];
  const out: any = {};
  for (const key of allowed) {
    if (body[key] === undefined) continue;
    if (PARTNER_DATE_FIELDS.has(key)) {
      out[key] = body[key] ? new Date(body[key]) : null;
    } else {
      out[key] = body[key];
    }
  }
  return out;
};

// Per-partner referral stats computed from linked deals.
const partnerStats = (deals: any[]) => {
  const s: Record<number, { dealCount: number; wonCount: number; openCount: number; totalValue: number; wonValue: number }> = {};
  for (const d of deals) {
    const pid = d.referralPartnerId;
    if (pid == null) continue;
    if (!s[pid]) s[pid] = { dealCount: 0, wonCount: 0, openCount: 0, totalValue: 0, wonValue: 0 };
    const st = normalizeStage(d.stage);
    s[pid].dealCount++;
    s[pid].totalValue += d.expectedValue || 0;
    if (st === 'closed_won') { s[pid].wonCount++; s[pid].wonValue += d.expectedValue || 0; }
    else if (st !== 'closed_lost') { s[pid].openCount++; }
  }
  return s;
};

app.get('/api/referral-partners', async (_req, res) => {
  try {
    const [partners, deals] = await Promise.all([
      prisma.referralPartner.findMany({ orderBy: { name: 'asc' } }),
      prisma.deal.findMany({ where: { referralPartnerId: { not: null } } }),
    ]);
    const stats = partnerStats(deals);
    const empty = { dealCount: 0, wonCount: 0, openCount: 0, totalValue: 0, wonValue: 0 };
    res.json(partners.map(p => ({ ...p, stats: stats[p.id] || empty })));
  } catch (error) {
    console.error('Error fetching referral partners:', error);
    res.status(500).json({ error: 'Failed to fetch referral partners' });
  }
});

app.get('/api/referral-partners/:id', async (req, res) => {
  try {
    const partner = await prisma.referralPartner.findUnique({
      where: { id: Number(req.params.id) },
      include: { deals: { orderBy: { updatedAt: 'desc' } } },
    });
    if (!partner) { res.status(404).json({ error: 'Referral partner not found' }); return; }
    res.json({ ...partner, deals: partner.deals.map(parseTags) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch referral partner' });
  }
});

app.post('/api/referral-partners', async (req, res) => {
  if (!writeAuthorized(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const data = cleanPartner(req.body);
    if (!data.name || !String(data.name).trim()) { res.status(400).json({ error: 'name is required' }); return; }
    const partner = await prisma.referralPartner.create({ data });
    res.json(partner);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create referral partner' });
  }
});

app.put('/api/referral-partners/:id', async (req, res) => {
  if (!writeAuthorized(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const data = cleanPartner(req.body);
    const partner = await prisma.referralPartner.update({ where: { id: Number(req.params.id) }, data });
    res.json(partner);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update referral partner' });
  }
});

app.delete('/api/referral-partners/:id', async (req, res) => {
  if (!writeAuthorized(req)) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    // Linked deals keep their history; referralPartnerId is set NULL by the FK.
    await prisma.referralPartner.delete({ where: { id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete referral partner' });
  }
});

// Serve React app for all non-API routes in production
if (isProduction) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
});