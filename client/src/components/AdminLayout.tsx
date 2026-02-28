import AdminSidebar from './AdminSidebar';

type Props = { onLogout: () => void; children: React.ReactNode };

export default function AdminLayout({ onLogout, children }: Props) {
  return (
    <div className="admin-layout">
      <AdminSidebar onLogout={onLogout} />
      <main className="admin-main">
        {children}
      </main>
    </div>
  );
}
