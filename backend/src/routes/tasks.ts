import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { analyzeDraft, previewFields, structureAnswers } from '../ai/service.js';
import type { Clarification } from '../ai/schemas.js';
import { HttpError, notFound, parseBody } from '../lib/http.js';
import { catalogOrder, clarificationOf, fieldsOf, levelIdOf, loadTask, placeIn, taskInclude, toTaskDTO } from '../lib/tasks.js';
import { CARD_FIELDS, evaluate, normalizeFields } from '../scoring/scoring.js';
import { FIELD_LABELS } from '../domain.js';

export const tasksRouter = Router();

const text = (max: number) => z.string().trim().max(max, `Не длиннее ${max} символов`);

const CreateSchema = z.object({
  businessId: z.string().min(1),
  topic: z.string().trim().min(2, 'Выберите отрасль').max(40),
  rawDraft: z.string().trim().min(15, 'Опишите задачу хотя бы одним-двумя предложениями').max(4000, 'Черновик слишком длинный — до 4000 символов'),
});

const ReanalyzeSchema = z.object({
  topic: z.string().trim().min(2).max(40).optional(),
  rawDraft: z.string().trim().min(15, 'Опишите задачу хотя бы одним-двумя предложениями').max(4000).optional(),
});

const AnswersSchema = z.object({
  answers: z.record(z.string(), text(2000)),
});

const FieldsInput = z.object(Object.fromEntries(CARD_FIELDS.map((f) => [f, text(2000)])) as Record<(typeof CARD_FIELDS)[number], ReturnType<typeof text>>);

const ConfirmSchema = z.object({
  title: z.string().trim().min(5, 'Название — не короче 5 символов').max(120, 'Название — до 120 символов'),
  topic: z.string().trim().min(2).max(40),
  fields: FieldsInput,
});

const SelectionSchema = z.object({
  status: z.enum(['SELECTED', 'REJECTED', 'PENDING']),
});

const ProposalSchema = z.object({
  teamId: z.string().min(1),
  idea: z.string().trim().min(10, 'Опишите идею подробнее — от 10 символов').max(2000),
  plan: z.string().trim().min(10, 'Добавьте план — от 10 символов').max(4000),
  deadline: z.string().trim().min(1, 'Укажите срок').max(100),
  prototypeUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === '' || /^https?:\/\/\S+\.\S+/.test(v), 'Ссылка должна начинаться с http:// или https://')
    .default(''),
});

async function requireTask(id: string) {
  const task = await loadTask(id);
  if (!task) throw notFound('Задача');
  return task;
}

/** Черновик → разбор ИИ → уточняющие вопросы */
tasksRouter.post('/', async (req, res) => {
  const body = parseBody(CreateSchema, req.body);
  const business = await prisma.business.findUnique({ where: { id: body.businessId } });
  if (!business) throw notFound('Компания');
  const clarification = await analyzeDraft({ rawDraft: body.rawDraft, topic: body.topic, businessName: business.name, contact: business.contact });
  const created = await prisma.task.create({
    data: {
      businessId: business.id,
      topic: body.topic,
      rawDraft: body.rawDraft,
      title: clarification.extracted.title,
      clarification: clarification as object,
    },
    include: taskInclude,
  });
  res.status(201).json(await toTaskDTO(created, { withClarification: true }));
});

tasksRouter.get('/:id', async (req, res) => {
  res.json(await toTaskDTO(await requireTask(req.params.id), { withClarification: true }));
});

/** «Разобрать заново» — после правки черновика */
tasksRouter.post('/:id/analyze', async (req, res) => {
  const task = await requireTask(req.params.id);
  const body = parseBody(ReanalyzeSchema, req.body);
  const rawDraft = body.rawDraft ?? task.rawDraft;
  const topic = body.topic ?? task.topic;
  const business = await prisma.business.findUniqueOrThrow({ where: { id: task.businessId } });
  const clarification = await analyzeDraft({ rawDraft, topic, businessName: business.name, contact: business.contact });
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { rawDraft, topic, title: task.title || clarification.extracted.title, clarification: clarification as object },
    include: taskInclude,
  });
  res.json(await toTaskDTO(updated, { withClarification: true }));
});

/** Сохранить ответы и вернуть предварительный рейтинг */
tasksRouter.put('/:id/answers', async (req, res) => {
  const task = await requireTask(req.params.id);
  const { answers } = parseBody(AnswersSchema, req.body);
  const clarification = clarificationOf(task);
  if (!clarification) throw new HttpError(409, 'Сначала разберите черновик');
  const next: Clarification = {
    ...clarification,
    questions: clarification.questions.map((q) => (q.id in answers ? { ...q, answer: answers[q.id] } : q)),
  };
  await prisma.task.update({ where: { id: task.id }, data: { clarification: next as object } });
  const fields = previewFields(fieldsOf(task), next);
  const preview = evaluate(fields);
  const order = await catalogOrder();
  res.json({ preview: { total: preview.total, level: preview.level, criteria: preview.criteria, rank: placeIn(order, task.id, preview.total) }, fields });
});

/** ИИ собирает карточку из ответов; результат ждёт подтверждения */
tasksRouter.post('/:id/structure', async (req, res) => {
  const task = await requireTask(req.params.id);
  const clarification = clarificationOf(task);
  if (!clarification) throw new HttpError(409, 'Сначала разберите черновик');
  const proposed = await structureAnswers({ rawDraft: task.rawDraft, topic: task.topic, title: task.title, confirmed: fieldsOf(task), clarification });
  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { clarification: { ...clarification, proposed } as object },
    include: taskInclude,
  });
  res.json(await toTaskDTO(updated, { withClarification: true }));
});

/** Подтверждение карточки человеком: только здесь меняются баллы */
tasksRouter.patch('/:id', async (req, res) => {
  const task = await requireTask(req.params.id);
  const body = parseBody(ConfirmSchema, req.body);
  const fields = normalizeFields(body.fields);
  const before = fieldsOf(task);
  const changed = CARD_FIELDS.filter((f) => before[f] !== fields[f]);
  const ev = evaluate(fields);
  const reason = changed.length === 0
    ? 'Карточка подтверждена без изменений'
    : changed.length > 2
      ? `Подтверждены поля: ${changed.length}`
      : `Подтверждено: ${changed.map((f) => `«${FIELD_LABELS[f]}»`).join(', ')}`;
  const clarification = clarificationOf(task);

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.task.update({
      where: { id: task.id },
      data: {
        ...fields,
        title: body.title,
        topic: body.topic,
        score: ev.total,
        readinessLevel: levelIdOf(ev.total),
        clarification: clarification ? ({ ...clarification, proposed: null } as object) : undefined,
      },
      include: taskInclude,
    });
    if (changed.length > 0 || task.scoreEvents.length === 0) {
      await tx.scoreEvent.create({ data: { taskId: task.id, score: ev.total, level: levelIdOf(ev.total), reason } });
    }
    return saved;
  });
  res.json(await toTaskDTO((await loadTask(updated.id))!, { withClarification: true }));
});

/** Публикация подтверждённой версии в общий каталог */
tasksRouter.post('/:id/publish', async (req, res) => {
  const task = await requireTask(req.params.id);
  if (!task.title.trim()) throw new HttpError(409, 'Подтвердите карточку с названием перед публикацией');
  if (task.status !== 'PUBLISHED') {
    await prisma.$transaction([
      prisma.task.update({ where: { id: task.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } }),
      prisma.scoreEvent.create({ data: { taskId: task.id, score: task.score, level: task.readinessLevel, reason: 'Опубликована в каталоге' } }),
    ]);
  }
  res.json(await toTaskDTO((await loadTask(task.id))!, { withClarification: true }));
});

/** Отклики на задачу вместе с решением бизнеса по каждой команде */
tasksRouter.get('/:id/proposals', async (req, res) => {
  const task = await requireTask(req.params.id);
  const [proposals, selections] = await Promise.all([
    prisma.proposal.findMany({ where: { taskId: task.id }, orderBy: { createdAt: 'asc' }, include: { team: true } }),
    prisma.selection.findMany({ where: { taskId: task.id } }),
  ]);
  const byTeam = new Map(selections.map((s) => [s.teamId, s.status]));
  res.json(
    proposals.map((p) => ({
      id: p.id,
      idea: p.idea,
      plan: p.plan,
      deadline: p.deadline,
      prototypeUrl: p.prototypeUrl,
      createdAt: p.createdAt,
      team: { id: p.team.id, name: p.team.name, members: p.team.members, skills: p.team.skills, stack: p.team.stack, interests: p.team.interests },
      decision: byTeam.get(p.teamId) ?? 'PENDING',
    })),
  );
});

/** Ручное решение: выбрать, отклонить или вернуть команду на рассмотрение */
tasksRouter.put('/:id/selections/:teamId', async (req, res) => {
  const task = await requireTask(req.params.id);
  const { status } = parseBody(SelectionSchema, req.body);
  const hasProposal = await prisma.proposal.count({ where: { taskId: task.id, teamId: req.params.teamId } });
  if (!hasProposal) throw new HttpError(409, 'Эта команда не откликалась на задачу');
  if (status === 'PENDING') {
    await prisma.selection.deleteMany({ where: { taskId: task.id, teamId: req.params.teamId } });
  } else {
    await prisma.selection.upsert({
      where: { taskId_teamId: { taskId: task.id, teamId: req.params.teamId } },
      create: { taskId: task.id, teamId: req.params.teamId, status },
      update: { status },
    });
  }
  res.json({ teamId: req.params.teamId, decision: status });
});

/** Отклик команды: идея, план, срок, ссылка; ограничений на число нет */
tasksRouter.post('/:id/proposals', async (req, res) => {
  const task = await requireTask(req.params.id);
  if (task.status !== 'PUBLISHED') throw new HttpError(409, 'Откликаться можно только на опубликованные задачи');
  const body = parseBody(ProposalSchema, req.body);
  const team = await prisma.teamProfile.findUnique({ where: { id: body.teamId } });
  if (!team) throw notFound('Команда');
  const proposal = await prisma.proposal.create({ data: { ...body, taskId: task.id } });
  res.status(201).json(proposal);
});
