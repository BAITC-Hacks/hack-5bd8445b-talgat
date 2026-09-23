import type { Metadata } from "next";
import Link from "next/link";
import { TeamProfileForm } from "@/components/TeamProfileForm";
import { ErrorState } from "@/components/ui";
import { currentActors } from "@/lib/actor";
import { api, errorText } from "@/lib/api";
import { ago } from "@/lib/format";

export const metadata: Metadata = { title: "Профиль команды" };

const DECISION = { SELECTED: "Команда выбрана", REJECTED: "Отклонена", PENDING: "Ждёт решения бизнеса" } as const;

async function load() {
  try {
    const [businesses, teams] = await Promise.all([api.businesses(), api.teams()]);
    const { team } = await currentActors(businesses, teams);
    if (!team) return { team: null, proposals: [] };
    return { team, proposals: await api.teamProposals(team.id) };
  } catch (err) {
    return { error: errorText(err) };
  }
}

export default async function TeamPage() {
  const data = await load();
  if ("error" in data) return <ErrorState title="Профиль недоступен" text={data.error ?? ""} />;
  const { team, proposals } = data;
  if (!team) return <ErrorState title="Команд пока нет" text="Загрузите демо-данные командой pnpm db:seed в папке backend." />;

  return (
    <section className="screen" aria-labelledby="team-title">
      <div className="wrap page-top">
        <p className="kicker">Профиль студенческой команды</p>
        <h1 id="team-title" className="display display--lg">
          {team.name}
        </h1>
      </div>
      <div className="wrap team-grid">
        <TeamProfileForm key={team.id} team={team} />
        <aside className="panel" aria-labelledby="my-props">
          <div className="panel-head">
            <h2 id="my-props">Наши заявки</h2>
            <span className="panel-meta">{proposals.length}</span>
          </div>
          {proposals.length === 0 ? (
            <p className="muted">
              Заявок пока нет. Откройте <Link href="/catalog">таблицу задач</Link> и выберите любую — откликаться можно без ограничений.
            </p>
          ) : (
            <ul className="my-props">
              {proposals.map((p) => (
                <li key={p.id}>
                  <div>
                    <Link href={`/catalog/${p.task.id}`}>{p.task.title}</Link>
                    <p className="t-sub">
                      {p.task.business} · {p.deadline} · {ago(p.createdAt)}
                    </p>
                  </div>
                  <span className={`verdict is-${p.decision}`}>{DECISION[p.decision]}</span>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </section>
  );
}
