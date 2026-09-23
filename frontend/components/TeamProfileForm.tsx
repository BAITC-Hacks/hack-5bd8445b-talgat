"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText, issuesByField } from "@/lib/api";
import type { Team } from "@/lib/types";
import { useToast } from "./Toast";

const toText = (tags: string[]) => tags.join(", ");
const toTags = (text: string) => text.split(",").map((s) => s.trim()).filter(Boolean);

export function TeamProfileForm({ team }: { team: Team }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ name: team.name, members: String(team.members), interests: toText(team.interests), skills: toText(team.skills), stack: toText(team.stack) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.updateTeam(team.id, { name: form.name, members: Number(form.members), interests: toTags(form.interests), skills: toTags(form.skills), stack: toTags(form.stack) });
      toast("Профиль команды сохранён — рекомендации обновятся");
      router.refresh();
    } catch (err) {
      const byField = issuesByField(err);
      setErrors(Object.keys(byField).length ? byField : { form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  const row = (key: keyof typeof form, label: string, hint?: string) => (
    <div className="form-row">
      <label htmlFor={`t-${key}`}>
        {label} {hint && <span className="opt">{hint}</span>}
      </label>
      <input id={`t-${key}`} className={`field${errors[key] ? " is-invalid" : ""}`} value={form[key]} onChange={set(key)} type={key === "members" ? "number" : "text"} min={key === "members" ? 1 : undefined} max={key === "members" ? 20 : undefined} />
      {errors[key] && <p className="field-error">{errors[key]}</p>}
    </div>
  );

  return (
    <form className="panel" onSubmit={save} noValidate>
      <div className="panel-head">
        <h2>О команде</h2>
      </div>
      <p className="panel-note">Интересы, навыки и технологии используются для подсказок в таблице задач. Каталог по ним не фильтруется — видно всё.</p>
      <div className="form-2">
        {row("name", "Название")}
        {row("members", "Участников")}
      </div>
      {row("interests", "Интересы", "через запятую")}
      {row("skills", "Навыки", "через запятую")}
      {row("stack", "Технологии", "через запятую")}
      {errors.form && <p className="alert">{errors.form}</p>}
      <div className="actions">
        <button className="btn btn-accent" type="submit" disabled={busy}>
          {busy && <span className="spin" aria-hidden="true" />}
          Сохранить профиль
        </button>
      </div>
    </form>
  );
}
