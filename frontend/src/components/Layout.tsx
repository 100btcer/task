import type { CSSProperties } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { getApiBaseUrl } from '../config/apiServer';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../routes/paths';

const navLinkBtn: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  padding: '0.45rem 0.95rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
};

const navUserStyle: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  color: '#475569',
  maxWidth: '12rem',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export function Layout() {
  const { isAuthenticated, username, logout, openAuthModal } = useAuth();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <nav
        style={{
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #eee',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <Link to={ROUTES.HOME}>Home</Link>
          <Link to={ROUTES.API_DEMO}>API Demo</Link>
          <Link to={ROUTES.BLOCKCHAIN_DEMO}>Blockchain Demo</Link>
          <a
            href={`${getApiBaseUrl()}/docs`}
            target="_blank"
            rel="noopener noreferrer"
            title="Swagger UI (opens in a new tab)"
          >
            API docs
          </a>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          {isAuthenticated && username ? (
            <>
              <span style={navUserStyle} title={username}>
                {username}
              </span>
              <button type="button" style={navLinkBtn} onClick={logout}>
                Log out
              </button>
            </>
          ) : (
            <button type="button" style={navLinkBtn} onClick={() => openAuthModal('login')}>
              Log in
            </button>
          )}
        </div>
      </nav>
      <main style={{ flex: 1, padding: '1.5rem' }}>
        <Outlet />
      </main>
      <footer
        style={{
          padding: '0.75rem 1.5rem',
          borderTop: '1px solid #eee',
          fontSize: '0.85rem',
          color: '#64748b',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.65rem 1.25rem',
        }}
      >
        <span>
          Technical test submission — see repository <code>README.md</code> and <code>NOTES.md</code>.
        </span>
        <a
          href={`${getApiBaseUrl()}/docs`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontWeight: 600, color: '#2563eb', textDecoration: 'none', whiteSpace: 'nowrap' }}
        >
          API docs
        </a>
      </footer>
    </div>
  );
}
