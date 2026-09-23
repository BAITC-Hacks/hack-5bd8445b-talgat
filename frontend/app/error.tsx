"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="wrap state-page">
      <h1 className="display display--md">Что-то пошло не так</h1>
      <p className="muted">{error.message || "Попробуйте обновить страницу."}</p>
      <button className="btn btn-accent" type="button" onClick={reset}>
        Попробовать снова
      </button>
    </div>
  );
}
