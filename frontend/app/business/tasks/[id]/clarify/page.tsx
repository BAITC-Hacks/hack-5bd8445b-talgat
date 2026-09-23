import type { Metadata } from "next";
import { ClarifyView } from "@/components/business/ClarifyView";
import { ErrorState } from "@/components/ui";
import { ApiError, api, errorText } from "@/lib/api";

export const metadata: Metadata = { title: "Уточнение задачи" };

export default async function ClarifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const loaded = await Promise.all([api.task(id), api.catalog(), api.meta()]).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  if (!loaded.ok) {
    if (loaded.error instanceof ApiError && loaded.error.status === 404) return <ErrorState title="Задача не найдена" text="Проверьте ссылку или вернитесь в кабинет." />;
    return <ErrorState title="Не удалось открыть задачу" text={errorText(loaded.error)} />;
  }
  const [task, catalog, meta] = loaded.value;
  if (!task.clarification) return <ErrorState title="Черновик ещё не разобран" text="Откройте задачу из кабинета и нажмите «Разобрать заново»." />;
  const others = catalog.items.filter((i) => i.id !== task.id).map((i) => ({ id: i.id, title: i.title, score: i.score }));
  return <ClarifyView task={task} others={others} meta={meta} />;
}
