import Link from "next/link";
import { ErrorState, Tier } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import type { Catalog, LevelId, Meta } from "@/lib/types";

const ZONE: Record<LevelId, string> = { PRIORITY: "Приоритетные", READY: "Готовые", WORKING: "Рабочие", DRAFT: "Черновики" };

const HOW: Record<string, string> = {
  contextNeed: "Что происходит сейчас и что нужно изменить",
  data: "Какие данные, примеры и источники есть",
  result: "Что конкретно передаст команда",
  success: "Измеримый признак, по которому примете работу",
  constraints: "Сроки, технологии, доступы",
  users: "Для кого решение",
  link: "Контакт и формат консультаций",
};

export default async function EntryPage() {
  let catalog: Catalog;
  let meta: Meta;
  try {
    [catalog, meta] = await Promise.all([api.catalog(), api.meta()]);
  } catch (err) {
    return <ErrorState title="Не удалось загрузить данные" text={errorText(err)} />;
  }

  const rows: Array<{ zone?: LevelId; item?: Catalog["items"][number] }> = [];
  let zone: LevelId | null = null;
  for (const item of catalog.items.slice(0, 9)) {
    if (item.level.id !== zone) {
      zone = item.level.id;
      rows.push({ zone });
    }
    rows.push({ item });
  }

  return (
    <section className="entry" aria-labelledby="entry-title">
      <div className="wrap entry-grid">
        <div>
          <h1 id="entry-title" className="display display--xl">
            Чем понятнее задача — тем выше она в таблице
          </h1>
          <p className="lead">
            Бизнес описывает задачу и набирает очки за каждое внятное сведение. Студенческие команды выбирают задачи из общей таблицы. С кем работать, решает только бизнес.
          </p>

          <div className="doors">
            <Link className="door door--biz" href="/business/new">
              <span className="door-who">Я из бизнеса</span>
              <span className="door-act">
                Выставить задачу <span aria-hidden="true">→</span>
              </span>
              <span className="door-note">Разберём черновик, зададим вопросы, посчитаем очки</span>
            </Link>
            <Link className="door door--team" href="/catalog">
              <span className="door-who">Мы — студенческая команда</span>
              <span className="door-act">
                Смотреть таблицу <span aria-hidden="true">→</span>
              </span>
              <span className="door-note">Все задачи, фильтры, заявки без ограничений</span>
            </Link>
          </div>
        </div>

        <aside className="entry-board" aria-labelledby="board-title">
          <div className="board-head">
            <h2 id="board-title">Таблица сейчас</h2>
            <Link href="/catalog">все задачи: {catalog.total}</Link>
          </div>
          {catalog.items.length === 0 ? (
            <p className="muted">Опубликованных задач пока нет — выставьте первую.</p>
          ) : (
            <ol className="board">
              {rows.map((r) =>
                r.zone ? (
                  <li key={`z-${r.zone}`} className="zone-row">
                    {ZONE[r.zone]} <span>· {meta.levels.find((l) => l.id === r.zone)?.min}–{meta.levels.find((l) => l.id === r.zone)?.max}</span>
                  </li>
                ) : r.item ? (
                  <li key={r.item.id} className={r.item.level.id === "PRIORITY" ? "is-lead" : undefined}>
                    <span className="pos">{r.item.rank}</span>
                    <span className="t">
                      <Link href={`/catalog/${r.item.id}`}>{r.item.title}</Link>
                    </span>
                    <Tier level={r.item.level} />
                    <span className="pts">{r.item.score}</span>
                  </li>
                ) : null,
              )}
            </ol>
          )}
        </aside>
      </div>

      <div className="wrap">
        <section className="howto" aria-labelledby="howto-title">
          <div className="section-head section-head--row">
            <h2 id="howto-title" className="display display--md">
              Как набрать 100 очков
            </h2>
            <p>Очки начисляет формула, а не ИИ, и только за заполненные и подтверждённые пункты. Низкие очки не прячут задачу: она остаётся в таблице и открыта для заявок.</p>
          </div>
          <ol className="howto-list">
            {meta.criteria.map((c) => (
              <li key={c.id}>
                <b>{c.max}</b>
                <span>
                  <strong>{c.name}.</strong> {HOW[c.id] ?? c.hint}
                </span>
              </li>
            ))}
          </ol>
          <ol className="levels-row">
            {meta.levels.map((l) => (
              <li key={l.id}>
                <Tier level={l} />
                <span>
                  {l.min}–{l.max} · {l.note}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
