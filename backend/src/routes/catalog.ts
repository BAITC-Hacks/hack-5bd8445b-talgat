import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound } from '../lib/http.js';
import { fieldsOf, loadTask, taskInclude, toTaskDTO } from '../lib/tasks.js';
import { evaluate, type LevelId } from '../scoring/scoring.js';

export const catalogRouter = Router();

const LEVEL_IDS = ['DRAFT', 'WORKING', 'READY', 'PRIORITY'] as const;

const QuerySchema = z.object({
  sort: z.enum(['score', 'new']).default('score'),
  levels: z.string().optional(),
  topics: z.string().optional(),
});

const list = (value?: string) => (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);

/**
 * Общий каталог: все опубликованные задачи, низкий рейтинг задачу не скрывает.
 * Место считается по всему каталогу, фильтры его не меняют.
 */
catalogRouter.get('/', async (req, res) => {
  const q = QuerySchema.parse(req.query);
  const levels = list(q.levels).filter((l): l is LevelId => (LEVEL_IDS as readonly string[]).includes(l));
  const topics = list(q.topics);

  const all = await prisma.task.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ score: 'desc' }, { publishedAt: 'asc' }],
    include: taskInclude,
  });
  const rankOf = new Map(all.map((t, i) => [t.id, i + 1]));
  const now = Date.now();

  let items = all.filter((t) => (!levels.length || levels.includes(t.readinessLevel)) && (!topics.length || topics.includes(t.topic)));
  if (q.sort === 'new') items = [...items].sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0));

  const counts = {
    levels: Object.fromEntries(LEVEL_IDS.map((l) => [l, all.filter((t) => t.readinessLevel === l).length])),
    topics: all.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.topic]: (acc[t.topic] ?? 0) + 1 }), {}),
  };

  res.json({
    total: all.length,
    counts,
    items: items.map((t) => {
      const ev = evaluate(fieldsOf(t));
      const events = t.scoreEvents;
      const last = events.at(-1);
      const prev = events.length > 1 ? events.at(-2) : undefined;
      return {
        id: t.id,
        title: t.title,
        topic: t.topic,
        need: t.need || t.context,
        business: t.business,
        score: t.score,
        level: ev.level,
        rank: rankOf.get(t.id) ?? 0,
        points: ev.criteria.map((c) => ({ id: c.id, short: c.short, earned: c.earned, max: c.max })),
        missing: ev.missing.map((m) => m.label),
        proposalsCount: t._count.proposals,
        publishedAt: t.publishedAt,
        isNew: t.publishedAt ? now - t.publishedAt.getTime() < 1000 * 60 * 60 * 24 : false,
        delta: last && prev ? last.score - prev.score : null,
      };
    }),
  });
});

catalogRouter.get('/:id', async (req, res) => {
  const task = await loadTask(req.params.id);
  if (!task || task.status !== 'PUBLISHED') throw notFound('Задача');
  res.json(await toTaskDTO(task));
});

