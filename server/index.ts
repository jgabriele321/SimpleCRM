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
  try {
    const data = serializeTags(req.body);
    const deal = await prisma.deal.create({ data });
    res.json(parseTags(deal));
  } catch (error) {
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
  } catch (error) {
    res.status(500).json({ error: 'Failed to update deal' });
  }
});

app.delete('/api/deals/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.deal.delete({ where: { id: Number(id) } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete deal' });
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