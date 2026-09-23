import type { Metadata } from "next";
import { CardEditor } from "@/components/business/CardEditor";
import { ErrorState } from "@/components/ui";
import { ApiError, api, errorText } from "@/lib/api";

export const metadata: Metadata = { title: "Карточка задачи" };

export default async function TaskCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await Promise.all([api.task(id), api.meta(), api.catalog()]).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (!loaded.ok) {
    if (loaded.error instanceof ApiError && loaded.error.status === 404) return <ErrorState title="Задача не найдена" text="Проверьте ссылку или вернитесь в кабинет." />;
    return <ErrorState title="Не удалось открыть карточку" text={errorText(loaded.error)} />;
  }
  const [task, meta, catalog] = loaded.value;
  const otherScores = catalog.items.filter((i) => i.id !== task.id).map((i) => i.score);
  const proposed = task.clarification?.proposed?.fields;
  const initialPreview = proposed ? await api.scorePreview(proposed).catch(() => task.evaluation) : task.evaluation;
  return <CardEditor task={task} meta={meta} otherScores={otherScores} initialPreview={initialPreview} />;
}
