"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorText, issuesByField } from "@/lib/api";

const EXAMPLE = "Курьеры часто опаздывают, клиенты жалуются. Нужна какая-то система, чтобы это исправить.";

export function DraftForm({ businessId, defaultTopic, topics }: { businessId: string; defaultTopic: string; topics: string[] }) {
  const router = useRouter();
  const [rawDraft, setRawDraft] = useState("");
  const [topic, setTopic] = useState(topics.includes(defaultTopic) ? defaultTopic : topics[0]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rawDraft.trim().length < 15) {
      setError("Опишите задачу хотя бы одним-двумя предложениями.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const task = await api.createTask({ businessId, topic, rawDraft });
      router.push(`/business/tasks/${task.id}/clarify`);
    } catch (err) {
      const byField = issuesByField(err);
      setError(byField.rawDraft ?? byField.topic ?? errorText(err));
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit} noValidate aria-busy={busy}>
      <div className="panel-head">
        <h2>Черновик</h2>
        <button className="demo" type="button" onClick={() => setRawDraft(EXAMPLE)} disabled={busy}>
          демо: вставить слабый черновик
        </button>
      </div>
      <div className="form-row">
        <label htmlFor="raw">Что случилось и что хотите получить? Пишите как есть — хоть в двух словах.</label>
        <textarea
          id="raw"
          className={`field field--raw${error ? " is-invalid" : ""}`}
          rows={4}
          value={rawDraft}
          onChange={(e) => {
            setRawDraft(e.target.value);
            if (error) setError("");
          }}
          placeholder="Например: заявки теряются, клиенты уходят к конкурентам. Хотим разобраться и что-то автоматизировать."
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "raw-err" : undefined}
          disabled={busy}
        />
        {error && (
          <p className="field-error" id="raw-err">
            {error}
          </p>
        )}
      </div>
      <div className="form-row" style={{ maxWidth: 320 }}>
        <label htmlFor="topic">Отрасль</label>
        <select id="topic" className="field" value={topic} onChange={(e) => setTopic(e.target.value)} disabled={busy}>
          {topics.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="actions">
        <button className="btn btn-accent" type="submit" disabled={busy}>
          {busy && <span className="spin" aria-hidden="true" />}
          {busy ? "ИИ разбирает черновик…" : "Разобрать черновик"}
        </button>
        {busy && <span className="panel-note">Обычно это занимает 5–15 секунд.</span>}
      </div>
    </form>
  );
}
