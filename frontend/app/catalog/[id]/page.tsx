import type { Metadata } from "next";
import Link from "next/link";
import { ProposalForm } from "@/components/ProposalForm";
import { ErrorState, StatList, Tier } from "@/components/ui";
import { currentActors } from "@/lib/actor";
import { ApiError, api, errorText } from "@/lib/api";
import { ago } from "@/lib/format";
import type { Meta, Task, Team } from "@/lib/types";

export const metadata: Metadata = { title: "Задача" };

export default async function CatalogTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let task: Task;
  let meta: Meta;
  let team: Team | null = null;
  try {
    const [t, m, businesses, teams] = await Promise.all([api.catalogTask(id), api.meta(), api.businesses(), api.teams()]);
    task = t;
    meta = m;
    team = (await currentActors(businesses, teams)).team;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return <ErrorState title="Задача не найдена" text="Возможно, её сняли с публикации. Вернитесь в таблицу задач." />;
    return <ErrorState title="Задача недоступна" text={errorText(err)} />;
  }

  const ev = task.evaluation;

  return (
    <section className="screen" aria-labelledby="t-title">
      <div className="wrap page-top">
        <p className="kicker">
          <Link href="/catalog" className="back">
            ← Таблица задач
          </Link>{" "}
          · {task.business.name} · {task.topic} · опубликована {ago(task.publishedAt)}
        </p>
        <h1 id="t-title" className="title-static">
          {task.title}
        </h1>
      </div>

      <div className="scoreboard on-board">
        <div className="wrap sb-row">
          <div className="sb-score">
            <span className="sb-num">{task.score}</span>
            <span className="sb-unit">
              очков
              <br />
              из 100
            </span>
          </div>
          <div className="sb-facts">
            <div>
              <span className="sb-label">Уровень</span>
              <Tier level={ev.level} large />
            </div>
            <div>
              <span className="sb-label">Место</span>
              <span className="sb-place">
                {task.rank}
                <small>из {task.catalogSize}</small>
              </span>
            </div>
            <div>
              <span className="sb-label">Заявки</span>
              <span className="sb-place">{task.proposalsCount}</span>
            </div>
          </div>
          <p className="sb-pending">
            {ev.missing.length === 0
              ? "Все сведения на месте — можно начинать работу."
              : `Не хватает: ${ev.missing.map((m) => m.label.toLowerCase()).join(", ")}. Это можно уточнить у бизнеса в заявке.`}
          </p>
        </div>
      </div>

      <div className="wrap task-grid">
        <div>
          <StatList current={ev.criteria} compact />
          <dl className="read">
            {meta.fields.map((f) => (
              <div key={f.id}>
                <dt>{f.label}</dt>
                <dd>{task.fields[f.id] ? task.fields[f.id] : <span className="is-missing">Не указано</span>}</dd>
              </div>
            ))}
          </dl>
        </div>
        <aside>
          <div className="sticky">
            {team ? (
              <ProposalForm taskId={task.id} team={team} proposalsCount={task.proposalsCount} />
            ) : (
              <div className="panel">
                <p>Нет профилей команд. Загрузите демо-данные: pnpm db:seed.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
