"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { api, errorText, issuesByField } from "@/lib/api";
import type { Business } from "@/lib/types";

export function BusinessProfile({ business }: { business: Business }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: business.name, industry: business.industry, city: business.city, contact: business.contact, email: business.email });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await api.updateBusiness(business.id, form);
      toast("Профиль компании сохранён");
      setEditing(false);
      router.refresh();
    } catch (err) {
      const byField = issuesByField(err);
      setErrors(Object.keys(byField).length ? byField : { form: errorText(err) });
    } finally {
      setBusy(false);
    }
  }

  const input = (key: keyof typeof form, label: string, type = "text") => (
    <div className="form-row">
      <label htmlFor={`b-${key}`}>{label}</label>
      <input id={`b-${key}`} type={type} className={`field${errors[key] ? " is-invalid" : ""}`} value={form[key]} onChange={set(key)} />
      {errors[key] && <p className="field-error">{errors[key]}</p>}
    </div>
  );

  return (
    <header>
      <div className="club">
        <div>
          <p className="kicker">Кабинет бизнеса</p>
          <h1 id="cab-title" className="display display--lg">
            {business.name}
          </h1>
          <p className="club-meta">
            {[business.industry, business.city, business.contact, business.email].filter(Boolean).join(" · ")}
          </p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing}>
          {editing ? "Скрыть" : "Изменить профиль"}
        </button>
      </div>
      {editing && (
        <form className="profile-form" onSubmit={save} noValidate>
          {input("name", "Название компании")}
          {input("industry", "Отрасль")}
          {input("city", "Город")}
          {input("contact", "Контактное лицо и должность")}
          {input("email", "Почта", "email")}
          {errors.form && <p className="alert">{errors.form}</p>}
          <div className="form-actions">
            <button className="btn btn-accent" type="submit" disabled={busy}>
              {busy && <span className="spin" aria-hidden="true" />}
              Сохранить
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setEditing(false)}>
              Отмена
            </button>
          </div>
        </form>
      )}
    </header>
  );
}
