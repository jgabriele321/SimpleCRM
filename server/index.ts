import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Helpers
const parseTags = (deal: any) => ({
  ...deal,
  tags: deal.tags ? JSON.parse(deal.tags) : []
});

const serializeTags = (data: any) => ({
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
  } catch (error) {
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
    const data = serializeTags(req.body);
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});