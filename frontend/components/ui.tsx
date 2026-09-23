import type { CatalogItem, CriterionResult, Level } from "@/lib/types";

export function Tier({ level, large = false }: { level: Pick<Level, "id" | "name">; large?: boolean }) {
  return <span className={`tier tier--${level.id}${large ? " tier--lg" : ""}`}>{level.name}</span>;
}

/** Мини-разбор семи пунктов в строке каталога: ширина отрезка = вес пункта */
export function SplitBar({ points }: { points: CatalogItem["points"] }) {
  return (
    <span className="split" aria-hidden="true">
      {points.map((p) => (
        <i key={p.id} style={{ flex: p.max, ["--f" as string]: p.earned / p.max }} />
      ))}
    </span>
  );
}

/**
 * Разбор очков: каждый отрезок — одна проверка формулы.
 * confirmed — подтверждённое состояние; если current отличается, новые отрезки заштрихованы.
 */
export function StatList({
  current,
  confirmed,
  compact = false,
  onMissing,
}: {
  current: CriterionResult[];
  confirmed?: CriterionResult[];
  compact?: boolean;
  onMissing?: (field: string) => void;
}) {
  return (
    <ol className={`stat-list${compact ? " stat-list--compact" : ""}`}>
      {current.map((c, ci) => {
        const was = confirmed?.[ci] ?? c;
        const wait = c.earned - was.earned;
        const miss = c.checks.filter((ch) => !ch.ok);
        return (
          <li className="stat" key={c.id}>
            <span className="stat-name">{c.name}</span>
            <span className="stat-bar" aria-label={`${c.name}: ${was.earned} из ${c.max}`}>
              {c.checks.map((ch, j) => {
                const pending = ch.ok && !was.checks[j]?.ok;
                const cls = !ch.ok ? "is-miss" : pending ? "is-pending" : "is-ok";
                return <span key={ch.label} className={`stat-seg ${cls}`} style={{ flex: ch.points }} title={`${ch.label} · ${ch.points}`} />;
              })}
            </span>
            <span className="stat-pts">
              <b>{was.earned}</b>
              <small>/{c.max}</small>
              {wait > 0 && <span className="stat-wait">+{wait}</span>}
            </span>
            {!compact && miss.length > 0 && (
              <div className="stat-miss">
                {miss.map((ch) =>
                  onMissing ? (
                    <button type="button" key={ch.label} onClick={() => onMissing(ch.field)}>
                      +{ch.points} · {ch.label}
                    </button>
                  ) : (
                    <span key={ch.label}>
                      +{ch.points} · {ch.label}
                    </span>
                  ),
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Полоса табло: семь блоков по весу пунктов */
export function SegBar({ criteria }: { criteria: CriterionResult[] }) {
  return (
    <div className="segbar" role="img" aria-label={criteria.map((c) => `${c.short} ${c.earned} из ${c.max}`).join(", ")}>
      {criteria.map((c) => (
        <div key={c.id} className={`seg-block${c.earned === 0 ? " is-zero" : ""}`} style={{ flex: c.max }}>
          <div className="seg-track">
            <i style={{ transform: `scaleX(${c.earned / c.max})` }} />
          </div>
          <div className="seg-cap">
            <span>{c.short}</span>
            <b>
              {c.earned}/{c.max}
            </b>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ title, text }: { title: string; text: string }) {
  return (
    <div className="wrap state-page">
      <h1 className="display display--md">{title}</h1>
      <p className="muted">{text}</p>
    </div>
  );
}
