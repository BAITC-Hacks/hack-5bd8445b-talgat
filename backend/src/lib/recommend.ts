import { prisma } from '../db.js';
import type { TeamProfile } from '../generated/prisma/client.js';

const STOP = new Set(['и', 'в', 'на', 'с', 'по', 'для', 'данных', 'разработка']);

/** Разбивает теги команды на слова, чтобы «анализ данных» совпадал с «данные для анализа» */
function stems(tag: string): string[] {
  return tag
    .toLowerCase()
    .split(/[\s,/·-]+/)
    .map((w) => w.replace(/[^a-zа-яё0-9+#.]/gi, ''))
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 5 ? w.slice(0, w.length - 2) : w));
}

/**
 * Рекомендации по интересам, навыкам и стеку команды. Только подсказка:
 * предлагаем задачи от 40 баллов (уровень «Рабочая» и выше), как требует кейс.
 */
export async function recommendTasks(team: TeamProfile) {
  const tasks = await prisma.task.findMany({
    where: { status: 'PUBLISHED', score: { gte: 40 } },
    include: { business: { select: { name: true } } },
  });
  const tags = [...team.interests, ...team.skills, ...team.stack];

  return tasks
    .map((t) => {
      const haystack = [t.topic, t.title, t.context, t.need, t.data, t.expectedResult, t.constraints].join(' ').toLowerCase();
      const matched = tags.filter((tag) => stems(tag).some((s) => haystack.includes(s)));
      const topicMatch = team.interests.some((i) => t.topic.toLowerCase().includes(i.toLowerCase()) || i.toLowerCase().includes(t.topic.toLowerCase()));
      const weight = matched.length + (topicMatch ? 2 : 0) + t.score / 100;
      return { task: { id: t.id, title: t.title, topic: t.topic, score: t.score, business: t.business.name }, matched: [...new Set(matched)].slice(0, 4), weight };
    })
    .filter((r) => r.matched.length > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(({ task, matched }) => ({ task, reason: matched.join(' · ') }));
}
