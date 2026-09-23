import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap state-page">
      <h1 className="display display--md">Такой страницы нет</h1>
      <p className="muted">Проверьте адрес или вернитесь к таблице задач.</p>
      <Link className="btn btn-accent" href="/catalog">
        Открыть таблицу задач
      </Link>
    </div>
  );
}
