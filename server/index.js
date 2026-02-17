"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
const parseTags = (deal) => ({
    ...deal,
    tags: deal.tags ? JSON.parse(deal.tags) : []
});
const serializeTags = (data) => ({
    ...data,
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
        const data = serializeTags(req.body);
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
