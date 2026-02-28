export default function AdminVisitors() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1>Visitors</h1>
      </header>
      <p className="admin-page-lead">
        New and returning visitors, who’s online, item clicks, and FB link clicks. Data will appear here once tracking is connected.
      </p>
      <section className="admin-section">
        <h2>Overview</h2>
        <div className="admin-stats-grid">
          <div className="admin-stat-card">
            <div className="admin-stat-label">Online now</div>
            <div className="admin-stat-value">—</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">New visitors (today)</div>
            <div className="admin-stat-value">—</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">Returning visitors (today)</div>
            <div className="admin-stat-value">—</div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-label">FB link clicks</div>
            <div className="admin-stat-value">—</div>
          </div>
        </div>
      </section>
      <section className="admin-section">
        <h2>Charts</h2>
        <div className="admin-chart-placeholder">
          <p>New vs returning visitors (daily / weekly / monthly) — chart placeholder</p>
        </div>
        <div className="admin-chart-placeholder">
          <p>Most clicked items — chart placeholder</p>
        </div>
        <div className="admin-chart-placeholder">
          <p>FB link clicks over time — chart placeholder</p>
        </div>
      </section>
    </div>
  );
}
