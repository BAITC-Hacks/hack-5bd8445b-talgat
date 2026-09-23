import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { ErrorState, SplitBar, Tier } from "@/components/ui";
import { currentActors } from "@/lib/actor";
import { api, errorText } from "@/lib/api";
import { ago } from "@/lib/format";
import type { Catalog, LevelId, Meta, Recommendation } from "@/lib/types";

export const metadata: Metadata = { title: "Таблица задач" };

const ZONE: Record<LevelId, { name: string; note: string }> = {
  PRIORITY: { name: "Приоритетные", note: "90–100 · выделены в таблице" },
  READY: { name: "Готовые", note: "70–89 · повышенная позиция" },
  WORKING: { name: "Рабочие", note: "40–69 · можно подавать заявки" },
  DRAFT: { name: "Черновики", note: "0–39 · требуют уточнения, но заявки принимаются" },
};
const LEVEL_ORDER: LevelId[] = ["PRIORITY", "READY", "WORKING", "DRAFT"];

type Search = { sort?: string; levels?: string; topics?: string };
const list = (v?: string) => (v ?? "").split(",").filter(Boolean);

function hrefWith(current: Search, patch: Partial<Search>) {
  const next = { ...current, ...patch };
  const p = new URLSearchParams();
  if (next.sort && next.sort !== "score") p.set("sort", next.sort);
  if (next.levels) p.set("levels", next.levels);
  if (next.topics) p.set("topics", next.topics);
  const q = p.toString();
  return q ? `/catalog?${q}` : "/catalog";
}

function toggle(values: string[], value: string) {
  return (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]).join(",");
}

export default async function CatalogPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const sort = sp.sort === "new" ? "new" : "score";
  const levels = list(sp.levels);
  const topics = list(sp.topics);

  let catalog: Catalog;
  let meta: Meta;
  let recommendations: Recommendation[] = [];
  let teamName = "";
  try {
    const [c, m, businesses, teams] = await Promise.all([api.catalog({ sort, levels, topics }), api.meta(), api.businesses(), api.teams()]);
    catalog = c;
    meta = m;
    const { team } = await currentActors(businesses, teams);
    if (team) {
      teamName = team.name;
      recommendations = await api.recommendations(team.id);
    }
  } catch (err) {
    return <ErrorState title="Таблица недоступна" text={errorText(err)} />;
  }

  const filtered = levels.length > 0 || topics.length > 0;

  return (
    <section className="screen" aria-labelledby="cat-title">
      <div className="wrap">
        <div className="cat-head">
          <div>
            <h1 id="cat-title" className="display display--lg">
              Таблица задач
            </h1>
            <p className="cat-sub">Все опубликованные задачи. Место определяют очки готовности, а не известность компании.</p>
          </div>
          <div className="seg" role="group" aria-label="Сортировка">
            <Link scroll={false} href={hrefWith(sp, { sort: "score" })} className={`seg-btn${sort === "score" ? " is-on" : ""}`} aria-current={sort === "score" ? "true" : undefined}>
              По очкам
            </Link>
            <Link scroll={false} href={hrefWith(sp, { sort: "new" })} className={`seg-btn${sort === "new" ? " is-on" : ""}`} aria-current={sort === "new" ? "true" : undefined}>
              Сначала новые
            </Link>
          </div>
        </div>

        <div className="filters">
          <div className="chip-row" role="group" aria-label="Фильтр по уровню">
            <span className="chip-label">Уровень</span>
            {LEVEL_ORDER.map((id) => (
              <Link key={id} scroll={false} className="chip" aria-pressed={levels.includes(id)} href={hrefWith(sp, { levels: toggle(levels, id) })}>
                {meta.levels.find((l) => l.id === id)?.name} <span className="cnt">{catalog.counts.levels[id] ?? 0}</span>
              </Link>
            ))}
          </div>
          <div className="chip-row" role="group" aria-label="Фильтр по теме">
            <span className="chip-label">Тема</span>
            {meta.topics
              .filter((t) => (catalog.counts.topics[t] ?? 0) > 0 || topics.includes(t))
              .map((t) => (
                <Link key={t} scroll={false} className="chip" aria-pressed={topics.includes(t)} href={hrefWith(sp, { topics: toggle(topics, t) })}>
                  {t} <span className="cnt">{catalog.counts.topics[t] ?? 0}</span>
                </Link>
              ))}
            {filtered && (
              <Link scroll={false} className="chip-reset" href={hrefWith({ sort: sp.sort }, {})}>
                Сбросить фильтры
              </Link>
            )}
          </div>
        </div>

        {recommendations.length > 0 && (
          <aside className="scout" aria-labelledby="scout-title">
            <h2 id="scout-title">Подходит {teamName}</h2>
            <ul>
              {recommendations.map((r) => (
                <li key={r.task.id}>
                  <Link href={`/catalog/${r.task.id}`}>
                    {r.task.title} · {r.task.score}
                  </Link>
                  <span>совпадает: {r.reason}</span>
                </li>
              ))}
            </ul>
            <p>Подсказка по интересам и навыкам команды. Таблица от неё не сужается.</p>
          </aside>
        )}

        <table className="table standings">
          <caption className="visually-hidden">Задачи по очкам готовности</caption>
          <thead>
            <tr>
              <th scope="col" className="c-pos">
                #
              </th>
              <th scope="col">Задача</th>
              <th scope="col">Тема</th>
              <th scope="col" className="c-split">
                Разбор
              </th>
              <th scope="col" className="num">
                Очки
              </th>
              <th scope="col">Уровень</th>
              <th scope="col" className="num">
                Заявки
              </th>
            </tr>
          </thead>
          <tbody>
            {catalog.items.length === 0 && (
              <tr className="empty-row">
                <td colSpan={7}>
                  <b>Под эти фильтры задач нет</b>
                  Снимите часть фильтров или <Link href="/catalog">сбросьте все</Link>.
                </td>
              </tr>
            )}
            {catalog.items.map((t, i) => {
              const showZone = sort === "score" && (i === 0 || catalog.items[i - 1].level.id !== t.level.id);
              return (
                <Fragment key={t.id}>
                  {showZone && (
                    <tr className={`zone zone--${t.level.id}`}>
                      <td colSpan={7}>
                        <div className="zone-label">
                          {ZONE[t.level.id].name}
                          <span>{ZONE[t.level.id].note}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr className={`row${t.level.id === "PRIORITY" ? " is-priority" : ""}`}>
                    <td className="pos-cell">{t.rank}</td>
                    <td>
                      <Link className="t-title" href={`/catalog/${t.id}`}>
                        {t.title}
                      </Link>
                      {t.isNew && <span className="t-new">Новая</span>}
                      <p className="t-sub">
                        {t.business.name} · {ago(t.publishedAt)}
                      </p>
                      {t.level.id === "DRAFT" && <p className="t-warn">Мало сведений — уточните у бизнеса в заявке</p>}
                    </td>
                    <td className="topic">{t.topic}</td>
                    <td>
                      <SplitBar points={t.points} />
                    </td>
                    <td className="pts-cell">
                      {t.score}
                      {t.delta !== null && t.delta > 0 && <span className="up">▲ +{t.delta}</span>}
                    </td>
                    <td>
                      <Tier level={t.level} />
                    </td>
                    <td className="num">{t.proposalsCount}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
