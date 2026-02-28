import { NavLink } from 'react-router-dom';

const navSections = [
  {
    title: 'ADMIN',
    items: [
      { to: '/admin/catalog', label: 'Catalog', icon: 'CatalogIcon' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { to: '/admin/profit', label: 'Profit', icon: 'ProfitIcon' },
      { to: '/admin/visitors', label: 'Visitors', icon: 'VisitorsIcon' },
    ],
  },
];

function CatalogIcon({ active }: { active: boolean }) {
  const color = active ? '#22c55e' : 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function ProfitIcon({ active }: { active: boolean }) {
  const color = active ? '#22c55e' : 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function VisitorsIcon({ active }: { active: boolean }) {
  const color = active ? '#22c55e' : 'currentColor';
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const iconMap: Record<string, React.FC<{ active: boolean }>> = {
  CatalogIcon,
  ProfitIcon,
  VisitorsIcon,
};

type Props = { onLogout: () => void };

export default function AdminSidebar({ onLogout }: Props) {
  return (
    <aside className="admin-sidebar">
      <nav className="admin-sidebar-nav">
        {navSections.map((section) => (
          <div key={section.title} className="admin-sidebar-section">
            <div className="admin-sidebar-section-title">{section.title}</div>
            <ul className="admin-sidebar-list">
              {section.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/admin/catalog'}
                    className={({ isActive }) =>
                      `admin-sidebar-link ${isActive ? 'admin-sidebar-link--active' : ''}`
                    }
                  >
                    {({ isActive }) => {
                      const Icon = iconMap[item.icon];
                      return (
                        <>
                          {Icon ? <Icon active={isActive} /> : null}
                          <span>{item.label}</span>
                        </>
                      );
                    }}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <button type="button" onClick={onLogout} className="admin-sidebar-logout" aria-label="Log out">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
}
