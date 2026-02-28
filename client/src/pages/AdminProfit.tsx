export default function AdminProfit() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Profit</h1>
      </header>
      <p className="admin-page-lead">
        Totals and graphs for listed items, sold items, and profit. Data will appear here once connected.
      </p>
      <section className="admin-section">
        <h2>Summary</h2>
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-label">Listed</div>
            <div className="admin-stat-value">—</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Sold</div>
            <div className="admin-stat-value">—</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Total profit</div>
            <div className="admin-stat-value">—</div>
          </div>
        </div>
      </section>
      <section className="admin-section">
        <h2>Charts</h2>
        <div className="admin-chart-placeholder">
          <p>Profit over time (daily / weekly / monthly) — chart placeholder</p>
        </div>
        <div className="admin-chart-placeholder">
          <p>Listed vs sold — chart placeholder</p>
        </div>
      </section>
    </div>
  );
}
