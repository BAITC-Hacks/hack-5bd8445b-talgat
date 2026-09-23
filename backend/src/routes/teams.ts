import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound, parseBody } from '../lib/http.js';
import { recommendTasks } from '../lib/recommend.js';

export const teamsRouter = Router();

const tags = z.array(z.string().trim().min(1).max(40)).max(20, 'Не больше 20 пунктов');

const ProfileSchema = z.object({
  name: z.string().trim().min(2, 'Название — от 2 символов').max(80),
  members: z.coerce.number().int().min(1).max(20),
  interests: tags,
  skills: tags,
  stack: tags,
});

teamsRouter.get('/', async (_req, res) => {
  res.json(await prisma.teamProfile.findMany({ orderBy: { createdAt: 'asc' } }));
});

teamsRouter.get('/:id', async (req, res) => {
  const team = await prisma.teamProfile.findUnique({ where: { id: req.params.id } });
  if (!team) throw notFound('Команда');
  res.json(team);
});

teamsRouter.patch('/:id', async (req, res) => {
  const data = parseBody(ProfileSchema, req.body);
  res.json(await prisma.teamProfile.update({ where: { id: req.params.id }, data }));
});

/** Подсказка: задачи, похожие на интересы и навыки команды. Каталог она не ограничивает */
teamsRouter.get('/:id/recommendations', async (req, res) => {
  const team = await prisma.teamProfile.findUnique({ where: { id: req.params.id } });
  if (!team) throw notFound('Команда');
  res.json(await recommendTasks(team));
});

/** Отклики команды и решения бизнеса по ним */
teamsRouter.get('/:id/proposals', async (req, res) => {
  const team = await prisma.teamProfile.findUnique({ where: { id: req.params.id } });
  if (!team) throw notFound('Команда');
  const [proposals, selections] = await Promise.all([
    prisma.proposal.findMany({
      where: { teamId: team.id },
      orderBy: { createdAt: 'desc' },
      include: { task: { select: { id: true, title: true, score: true, business: { select: { name: true } } } } },
    }),
    prisma.selection.findMany({ where: { teamId: team.id } }),
  ]);
  const byTask = new Map(selections.map((s) => [s.taskId, s.status]));
  res.json(
    proposals.map((p) => ({
      id: p.id,
      idea: p.idea,
      deadline: p.deadline,
      createdAt: p.createdAt,
      task: { id: p.task.id, title: p.task.title, score: p.task.score, business: p.task.business.name },
      decision: byTask.get(p.taskId) ?? 'PENDING',
    })),
  );
});
