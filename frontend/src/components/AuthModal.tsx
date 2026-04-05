import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { MODAL_CLOSE_BUTTON_CLASS, modalCloseButtonStyle } from '../styles/modalClose';

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 8000,
  background: 'rgba(15, 23, 42, 0.45)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
};

const cardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  maxWidth: '420px',
  width: '100%',
  boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.03)',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '1.25rem 1.5rem 1rem',
  background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)',
  borderBottom: '1px solid #f1f5f9',
};

const tabRowStyle: CSSProperties = {
  display: 'flex',
  gap: '0.35rem',
  padding: '0 1.5rem',
  marginTop: '0.75rem',
};

const tabBtn = (active: boolean): CSSProperties => ({
  flex: 1,
  padding: '0.5rem 0.75rem',
  borderRadius: '8px',
  border: `1px solid ${active ? '#3b82f6' : '#e2e8f0'}`,
  background: active ? '#eff6ff' : '#fff',
  color: active ? '#1d4ed8' : '#64748b',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
});

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '0.55rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '0.9rem',
};

const primaryBtn: CSSProperties = {
  width: '100%',
  marginTop: '1rem',
  padding: '0.6rem 1rem',
  borderRadius: '8px',
  border: '1px solid #3b82f6',
  background: '#60a5fa',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  boxShadow: '0 1px 3px rgba(96, 165, 250, 0.35)',
};

const primaryBtnPending: CSSProperties = {
  ...primaryBtn,
  opacity: 0.88,
  cursor: 'wait',
};

export type AuthModalTab = 'login' | 'register';

type AuthModalProps = {
  open: boolean;
  tab: AuthModalTab;
  onTabChange: (tab: AuthModalTab) => void;
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (username: string, password: string) => Promise<void>;
};

export function AuthModal({ open, tab, onTabChange, onClose, onLogin, onRegister }: AuthModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) {
      setUsername('');
      setPassword('');
      setPending(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const u = username.trim().toLowerCase();
    const p = password;
    if (!u || !p || pending) return;
    setPending(true);
    try {
      if (tab === 'login') await onLogin(u, p);
      else await onRegister(u, p);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      style={overlayStyle}
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        style={cardStyle}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={headerStyle}>
          <h2 id="auth-modal-title" style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#0f172a' }}>
            {tab === 'login' ? 'Sign in' : 'Create account'}
          </h2>
          <button
            type="button"
            className={MODAL_CLOSE_BUTTON_CLASS}
            style={modalCloseButtonStyle}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={tabRowStyle}>
          <button type="button" style={tabBtn(tab === 'login')} onClick={() => onTabChange('login')}>
            Log in
          </button>
          <button type="button" style={tabBtn(tab === 'register')} onClick={() => onTabChange('register')}>
            Register
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem 1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
            Username
          </label>
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="e.g. alice"
            style={{ ...inputStyle, marginBottom: '0.85rem' }}
          />
          {tab === 'register' && (
            <p style={{ margin: '-0.5rem 0 0.85rem', fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
              2–32 characters: lowercase letters, digits, or underscore.
            </p>
          )}
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
            Password
          </label>
          <input
            type="password"
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tab === 'register' ? 'At least 6 characters' : '••••••••'}
            style={inputStyle}
          />
          <button type="submit" disabled={pending || !username.trim() || !password} style={pending ? primaryBtnPending : primaryBtn}>
            {pending ? 'Please wait…' : tab === 'login' ? 'Sign in' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
}
