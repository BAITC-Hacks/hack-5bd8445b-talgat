import type { Metadata } from "next";
import { DraftForm } from "@/components/business/DraftForm";
import { ErrorState } from "@/components/ui";
import { currentActors } from "@/lib/actor";
import { api, errorText } from "@/lib/api";

export const metadata: Metadata = { title: "Новая задача" };

async function load() {
  try {
    const [businesses, teams, meta] = await Promise.all([api.businesses(), api.teams(), api.meta()]);
    const { business } = await currentActors(businesses, teams);
    return { business, meta };
  } catch (err) {
    return { error: errorText(err) };
  }
}

export default async function NewTaskPage() {
  const data = await load();
  if ("error" in data) return <ErrorState title="Не удалось открыть форму" text={data.error ?? ""} />;
  const { business, meta } = data;
  if (!business) return <ErrorState title="Компаний пока нет" text="Загрузите демо-данные командой pnpm db:seed в папке backend." />;

  return (
    <section className="screen" aria-labelledby="new-title">
      <div className="wrap page-top">
        <p className="kicker">Новая задача · {business.name}</p>
        <h1 id="new-title" className="display display--lg">
          Опишите задачу как есть
        </h1>
      </div>
      <div className="wrap draft-grid">
        <DraftForm businessId={business.id} defaultTopic={business.industry} topics={meta.topics} />
        <aside className="panel panel--soft" aria-labelledby="next-title">
          <div className="panel-head">
            <h2 id="next-title">Что будет дальше</h2>
          </div>
          <ol className="guards">
            <li>ИИ разложит черновик по пунктам карточки — только вашими словами.</li>
            <li>Задаст 3–6 вопросов о том, чего не хватает. Каждый ответ сразу добавляет очки.</li>
            <li>Вы проверите карточку, поправите и подтвердите. Баллы засчитываются только после подтверждения.</li>
            <li>Опубликуете — задача встанет в таблицу на место по своим очкам.</li>
          </ol>
        </aside>
      </div>
    </section>
  );
}
