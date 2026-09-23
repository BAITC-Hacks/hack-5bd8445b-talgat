/**
 * Синтетические данные: компании, 5 черновиков разной полноты, 7 опубликованных карточек
 * с историей рейтинга, 5 профилей команд и 8 откликов. Запуск: pnpm db:seed
 * Скрипт идемпотентный — перед заливкой очищает таблицы.
 */
import { readFileSync } from 'node:fs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { env } from '../src/env.js';
import { evaluate, levelOf, normalizeFields } from '../src/scoring/scoring.js';
import { extractByRules, questionsByRules } from '../src/ai/fallback.js';
import type { Clarification } from '../src/ai/schemas.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  transactionOptions: { maxWait: 15_000, timeout: 60_000 },
});

const load = <T>(name: string): T => JSON.parse(readFileSync(new URL(`./data/${name}.json`, import.meta.url), 'utf8')) as T;
const daysAgo = (days: number, hour = 11) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

interface BusinessSeed { id: string; name: string; industry: string; city: string; contact: string; email: string }
interface DraftSeed { id: string; businessId: string; topic: string; rawDraft: string; completeness: string }
interface CardSeed {
  id: string; businessId: string; topic: string; title: string; rawDraft: string; publishedDaysAgo: number;
  fields: Record<string, string>; history: Array<{ daysAgo: number; score: number; reason: string }>;
}
interface TeamSeed { id: string; name: string; members: number; interests: string[]; skills: string[]; stack: string[] }
interface ProposalSeed {
  id: string; taskId: string; teamId: string; daysAgo: number; decision: 'SELECTED' | 'REJECTED' | null;
  idea: string; plan: string; deadline: string; prototypeUrl: string;
}

async function main() {
  const businesses = load<BusinessSeed[]>('businesses');
  const drafts = load<DraftSeed[]>('drafts');
  const cards = load<CardSeed[]>('cards');
  const teams = load<TeamSeed[]>('teams');
  const proposals = load<ProposalSeed[]>('proposals');

  await prisma.$transaction([
    prisma.selection.deleteMany(),
    prisma.proposal.deleteMany(),
    prisma.scoreEvent.deleteMany(),
    prisma.task.deleteMany(),
    prisma.teamProfile.deleteMany(),
    prisma.business.deleteMany(),
  ]);

  for (const [i, b] of businesses.entries()) {
    await prisma.business.create({ data: { ...b, createdAt: daysAgo(40 - i) } });
  }
  const contactOf = new Map(businesses.map((b) => [b.id, b.contact]));

  // Черновики: ещё не подтверждены и не опубликованы; вопросы подготовлены локальными правилами
  for (const [i, d] of drafts.entries()) {
    const extracted = extractByRules(d.rawDraft);
    extracted.fields.contact = contactOf.get(d.businessId) ?? '';
    const clarification: Clarification = {
      source: 'rules',
      model: null,
      analyzedAt: daysAgo(i % 3).toISOString(),
      extracted,
      questions: questionsByRules(extracted.fields),
      warnings: ['Демо-данные: вопросы подготовлены локальными правилами. «Разобрать заново» отправит черновик в OpenAI.'],
      proposed: null,
    };
    await prisma.task.create({
      data: {
        id: d.id,
        businessId: d.businessId,
        topic: d.topic,
        title: extracted.title,
        rawDraft: d.rawDraft,
        clarification: clarification as object,
        createdAt: daysAgo(i % 3, 9),
      },
    });
  }

  // Опубликованные карточки: баллы считает та же формула, история — как подтверждались поля
  for (const c of cards) {
    const fields = normalizeFields(c.fields);
    const ev = evaluate(fields);
    const lastConfirm = c.history.filter((h) => !h.reason.startsWith('Опубликована')).at(-1);
    if (lastConfirm && lastConfirm.score !== ev.total) {
      throw new Error(`Карточка ${c.id}: в истории ${lastConfirm.score}, по формуле ${ev.total}`);
    }
    await prisma.task.create({
      data: {
        id: c.id,
        businessId: c.businessId,
        topic: c.topic,
        title: c.title,
        rawDraft: c.rawDraft,
        ...fields,
        score: ev.total,
        readinessLevel: ev.level.id,
        status: 'PUBLISHED',
        publishedAt: daysAgo(c.publishedDaysAgo, 12),
        createdAt: daysAgo(c.publishedDaysAgo + 1, 10),
        scoreEvents: {
          create: c.history.map((h, i) => ({ score: h.score, level: levelOf(h.score).id, reason: h.reason, createdAt: daysAgo(h.daysAgo, 12 + i) })),
        },
      },
    });
  }

  for (const [i, t] of teams.entries()) {
    await prisma.teamProfile.create({ data: { ...t, createdAt: daysAgo(30 - i) } });
  }

  for (const p of proposals) {
    const { decision, daysAgo: ago, ...rest } = p;
    await prisma.proposal.create({ data: { ...rest, createdAt: daysAgo(ago, 15) } });
    if (decision) {
      await prisma.selection.create({ data: { taskId: p.taskId, teamId: p.teamId, status: decision, createdAt: daysAgo(Math.max(0, ago - 1), 16) } });
    }
  }

  console.log(`Готово: компаний ${businesses.length}, черновиков ${drafts.length}, карточек ${cards.length}, команд ${teams.length}, откликов ${proposals.length}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
