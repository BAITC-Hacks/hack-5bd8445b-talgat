"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api, errorText, issuesByField } from "@/lib/api";
import type { Team } from "@/lib/types";
import { useToast } from "./Toast";

type Values = { idea: string; plan: string; deadline: string; prototypeUrl: string };
const EMPTY: Values = { idea: "", plan: "", deadline: "", prototypeUrl: "" };

function validate(v: Values): Partial<Record<keyof Values, string>> {
  const e: Partial<Record<keyof Values, string>> = {};
  if (v.idea.trim().length < 10) e.idea = "Опишите идею — бизнесу нужно с чем сравнивать.";
  if (v.plan.trim().length < 10) e.plan = "Добавьте хотя бы пару этапов.";
  if (!v.deadline.trim()) e.deadline = "Укажите срок.";
  if (v.prototypeUrl.trim() && !/^https?:\/\/\S+\.\S+/.test(v.prototypeUrl.trim())) e.prototypeUrl = "Нужна ссылка с http:// или https://";
  return e;
}

export function ProposalForm({ taskId, team, proposalsCount }: { taskId: string; team: Team; proposalsCount: number }) {
  const router = useRouter();
  const toast = useToast();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState("");
  const sentRef = useRef<HTMLDivElement>(null);

  const set = (key: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value;
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`r-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    setServerError("");
    try {
      await api.propose(taskId, { teamId: team.id, ...values });
      setSent(true);
      setValues(EMPTY);
      toast("Заявка отправлена — бизнес увидит её в кабинете");
      router.refresh();
      requestAnimationFrame(() => sentRef.current?.focus());
    } catch (err) {
      const byField = issuesByField(err);
      if (Object.keys(byField).length) setErrors(byField);
      else setServerError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="panel sent" ref={sentRef} tabIndex={-1}>
        <p className="sent-badge">Заявка отправлена</p>
        <p>Бизнес увидит её в кабинете рядом с остальными и сам решит, с кем работать. Статус заявки — в профиле команды.</p>
        <button className="btn btn-ghost" type="button" onClick={() => setSent(false)}>
          Подать ещё одну
        </button>
      </div>
    );
  }

  const field = (key: keyof Values) => ({
    id: `r-${key}`,
    className: `field${errors[key] ? " is-invalid" : ""}`,
    value: values[key],
    onChange: set(key),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `r-${key}-err` : undefined,
  });

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <div className="panel-head">
        <h2>Заявка команды</h2>
        <span className="panel-meta">
          {team.name} · {team.members} чел.
        </span>
      </div>
      <div className="form-row">
        <label htmlFor="r-idea">Идея решения</label>
        <textarea {...field("idea")} rows={3} placeholder="Что сделаете и почему это сработает" />
        {errors.idea && <p className="field-error" id="r-idea-err">{errors.idea}</p>}
      </div>
      <div className="form-row">
        <label htmlFor="r-plan">План</label>
        <textarea {...field("plan")} rows={4} placeholder="Этапы по неделям и что покажете" />
        {errors.plan && <p className="field-error" id="r-plan-err">{errors.plan}</p>}
      </div>
      <div className="form-2">
        <div className="form-row">
          <label htmlFor="r-deadline">Срок</label>
          <input {...field("deadline")} type="text" placeholder="3 недели" />
          {errors.deadline && <p className="field-error" id="r-deadline-err">{errors.deadline}</p>}
        </div>
        <div className="form-row">
          <label htmlFor="r-prototypeUrl">
            Прототип <span className="opt">по желанию</span>
          </label>
          <input {...field("prototypeUrl")} type="url" placeholder="https://" />
          {errors.prototypeUrl && <p className="field-error" id="r-prototypeUrl-err">{errors.prototypeUrl}</p>}
        </div>
      </div>
      {serverError && <p className="alert">{serverError}</p>}
      <button className="btn btn-accent btn-block" type="submit" disabled={busy}>
        {busy && <span className="spin" aria-hidden="true" />}
        {busy ? "Отправляем…" : "Отправить заявку"}
      </button>
      <p className="panel-note">{proposalsCount > 0 ? `Уже подали: ${proposalsCount}. ` : ""}Лимита нет — выбирает бизнес.</p>
    </form>
  );
}
