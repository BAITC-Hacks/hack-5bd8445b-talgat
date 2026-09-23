import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound, parseBody } from '../lib/http.js';
import { catalogOrder, placeIn } from '../lib/tasks.js';
import { levelOf } from '../scoring/scoring.js';

export const businessesRouter = Router();

const ProfileSchema = z.object({
  name: z.string().trim().min(2, 'Название — от 2 символов').max(120),
  industry: z.string().trim().max(60).default(''),
  city: z.string().trim().max(60).default(''),
  contact: z.string().trim().max(160).default(''),
  email: z.union([z.literal(''), z.string().trim().email('Некорректная почта')]).default(''),
});

businessesRouter.get('/', async (_req, res) => {
  res.json(await prisma.business.findMany({ orderBy: { createdAt: 'asc' } }));
});

businessesRouter.get('/:id', async (req, res) => {
  const business = await prisma.business.findUnique({ where: { id: req.params.id } });
  if (!business) throw notFound('Компания');
  res.json(business);
});

businessesRouter.patch('/:id', async (req, res) => {
  const data = parseBody(ProfileSchema, req.body);
  res.json(await prisma.business.update({ where: { id: req.params.id }, data }));
});

/** Задачи компании с уровнем готовности, местом и откликами, ждущими решения */
businessesRouter.get('/:id/tasks', async (req, res) => {
  const business = await prisma.business.findUnique({ where: { id: req.params.id } });
  if (!business) throw notFound('Компания');
  const [tasks, order] = await Promise.all([
    prisma.task.findMany({
      where: { businessId: business.id },
      orderBy: [{ status: 'desc' }, { updatedAt: 'desc' }],
      include: { proposals: { select: { teamId: true } }, selections: { select: { teamId: true, status: true } } },
    }),
    catalogOrder(),
  ]);
  res.json(
    tasks.map((t) => {
      const teams = new Set(t.proposals.map((p) => p.teamId));
      const decided = new Set(t.selections.map((s) => s.teamId));
      return {
        id: t.id,
        title: t.title || t.rawDraft.slice(0, 80),
        topic: t.topic,
        status: t.status,
        score: t.score,
        level: levelOf(t.score),
        rank: t.status === 'PUBLISHED' ? placeIn(order, t.id, t.score) : null,
        proposalsCount: t.proposals.length,
        pendingTeams: [...teams].filter((id) => !decided.has(id)).length,
        selectedTeams: t.selections.filter((s) => s.status === 'SELECTED').length,
        hasQuestions: Boolean(t.clarification),
        updatedAt: t.updatedAt,
      };
    }),
  );
});
