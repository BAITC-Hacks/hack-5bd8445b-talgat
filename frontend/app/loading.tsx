export default function Loading() {
  return (
    <div className="wrap state-page" aria-busy="true" aria-label="Загрузка">
      <div className="skeleton" style={{ width: 420, height: 48 }} />
      <div className="skeleton" style={{ width: "100%", height: 96 }} />
      <div className="skeleton" style={{ width: "100%", height: 280 }} />
    </div>
  );
}
