import type { Metadata } from "next";
import Link from "next/link";
import { BusinessProfile } from "@/components/business/BusinessProfile";
import { ProposalsPanel } from "@/components/business/ProposalsPanel";
import { ErrorState, Tier } from "@/components/ui";
import { currentActors } from "@/lib/actor";
import { api, errorText } from "@/lib/api";
import type { MyTask, ProposalView } from "@/lib/types";

export const metadata: Metadata = { title: "Кабинет бизнеса" };

async function load(taskId?: string) {
  try {
    const [businesses, teams] = await Promise.all([api.businesses(), api.teams()]);
    const { business } = await currentActors(businesses, teams);
    if (!business) return { business: null, tasks: [] as MyTask[], selected: null, proposals: [] as ProposalView[] };
    const tasks = await api.businessTasks(business.id);
    const published = tasks.filter((t) => t.status === "PUBLISHED");
    const selected = tasks.find((t) => t.id === taskId) ?? published.find((t) => t.proposalsCount > 0) ?? published[0] ?? null;
    const proposals = selected && selected.status === "PUBLISHED" ? await api.proposals(selected.id) : [];
    return { business, tasks, selected, proposals };
  } catch (err) {
    return { error: errorText(err) };
  }
}

export default async function BusinessPage({ searchParams }: { searchParams: Promise<{ task?: string }> }) {
  const sp = await searchParams;
  const data = await load(sp.task);
  if ("error" in data) return <ErrorState title="Кабинет недоступен" text={data.error ?? ""} />;
  const { business, tasks, selected, proposals } = data;
  if (!business) return <ErrorState title="Компаний пока нет" text="Загрузите демо-данные командой pnpm db:seed в папке backend." />;

  return (
      <section className="screen" aria-labelledby="cab-title">
        <div className="wrap">
          <BusinessProfile business={business} />

          <section className="block" aria-labelledby="my-title">
            <div className="section-head section-head--row">
              <h2 id="my-title" className="display display--sm">
                Мои задачи
              </h2>
              <Link className="btn btn-accent btn-sm" href="/business/new">
                + Новая задача
              </Link>
            </div>
            {tasks.length === 0 ? (
              <div className="empty">
                <b>Задач пока нет</b>
                Опишите первую задачу — ИИ поможет довести её до готовой карточки.
              </div>
            ) : (
              <table className="table my-table">
                <thead>
                  <tr>
                    <th scope="col" className="c-pos">
                      Место
                    </th>
                    <th scope="col">Задача</th>
                    <th scope="col">Статус</th>
                    <th scope="col" className="num">
                      Очки
                    </th>
                    <th scope="col">Уровень</th>
                    <th scope="col" className="num">
                      Заявки
                    </th>
                    <th scope="col">
                      <span className="visually-hidden">Действие</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const open = selected?.id === t.id;
                    return (
                      <tr key={t.id} className={open ? "is-open" : undefined}>
                        <td className="pos-cell">{t.rank ?? "—"}</td>
                        <td>
                          <Link className="t-title" href={t.status === "PUBLISHED" ? `/business?task=${t.id}` : `/business/tasks/${t.id}/clarify`} scroll={false}>
                            {t.title}
                          </Link>
                          <p className="t-sub">{t.topic}</p>
                        </td>
                        <td className="topic">{t.status === "PUBLISHED" ? "Опубликована" : "Не опубликована"}</td>
                        <td className="pts-cell">{t.score}</td>
                        <td>
                          <Tier level={t.level} />
                        </td>
                        <td className="num">
                          {t.proposalsCount}
                          {t.pendingTeams > 0 && <span className="fresh">ждут решения: {t.pendingTeams}</span>}
                        </td>
                        <td className="num">
                          <Link className="btn btn-ghost btn-sm" href={t.status === "PUBLISHED" ? `/business/tasks/${t.id}` : `/business/tasks/${t.id}/clarify`}>
                            {t.status === "PUBLISHED" ? "Карточка" : "Продолжить"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          {selected && selected.status === "PUBLISHED" && (
            <ProposalsPanel key={selected.id} taskId={selected.id} taskTitle={selected.title} initial={proposals} />
          )}
        </div>
      </section>
  );
}
