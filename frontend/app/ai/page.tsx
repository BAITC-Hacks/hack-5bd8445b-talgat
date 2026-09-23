import type { Metadata } from "next";
import { ErrorState } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import type { AiInfo } from "@/lib/types";

export const metadata: Metadata = { title: "Как работает ИИ" };

export default async function AiPage() {
  let info: AiInfo;
  try {
    info = await api.aiInfo();
  } catch (err) {
    return <ErrorState title="Сведения об ИИ недоступны" text={errorText(err)} />;
  }

  return (
    <section className="screen" aria-labelledby="ai-title">
      <div className="wrap page-top">
        <p className="kicker">Прозрачность: промпты, формат ответа, защита от выдумок</p>
        <h1 id="ai-title" className="display display--lg">
          Как работает ИИ
        </h1>
        <p className="lead" style={{ marginTop: 16 }}>
          ИИ делает две вещи: разбирает черновик и задаёт уточняющие вопросы, а потом собирает карточку из ответов. Баллы он не ставит — их считает формула. В каталог карточка попадает только после подтверждения человеком.
        </p>
      </div>

      <div className="wrap ai-grid">
        <div className="note">
          Сейчас: <b>{info.provider}</b>
          {info.enabled ? (
            <>
              {" "}
              · модель <b>{info.model}</b>, уровень рассуждений <b>{info.reasoningEffort}</b>
            </>
          ) : (
            " · добавьте OPENAI_API_KEY в .env, чтобы включить модель"
          )}
        </div>

        {info.steps.map((s, i) => (
          <section key={s.id} className="panel" aria-labelledby={`step-${s.id}`}>
            <div className="panel-head">
              <h2 id={`step-${s.id}`}>
                Шаг {i + 1}. {s.title}
              </h2>
              <span className="panel-meta">{s.endpoint}</span>
            </div>
            <div>
              <h3 className="panel-meta" style={{ marginBottom: 8 }}>
                Системный промпт
              </h3>
              <pre className="code">{s.systemPrompt}</pre>
            </div>
            <div className="ai-step">
              <div>
                <h3>Вход: пример сообщения пользователя</h3>
                <pre className="code">{s.inputExample}</pre>
              </div>
              <div>
                <h3>Выход: JSON-схема ответа (Structured Outputs)</h3>
                <pre className="code">{JSON.stringify(s.outputSchema, null, 2)}</pre>
              </div>
            </div>
          </section>
        ))}

        <section aria-labelledby="guards-title">
          <div className="section-head">
            <h2 id="guards-title" className="display display--sm">
              Что будет, если модель ответит некорректно
            </h2>
          </div>
          <ol className="guards">
            {info.safeguards.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ol>
        </section>
      </div>
    </section>
  );
}
