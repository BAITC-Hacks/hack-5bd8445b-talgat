"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScoreNumber, useFlashOnChange, useFlip } from "@/components/motion";
import { useToast } from "@/components/Toast";
import { SegBar, Tier } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { plural } from "@/lib/format";
import type { CardField, Clarification, Meta, Preview, Task } from "@/lib/types";

// Ответы для демонстрации на сидовом черновике про курьеров (кнопка видна только на нём)
const DEMO_ANSWERS: Partial<Record<CardField, string>> = {
  context: "Диспетчер вручную раздаёт заказы в общем чате. Опоздания в основном вечером, с 18 до 21, и в дальних районах — Алатауском и Наурызбайском.",
  need: "Нужно, чтобы диспетчер сразу отдавал заказ курьеру, который успеет вовремя.",
  data: "Выгрузка из 1С за 6 месяцев — около 48 000 доставок в Excel: адрес, время заказа, время доставки, курьер. GPS-треков нет.",
  expectedResult: "Прототип подсказки для диспетчера: какому курьеру отдать заказ. И короткий отчёт о причинах опозданий.",
  successCriteria: "Доля опозданий больше 15 минут снизится с 23% до 12% на пилоте в одном районе.",
  constraints: "Пилот — до конца ноября. Работаем только с обезличенной выгрузкой, без доступа к 1С.",
  users: "Диспетчеры — 4 человека в смену — и руководитель службы доставки.",
  format: "Созвон раз в неделю по четвергам, вопросы — в Telegram, отвечаем в течение дня.",
};

type Row = { id: string; title: string; score: number; mine?: boolean };

export function ClarifyView({ task, others, meta }: { task: Task; others: Row[]; meta: Meta }) {
  const router = useRouter();
  const toast = useToast();
  const [clarification, setClarification] = useState<Clarification>(task.clarification!);
  const [answers, setAnswers] = useState<Record<string, string>>(() => Object.fromEntries(task.clarification!.questions.map((q) => [q.id, q.answer])));
  const [preview, setPreview] = useState<Preview>(task.preview!);
  const [rawDraft, setRawDraft] = useState(task.rawDraft);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [busy, setBusy] = useState<"" | "structure" | "analyze">("");
  const [error, setError] = useState("");
  const [startRank] = useState(task.preview!.rank);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tierRef = useFlashOnChange(preview.level.id);
  const isDemo = task.rawDraft.includes("Курьеры часто опаздывают");

  const critName = (id: string) => meta.criteria.find((c) => c.id === id)?.name ?? id;
  const fieldLabel = (id: string) => meta.fields.find((f) => f.id === id)?.label ?? id;
  const missingOn = (field: CardField) =>
    preview.criteria.flatMap((c) => c.checks).filter((ch) => ch.field === field && !ch.ok).reduce((s, ch) => s + ch.points, 0);
  const earnedOn = (field: CardField) =>
    preview.criteria.flatMap((c) => c.checks).filter((ch) => ch.field === field && ch.ok).reduce((s, ch) => s + ch.points, 0);

  function scheduleSave(next: Record<string, string>) {
    if (timer.current) clearTimeout(timer.current);
    setSaving("saving");
    timer.current = setTimeout(async () => {
      try {
        const res = await api.saveAnswers(task.id, next);
        setPreview(res.preview);
        setSaving("saved");
      } catch {
        setSaving("error");
      }
    }, 350);
  }

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function setAnswer(id: string, value: string) {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    scheduleSave(next);
  }

  async function reanalyze() {
    const hasAnswers = Object.values(answers).some((a) => a.trim());
    if (hasAnswers && !window.confirm("Вопросы составятся заново, текущие ответы сбросятся. Продолжить?")) return;
    setBusy("analyze");
    setError("");
    try {
      const updated = await api.reanalyze(task.id, { rawDraft });
      setClarification(updated.clarification!);
      setAnswers(Object.fromEntries(updated.clarification!.questions.map((q) => [q.id, q.answer])));
      setPreview(updated.preview!);
      toast(updated.clarification!.source === "openai" ? "ИИ разобрал черновик заново" : "Черновик разобран по локальным правилам");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy("");
    }
  }

  async function buildCard() {
    if (timer.current) {
      clearTimeout(timer.current);
      await api.saveAnswers(task.id, answers).catch(() => null);
    }
    setBusy("structure");
    setError("");
    try {
      await api.structure(task.id);
      router.push(`/business/tasks/${task.id}`);
    } catch (err) {
      setError(errorText(err));
      setBusy("");
    }
  }

  const rows: Row[] = useMemo(
    () => [...others, { id: task.id, title: task.title || "Ваша задача", score: preview.total, mine: true }].sort((a, b) => b.score - a.score || (a.mine ? 1 : -1)),
    [others, task.id, task.title, preview.total],
  );
  const boardRef = useFlip<HTMLOListElement>(rows.map((r) => r.id).join());
  const nextLevel = meta.levels.find((l) => l.min > preview.total);
  const extracted = clarification.extracted.fields;
  const known = meta.fields.filter((f) => extracted[f.id]?.trim());
  const unknown = meta.fields.filter((f) => !extracted[f.id]?.trim());
  const answeredCount = clarification.questions.filter((q) => answers[q.id]?.trim()).length;

  return (
    <section className="screen" aria-labelledby="draft-title">
      <div className="wrap page-top">
        <p className="kicker">
          <Link href="/business">Кабинет</Link> · {task.business.name} · {task.topic}
        </p>
        <h1 id="draft-title" className="display display--lg">
          Разбор черновика
        </h1>
      </div>

      <div className="scoreboard is-sticky on-board">
        <div className="wrap sb-row">
          <div className="sb-score" aria-live="polite">
            <ScoreNumber className="sb-num" value={preview.total} />
            <span className="sb-unit">
              очков
              <br />
              предварительно
            </span>
          </div>
          <div className="sb-facts">
            <div>
              <span className="sb-label">Уровень</span>
              <span ref={tierRef}>
                <Tier level={preview.level} large />
              </span>
            </div>
            <div>
              <span className="sb-label">Место в таблице</span>
              <span className="sb-place">
                {preview.rank}
                <small>из {others.length + 1}</small>
                {preview.rank < startRank && <span className="up">▲{startRank - preview.rank}</span>}
              </span>
            </div>
            <div>
              <span className="sb-label">До следующего уровня</span>
              <span className="sb-next">{nextLevel ? <>{nextLevel.name} через <b>{nextLevel.min - preview.total}</b></> : <b>Максимум</b>}</span>
            </div>
          </div>
          <SegBar criteria={preview.criteria} />
        </div>
      </div>

      <div className="wrap draft-grid">
        <div className="draft-main">
          <section className="panel" aria-labelledby="raw-title">
            <div className="panel-head">
              <h2 id="raw-title">Ваш черновик</h2>
              <button className="btn btn-ghost btn-sm" type="button" onClick={reanalyze} disabled={busy !== ""}>
                {busy === "analyze" && <span className="spin" aria-hidden="true" />}
                {busy === "analyze" ? "Разбираем…" : "Разобрать заново"}
              </button>
            </div>
            <label className="visually-hidden" htmlFor="raw">
              Текст черновика
            </label>
            <textarea id="raw" className="field field--raw" rows={2} value={rawDraft} onChange={(e) => setRawDraft(e.target.value)} />
            <ul className="parsed" aria-label="Что понятно из черновика">
              {known.map((f) => (
                <li key={f.id}>
                  <b>Есть</b> {f.label.toLowerCase()}
                </li>
              ))}
              {unknown.length > 0 && (
                <li className="is-miss">
                  <b>Нет</b> {unknown.map((f) => f.label.toLowerCase()).join(", ")}
                </li>
              )}
            </ul>
            <p className="ai-source">
              <span>
                Вопросы составил: <b>{clarification.source === "openai" ? `ИИ (OpenAI, ${clarification.model})` : "локальные правила"}</b>
              </span>
              <Link href="/ai">Промпт и правила ИИ</Link>
            </p>
            {clarification.warnings.map((w) => (
              <p className="note" key={w}>
                {w}
              </p>
            ))}
          </section>

          <section aria-labelledby="q-title">
            <div className="section-head">
              <h2 id="q-title" className="display display--sm">
                Вопросы, которые поднимут задачу
              </h2>
              <p>
                ИИ спрашивает только о том, чего не хватает. От себя он фактов не добавляет: в карточку попадут ваши ответы, а баллы посчитает формула. Всё можно поправить на следующем шаге.
              </p>
            </div>
            <ol className="rounds">
              {clarification.questions.map((q, i) => {
                const answered = Boolean(answers[q.id]?.trim());
                const gain = answered ? earnedOn(q.field) : missingOn(q.field);
                return (
                  <li className={`round${answered ? " is-answered" : ""}`} key={q.id}>
                    <div className="round-side">
                      <span className="round-label">Вопрос {i + 1}</span>
                      <span className="round-gain">+{gain}</span>
                      <span className="round-crit">{critName(q.criterion)}</span>
                    </div>
                    <div className="round-body">
                      <label className="round-q" htmlFor={`${q.id}-a`}>
                        {q.text}
                      </label>
                      {q.why && <p className="round-why">{q.why}</p>}
                      <textarea id={`${q.id}-a`} className="field" rows={2} placeholder="Ответ своими словами" value={answers[q.id] ?? ""} onChange={(e) => setAnswer(q.id, e.target.value)} />
                      <div className="round-foot">
                        <span className={`round-state ${answered ? "is-ok" : "is-miss"}`}>
                          {answered
                            ? `Пункт «${fieldLabel(q.field)}»: ${gain} ${plural(gain, ["очко", "очка", "очков"])}`
                            : gain > 0
                              ? `Без ответа — можно получить до +${gain}`
                              : "Без ответа"}
                        </span>
                        {isDemo && !answered && DEMO_ANSWERS[q.field] && (
                          <button className="demo" type="button" onClick={() => setAnswer(q.id, DEMO_ANSWERS[q.field]!)}>
                            демо: подставить ответ
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {error && <p className="alert">{error}</p>}
          <div className="actions">
            <button className="btn btn-accent" type="button" onClick={buildCard} disabled={busy !== ""}>
              {busy === "structure" && <span className="spin" aria-hidden="true" />}
              {busy === "structure" ? "ИИ собирает карточку…" : "Собрать карточку →"}
            </button>
            <Link className="btn btn-ghost" href="/business">
              Сохранить и выйти
            </Link>
            <span className="panel-note" aria-live="polite">
              {answeredCount} из {clarification.questions.length} ответов · {saving === "saving" ? "сохраняем…" : saving === "saved" ? "сохранено" : saving === "error" ? "не удалось сохранить — проверьте API" : "ответы сохраняются сами"}
            </span>
          </div>
        </div>

        <aside aria-labelledby="mini-title">
          <div className="sticky">
            <div className="panel">
              <div className="panel-head">
                <h2 id="mini-title">Где окажется задача</h2>
              </div>
              <ol className="mini-board" ref={boardRef}>
                {rows.map((r, i) => (
                  <li key={r.id} data-id={r.id} className={r.mine ? "is-mine" : undefined}>
                    <span className="pos">{i + 1}</span>
                    <span className="t">{r.mine ? `Ваша: ${r.title}` : r.title}</span>
                    <span className="pts">{r.score}</span>
                  </li>
                ))}
              </ol>
              <p className="panel-note">Таблица сортируется по очкам. Каждый ответ поднимает задачу выше. Место закрепится после подтверждения и публикации.</p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
