/** A calm skeleton in the page's own shape while the server reads, instead of a blank screen. */
export default function AdminLoading() {
  return (
    <div className="admin-skeleton" aria-busy="true" aria-live="polite">
      <span className="sr-only">Yuklanmoqda</span>
      <div className="admin-skeleton-line" style={{ width: "18%" }} />
      <div className="admin-skeleton-line admin-skeleton-title" style={{ width: "42%" }} />
      <div className="admin-skeleton-grid">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="admin-skeleton-block" />
        ))}
      </div>
      <div className="admin-skeleton-block admin-skeleton-table" />
    </div>
  );
}
