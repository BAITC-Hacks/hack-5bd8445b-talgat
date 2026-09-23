"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { api, errorText } from "@/lib/api";
import { ago } from "@/lib/format";
import type { Decision, ProposalView } from "@/lib/types";

const VERDICT: Record<Decision, string> = { SELECTED: "Выбрана", REJECTED: "Отклонена", PENDING: "Ждёт решения" };

export function ProposalsPanel({ taskId, taskTitle, initial }: { taskId: string; taskTitle: string; initial: ProposalView[] }) {
  const router = useRouter();
  const toast = useToast();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function decide(teamId: string, decision: Decision) {
    setBusy(teamId);
    setError("");
    try {
      await api.decide(taskId, teamId, decision);
      setItems((list) => list.map((p) => (p.team.id === teamId ? { ...p, decision } : p)));
      const team = items.find((p) => p.team.id === teamId)?.team.name ?? "Команда";
      toast(decision === "SELECTED" ? `${team}: команда выбрана` : decision === "REJECTED" ? `${team}: заявка отклонена` : `${team}: снова на рассмотрении`);
      router.refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  const count = (d: Decision) => new Set(items.filter((p) => p.decision === d).map((p) => p.team.id)).size;

  return (
    <section className="block" aria-labelledby="props-title">
      <div className="section-head section-head--row">
        <h2 id="props-title" className="display display--sm">
          Заявки на «{taskTitle}»
        </h2>
        <p className="tally" aria-live="polite">
          Выбрано <b>{count("SELECTED")}</b> · Отклонено <b>{count("REJECTED")}</b> · Ждут <b>{count("PENDING")}</b>
        </p>
      </div>
      <p className="rule">
        <b>Выбираете только вы:</b> одну команду, несколько или ни одной. Система никого не назначает и не сортирует заявки за вас.
      </p>
      {error && <p className="alert">{error}</p>}
      {items.length === 0 ? (
        <div className="empty">
          <b>Заявок пока нет</b>
          Задача уже в таблице — команды увидят её и откликнутся. Чем выше очки, тем выше место.
        </div>
      ) : (
        <div className="props">
          {items.map((p) => (
            <article key={p.id} className={`prop is-${p.decision}`} aria-labelledby={`${p.id}-h`}>
              <div>
                <h3 id={`${p.id}-h`}>{p.team.name}</h3>
                <p className="prop-team">
                  {p.team.members} чел. · {p.team.stack.join(", ")}
                </p>
                <p className="prop-team">{ago(p.createdAt)}</p>
              </div>
              <div>
                <p className="prop-k">Идея</p>
                <p>{p.idea}</p>
              </div>
              <div>
                <p className="prop-k">План</p>
                <p className="prop-plan">{p.plan}</p>
              </div>
              <div>
                <p className="prop-k">Срок</p>
                <p className="prop-deadline">{p.deadline}</p>
                <p className="prop-k" style={{ marginTop: 12 }}>
                  Прототип
                </p>
                {p.prototypeUrl ? (
                  <a className="prop-link" href={p.prototypeUrl} target="_blank" rel="noreferrer">
                    {p.prototypeUrl.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <p className="muted">Не приложен</p>
                )}
              </div>
              <div className="prop-decide">
                <p className={`verdict is-${p.decision}`}>{VERDICT[p.decision]}</p>
                {p.decision === "PENDING" ? (
                  <>
                    <button className="btn btn-accent btn-sm" type="button" disabled={busy === p.team.id} onClick={() => decide(p.team.id, "SELECTED")}>
                      Выбрать команду
                    </button>
                    <button className="btn btn-ghost btn-sm" type="button" disabled={busy === p.team.id} onClick={() => decide(p.team.id, "REJECTED")}>
                      Отклонить
                    </button>
                  </>
                ) : (
                  <button className="btn btn-ghost btn-sm" type="button" disabled={busy === p.team.id} onClick={() => decide(p.team.id, "PENDING")}>
                    {p.decision === "SELECTED" ? "Отменить выбор" : "Вернуть на рассмотрение"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
