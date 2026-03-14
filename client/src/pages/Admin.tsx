import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { adminMe } from '../api';
import AdminLogin from '../components/AdminLogin';
import AdminLayout from '../components/AdminLayout';
import AdminPanel from '../components/AdminPanel';
import AdminProfit from './AdminProfit';
import AdminVisitors from './AdminVisitors';
import AdminSettings from './AdminSettings';

export default function Admin() {
  const [auth, setAuth] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    adminMe().then(setAuth).catch(() => setAuth(false));
  }, []);

  if (auth === null) return <div style={{ padding: 20 }}>Loading...</div>;
  if (auth === false) {
    return (
      <AdminLogin
        onSuccess={() => {
          setAuth(true);
          navigate('/admin/catalog', { replace: true });
        }}
      />
    );
  }

  const handleLogout = () => {
    fetch('/api/admin/logout', { method: 'POST', credentials: 'include' })
      .then(() => setAuth(false));
  };

  // Logged in: show layout and pick content from URL (no nested Routes)
  if (pathname === '/admin' || pathname === '/admin/') {
    navigate('/admin/catalog', { replace: true });
    return <AdminLayout onLogout={handleLogout}><div style={{ padding: 20 }}>Loading...</div></AdminLayout>;
  }

  let content: React.ReactNode;
  if (pathname === '/admin/catalog') {
    content = <AdminPanel onUnauthorized={() => setAuth(false)} />;
  } else if (pathname === '/admin/profit') {
    content = <AdminProfit />;
  } else if (pathname === '/admin/visitors') {
    content = <AdminVisitors />;
  } else if (pathname === '/admin/settings') {
    content = <AdminSettings />;
  } else {
    navigate('/admin/catalog', { replace: true });
    content = <div style={{ padding: 20 }}>Loading...</div>;
  }

  return (
    <AdminLayout onLogout={handleLogout}>
      {content}
    </AdminLayout>
  );
}
