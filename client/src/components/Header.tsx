import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DisclaimerBanner from './DisclaimerBanner';
import { getDepartments } from '../api';
import { useMediaQuery } from '../hooks/useMediaQuery';

function FurnitureIcon() {
  return (
    <span className="logo-icon" aria-hidden>
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="40" height="40" fill="currentColor">
        <path d="M8 22v-2c0-2.2 1.8-4 4-4h24c2.2 0 4 1.8 4 4v2h2v4h-2v14h4v4H6v-4h4V26H8v-4H6v-4h2zm4 0h24v-2H12v2zm0 4v14h24V26H12z"/>
      </svg>
    </span>
  );
}

export default function Header() {
  const [searchParams] = useSearchParams();
  const currentDepartment = searchParams.get('department') || null;
  const [departments, setDepartments] = useState<string[]>([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1280px), (max-device-width: 1024px)');

  useEffect(() => {
    getDepartments()
      .then((data) => setDepartments(data.departments ?? []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false);
  }, [isMobile]);

  const categoryLinks = [
    { to: '/', label: 'All' },
    ...departments.map((d) => ({ to: `/?department=${encodeURIComponent(d)}`, label: d })),
  ];

  const isLinkActive = (label: string, to: string) => {
    if (label === 'All') return !currentDepartment;
    return currentDepartment !== null && decodeURIComponent(currentDepartment) === label;
  };

  return (
    <>
      <DisclaimerBanner />
      <header className={`header ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
        <div className="header-inner">
          <div className="header-logo-wrap">
            <Link to="/" className="logo">
              <FurnitureIcon />
              <span className="logo-text">Furniture Overstock Sellout</span>
            </Link>
          </div>
          {isMobile && (
            <button
              type="button"
              className="header-hamburger"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-expanded={mobileNavOpen}
              aria-label="Open menu"
            >
              <span className="header-hamburger-bar" />
              <span className="header-hamburger-bar" />
              <span className="header-hamburger-bar" />
            </button>
          )}
        </div>
        <div className="header-nav-row">
          <div className="header-nav-wrap">
            <nav className="header-nav" aria-label="Categories">
              {categoryLinks.map(({ to, label }) => (
                <Link key={label} to={to} className={isLinkActive(label, to) ? 'header-nav-link active' : 'header-nav-link'}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
        {isMobile && mobileNavOpen && (
          <div className="header-nav-mobile">
            <nav className="header-nav-mobile-inner" aria-label="Categories">
              {categoryLinks.map(({ to, label }) => (
                <Link key={label} to={to} className={isLinkActive(label, to) ? 'active' : ''} onClick={() => setMobileNavOpen(false)}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
