"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ScoreNumber, useFlashOnChange } from "@/components/motion";
import { useToast } from "@/components/Toast";
import { StatList, Tier } from "@/components/ui";
import { api, errorText, issuesByField } from "@/lib/api";
import { dateTime, points } from "@/lib/format";
import type { CardField, CardFields, Evaluation, Meta, Task } from "@/lib/types";

const rankFor = (score: number, others: number[]) => 1 + others.filter((s) => s >= score).length;

export function CardEditor({ task: initial, meta, otherScores }: { task: Task; meta: Meta; otherScores: number[] }) {
  const router = useRouter();
  const toast = useToast();
  const proposed = initial.clarification?.proposed ?? null;

  const [task, setTask] = useState(initial);
  const [title, setTitle] = useState(proposed?.title || initial.title);
  const [topic, setTopic] = useState(initial.topic);
  const [fields, setFields] = useState<CardFields>(proposed?.fields ?? initial.fields);
  const [preview, setPreview] = useState<Evaluation>(initial.evaluation);
  const [busy, setBusy] = useState<"" | "confirm" | "publish">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiNote, setAiNote] = useState(proposed);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tierRef = useFlashOnChange(task.evaluation.level.id);

  const confirmed = task.fields;
  const changedFields = meta.fields.filter((f) => (fields[f.id] ?? "") !== (confirmed[f.id] ?? ""));
  const dirty = changedFields.length > 0 || title.trim() !== task.title || topic !== task.topic;
  const published = task.status === "PUBLISHED";

  // Предпросмотр баллов для неподтверждённых правок считает та же формула на сервере
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.scorePreview(fields).then(setPreview).catch(() => null);
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [fields]);

  const setField = (id: CardField) => (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setFields((f) => ({ ...f, [id]: value }));
  };

  function focusField(field: string) {
    const el = document.getElementById(`cf-${field}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  }

  async function confirm(): Promise<Task | null> {
    setBusy("confirm");
    setErrors({});
    try {
      const saved = await api.confirm(task.id, { title: title.trim(), topic, fields });
      setTask(saved);
      setFields(saved.fields);
      setTitle(saved.title);
      setAiNote(null);
      return saved;
    } catch (err) {
      const byField = issuesByField(err);
      setErrors(Object.keys(byField).length ? byField : { form: errorText(err) });
      return null;
    } finally {
      setBusy("");
    }
  }

  async function onConfirm() {
    const saved = await confirm();
    if (saved) toast(`Подтверждено: ${points(saved.score)}, уровень «${saved.evaluation.level.name}»`);
  }

  async function onPublish() {
    if (published && !dirty) {
      router.push("/catalog");
      return;
    }
    let current: Task | null = task;
    if (dirty) current = await confirm();
    if (!current) return;
    setBusy("publish");
    try {
      const done = await api.publish(current.id);
      setTask(done);
      toast(`Задача в таблице: ${done.rank}-е место из ${done.catalogSize}`, { href: "/catalog", label: "Открыть таблицу" });
      router.refresh();
    } catch (err) {
      setErrors({ form: errorText(err) });
    } finally {
      setBusy("");
    }
  }

  const delta = preview.total - task.score;
  const nextRank = rankFor(preview.total, otherScores);
  const currentRank = published ? task.rank : rankFor(task.score, otherScores);

  return (
    <section className="screen" aria-labelledby="card-h">
      <div className="wrap page-top">
        <p className="kicker">
          <Link href={`/business/tasks/${task.id}/clarify`}>← К вопросам</Link> · Карточка задачи · {published ? "опубликована" : "не опубликована"}
          {published && (
            <>
              {" "}
              · <Link href={`/business?task=${task.id}`}>заявки: {task.proposalsCount}</Link>
            </>
          )}
        </p>
        <h1 id="card-h" className="visually-hidden">
          Карточка задачи
        </h1>
        <label className="visually-hidden" htmlFor="c-title">
          Название задачи
        </label>
        <textarea id="c-title" className={`title-input${errors.title ? " is-invalid" : ""}`} rows={1} value={title} onChange={(e) => setTitle(e.target.value)} />
        {errors.title && <p className="field-error">{errors.title}</p>}
        <div className="card-meta">
          <span>{task.business.name}</span>
          <label>
            Тема{" "}
            <select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Тема задачи">
              {meta.topics.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <span>Черновик: «{task.rawDraft.length > 90 ? `${task.rawDraft.slice(0, 90)}…` : task.rawDraft}»</span>
        </div>
      </div>

      <div className="scoreboard is-sticky on-board">
        <div className="wrap sb-row">
          <div className="sb-score" aria-live="polite">
            <ScoreNumber className="sb-num" value={task.score} />
            <span className="sb-unit">
              очков
              <br />
              подтверждено
            </span>
          </div>
          <div className="sb-facts">
            <div>
              <span className="sb-label">Уровень</span>
              <span ref={tierRef}>
                <Tier level={task.evaluation.level} large />
              </span>
            </div>
            <div>
              <span className="sb-label">{published ? "Место в таблице" : "Место после публикации"}</span>
              <span className="sb-place">
                {currentRank}
                <small>из {published ? task.catalogSize : otherScores.length + 1}</small>
              </span>
            </div>
          </div>
          <p className="sb-pending" aria-live="polite">
            {dirty ? (
              <>
                Неподтверждённые правки: <b>{delta >= 0 ? `+${delta}` : delta}</b>. После подтверждения — <b>{preview.total}</b>, «{preview.level.name}», место {nextRank}.
              </>
            ) : preview.missing.length ? (
              <>
                Всё подтверждено. Добрать ещё можно <b>+{preview.missing.reduce((s, m) => s + m.points, 0)}</b> — см. разбор ниже.
              </>
            ) : (
              <>Всё подтверждено. Это максимум — задача выделена в таблице.</>
            )}
          </p>
          <div className="sb-actions">
            <button className="btn btn-on-board" type="button" onClick={onConfirm} disabled={!dirty || busy !== ""}>
              {busy === "confirm" && <span className="spin" aria-hidden="true" />}
              Подтвердить
            </button>
            <button className="btn btn-accent" type="button" onClick={onPublish} disabled={busy !== ""}>
              {busy === "publish" && <span className="spin" aria-hidden="true" />}
              {published ? (dirty ? "Подтвердить и обновить" : "Открыть в таблице") : dirty ? "Подтвердить и опубликовать" : "Опубликовать"}
            </button>
          </div>
        </div>
      </div>

      <div className="wrap">
        {errors.form && <p className="alert" style={{ marginTop: 24 }}>{errors.form}</p>}
        {aiNote && (
          <div className="note" style={{ marginTop: 24 }}>
            Карточку собрал{" "}
            <b>{aiNote.source === "openai" ? `ИИ (OpenAI, ${aiNote.model})` : "локальный разбор без ИИ"}</b> из черновика и ваших ответов. Проверьте поля: баллы засчитаются только после подтверждения.
            {aiNote.warnings.length > 0 && (
              <ul style={{ marginTop: 8, paddingLeft: 18, listStyle: "disc" }}>
                {aiNote.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <section className="stats" aria-labelledby="stats-title">
          <div className="section-head section-head--row">
            <h2 id="stats-title" className="display display--sm">
              Разбор очков
            </h2>
            <p>Каждый отрезок — одна проверка формулы. Заштрихованные ждут подтверждения, пустые подсказывают, что добавить.</p>
          </div>
          <StatList current={preview.criteria} confirmed={task.evaluation.criteria} onMissing={focusField} />
        </section>

        <section className="fields" aria-labelledby="fields-title">
          <div className="section-head section-head--row">
            <h2 id="fields-title" className="display display--sm">
              Поля карточки
            </h2>
            <p>Правьте любое поле. Очки обновятся, когда вы подтвердите изменения.</p>
          </div>
          <div className="field-grid">
            {meta.fields.map((f) => {
              const changed = (fields[f.id] ?? "") !== (confirmed[f.id] ?? "");
              const empty = !(fields[f.id] ?? "").trim();
              const crit = meta.criteria.find((c) => c.id === f.criterion)?.name;
              return (
                <div key={f.id} className={`fbox${changed ? " is-changed" : ""}${empty ? " is-empty" : ""}`}>
                  <div className="fbox-head">
                    <label htmlFor={`cf-${f.id}`}>{f.label}</label>
                    {crit && crit !== f.label && <span className="fbox-crit">{crit}</span>}
                  </div>
                  <textarea id={`cf-${f.id}`} className={`field${errors[f.id] ? " is-invalid" : ""}`} rows={2} value={fields[f.id] ?? ""} onChange={setField(f.id)} placeholder={f.placeholder} />
                  {changed && <span className="fbox-flag">Изменено — подтвердите, чтобы очки засчитались</span>}
                  {errors[f.id] && <p className="field-error">{errors[f.id]}</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="fields" aria-labelledby="hist-title">
          <div className="section-head section-head--row">
            <h2 id="hist-title" className="display display--sm">
              История рейтинга
            </h2>
            <p>Каждое подтверждение пересчитывает очки и попадает сюда.</p>
          </div>
          {task.history.length === 0 ? (
            <p className="muted">Пока пусто: подтвердите карточку — и появится первая запись.</p>
          ) : (
            <ol className="history">
              {task.history.map((h, i) => {
                const d = i > 0 ? h.score - task.history[i - 1].score : 0;
                return (
                  <li key={`${h.createdAt}-${i}`}>
                    <span className="h-score">{h.score}</span>
                    <span className="h-delta">{d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : "—"}</span>
                    <span>{h.reason}</span>
                    <span className="h-time">{dateTime(h.createdAt)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>
    </section>
  );
}
