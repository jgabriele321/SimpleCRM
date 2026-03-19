"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const app = (0, express_1.default)();
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 3003;
const isProduction = process.env.NODE_ENV === 'production';
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static files in production
if (isProduction) {
    app.use(express_1.default.static(path_1.default.join(__dirname, '../dist')));
}
// Helpers
const normalizeStage = (stage) => {
    if (!stage)
        return 'signal';
    if (stage === 'lead')
        return 'signal';
    if (stage === 'contacted')
        return 'active_convo';
    if (stage === 'proposal')
        return 'proposal_sent';
    if (stage === 'negotiation')
        return 'verbal_yes';
    return stage;
};
const parseTags = (deal) => ({
    ...deal,
    stage: normalizeStage(deal.stage),
    tags: deal.tags ? JSON.parse(deal.tags) : []
});
const serializeTags = (data) => ({
    ...data,
    stage: normalizeStage(data.stage),
    tags: data.tags ? JSON.stringify(data.tags) : '[]'
});
// Routes
app.get('/api/deals', async (req, res) => {
    try {
        const deals = await prisma.deal.findMany({
            orderBy: { updatedAt: 'desc' }
        });
        res.json(deals.map(parseTags));
    }
    catch (error) {
        console.error('Error fetching deals:', error);
        res.status(500).json({ error: 'Failed to fetch deals' });
    }
});
app.post('/api/deals', async (req, res) => {
    try {
        const data = serializeTags(req.body);
        const deal = await prisma.deal.create({ data });
        res.json(parseTags(deal));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create deal' });
    }
});
app.put('/api/deals/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const currentDeal = await prisma.deal.findUnique({
            where: { id: Number(id) }
        });
        if (!currentDeal) {
            res.status(404).json({ error: 'Deal not found' });
            return;
        }
        const data = serializeTags(req.body);
        delete data.stageChangedAt;
        if (typeof req.body.stage === 'string' && req.body.stage !== currentDeal.stage) {
            data.stageChangedAt = new Date();
        }
        const deal = await prisma.deal.update({
            where: { id: Number(id) },
            data
        });
        res.json(parseTags(deal));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update deal' });
    }
});
app.patch('/api/deals/:id/target', async (req, res) => {
    const { id } = req.params;
    try {
        const deal = await prisma.deal.findUnique({ where: { id: Number(id) } });
        if (!deal) {
            res.status(404).json({ error: 'Deal not found' });
            return;
        }
        const updated = await prisma.deal.update({
            where: { id: Number(id) },
            data: { isTargeted: !deal.isTargeted }
        });
        res.json(parseTags(updated));
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to toggle target' });
    }
});
const MUTABLE_FIELDS = new Set([
    'title', 'personName', 'companyName', 'stage', 'tags', 'priority',
    'expectedValue', 'closeProbability', 'expectedCloseDate', 'lastContactDate',
    'nextActionDate', 'nextAction', 'gatekeeperName', 'gatekeeperLastContacted',
    'lossReason', 'isGatekept', 'isTargeted', 'notes',
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
        const where = {};
        if (typeof stage === 'string' && stage.length > 0) {
            const stages = stage.split(',').map(s => normalizeStage(s.trim()));
            where.stage = { in: stages };
        }
        const deals = await prisma.deal.findMany({ where, orderBy: { updatedAt: 'desc' } });
        let parsed = deals.map(parseTags);
        if (typeof search === 'string' && search.length > 0) {
            const q = search.toLowerCase();
            parsed = parsed.filter((d) => (d.title || '').toLowerCase().includes(q) ||
                (d.personName || '').toLowerCase().includes(q) ||
                (d.companyName || '').toLowerCase().includes(q));
        }
        const stageCounts = {};
        const allDeals = await prisma.deal.findMany();
        allDeals.forEach(d => {
            const s = normalizeStage(d.stage);
            stageCounts[s] = (stageCounts[s] || 0) + 1;
        });
        const activePipeline = allDeals.filter(d => !['closed_won', 'closed_lost', 'nurture'].includes(normalizeStage(d.stage)));
        const totalPipelineValue = activePipeline.reduce((sum, d) => sum + (d.expectedValue || 0), 0);
        const proposalsOut = allDeals.filter(d => {
            const s = normalizeStage(d.stage);
            return s === 'proposal_sent' || s === 'verbal_yes';
        }).length;
        res.json({
            totalDeals: allDeals.length,
            returnedDeals: parsed.length,
            proposalsOut,
            totalPipelineValue,
            stageCounts,
            deals: parsed
        });
    }
    catch (error) {
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
    const applied = [];
    const skipped = [];
    const ambiguous = [];
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
        let matches;
        try {
            if (item.match.id !== undefined) {
                const deal = await prisma.deal.findUnique({ where: { id: Number(item.match.id) } });
                matches = deal ? [deal] : [];
            }
            else if (item.match.title) {
                matches = await prisma.deal.findMany({
                    where: { title: { contains: item.match.title } }
                });
            }
            else {
                skipped.push({ match: item.match, reason: 'no_valid_match_key' });
                continue;
            }
        }
        catch {
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
        const updateData = {};
        const fieldsUpdated = [];
        for (const [key, value] of Object.entries(item.set)) {
            if (DATE_FIELDS.has(key) && typeof value === 'string') {
                updateData[key] = new Date(value);
            }
            else if (key === 'tags' && Array.isArray(value)) {
                updateData[key] = JSON.stringify(value);
            }
            else if (key === 'stage' && typeof value === 'string') {
                updateData[key] = normalizeStage(value);
            }
            else {
                updateData[key] = value;
            }
            fieldsUpdated.push(key);
        }
        if (updateData.stage && updateData.stage !== deal.stage) {
            updateData.stageChangedAt = new Date();
        }
        try {
            await prisma.deal.update({ where: { id: deal.id }, data: updateData });
            applied.push({ id: deal.id, title: deal.title, fieldsUpdated });
        }
        catch (err) {
            skipped.push({ match: item.match, reason: 'update_failed' });
        }
    }
    res.json({ success: true, applied, skipped, ambiguous });
});
app.delete('/api/deals/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.deal.delete({ where: { id: Number(id) } });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete deal' });
    }
});
// Serve React app for all non-API routes in production
if (isProduction) {
    app.get('*', (req, res) => {
        res.sendFile(path_1.default.join(__dirname, '../dist/index.html'));
    });
}
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
});
