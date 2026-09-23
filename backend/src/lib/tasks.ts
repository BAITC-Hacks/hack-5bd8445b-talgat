import { prisma } from '../db.js';
import type { Clarification } from '../ai/schemas.js';
import { previewFields } from '../ai/service.js';
import { CARD_FIELDS, evaluate, levelOf, normalizeFields, type CardFields, type LevelId } from '../scoring/scoring.js';
import type { Prisma } from '../generated/prisma/client.js';

export const taskInclude = {
  business: { select: { id: true, name: true, industry: true, city: true } },
  _count: { select: { proposals: true } },
  scoreEvents: { orderBy: { createdAt: 'asc' as const }, select: { score: true, level: true, reason: true, createdAt: true } },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export function fieldsOf(task: Pick<TaskWithRelations, (typeof CARD_FIELDS)[number]>): CardFields {
  return normalizeFields(task as unknown as Record<string, unknown>);
}

export function clarificationOf(task: { clarification: unknown }): Clarification | null {
  return (task.clarification as Clarification | null) ?? null;
}

/** Опубликованные задачи в порядке каталога: по рейтингу, при равенстве — кто раньше опубликовал */
export async function catalogOrder() {
  return prisma.task.findMany({
    where: { status: 'PUBLISHED' },
    orderBy: [{ score: 'desc' }, { publishedAt: 'asc' }],
    select: { id: true, score: true },
  });
}

/** Место задачи в каталоге; для неопубликованной — место, которое она займёт при публикации */
export function placeIn(order: Array<{ id: string; score: number }>, taskId: string, score: number): number {
  const index = order.findIndex((t) => t.id === taskId);
  if (index >= 0 && order[index].score === score) return index + 1;
  return 1 + order.filter((t) => t.id !== taskId && t.score >= score).length;
}

export function levelIdOf(score: number): LevelId {
  return levelOf(score).id;
}

/** Задача для интерфейса. withClarification — только для кабинета владельца */
export async function toTaskDTO(task: TaskWithRelations, opts: { withClarification?: boolean } = {}) {
  const order = await catalogOrder();
  const fields = fieldsOf(task);
  const evaluation = evaluate(fields);
  const clarification = clarificationOf(task);
  const dto = {
    id: task.id,
    status: task.status,
    topic: task.topic,
    title: task.title,
    rawDraft: task.rawDraft,
    fields,
    score: task.score,
    evaluation,
    business: task.business,
    rank: placeIn(order, task.id, task.score),
    catalogSize: order.length + (task.status === 'PUBLISHED' ? 0 : 1),
    proposalsCount: task._count.proposals,
    history: task.scoreEvents,
    publishedAt: task.publishedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
  if (!opts.withClarification) return dto;
  const preview = evaluate(previewFields(fields, clarification));
  return {
    ...dto,
    clarification,
    preview: { total: preview.total, level: preview.level, criteria: preview.criteria, rank: placeIn(order, task.id, preview.total) },
  };
}

export async function loadTask(id: string) {
  return prisma.task.findUnique({ where: { id }, include: taskInclude });
}
