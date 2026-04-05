import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiClient, getApiErrorMessage } from '../api';
import { AuthModal, type AuthModalTab } from '../components/AuthModal';
import { useToast } from '../components/ToastProvider';
import { TASKS_AUTH_TOKEN_KEY } from '../lib/apiWriteAuth';

const USER_KEY = 'tasks_auth_username';

type AuthContextValue = {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
  logout: () => void;
  openAuthModal: (tab?: AuthModalTab) => void;
  closeAuthModal: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function parseAuthResponse(data: unknown): { token: string; username: string } | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  if (typeof o.token !== 'string' || typeof o.username !== 'string') return null;
  return { token: o.token, username: o.username };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TASKS_AUTH_TOKEN_KEY));
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USER_KEY));
  const [modal, setModal] = useState<{ open: boolean; tab: AuthModalTab }>({ open: false, tab: 'login' });

  const persistSession = useCallback((t: string, u: string) => {
    localStorage.setItem(TASKS_AUTH_TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, u);
    setToken(t);
    setUsername(u);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TASKS_AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.reload();
  }, []);

  const openAuthModal = useCallback((tab: AuthModalTab = 'login') => {
    setModal({ open: true, tab });
  }, []);

  const closeAuthModal = useCallback(() => {
    setModal((m) => ({ ...m, open: false }));
  }, []);

  const submitLogin = useCallback(
    async (u: string, p: string) => {
      try {
        const raw = await apiClient.default.login({ username: u, password: p });
        const parsed = parseAuthResponse(raw);
        if (!parsed) throw new Error('Unexpected login response');
        persistSession(parsed.token, parsed.username);
        toast.success('Signed in.');
        closeAuthModal();
      } catch (e) {
        toast.error(getApiErrorMessage(e));
        throw e;
      }
    },
    [closeAuthModal, persistSession, toast]
  );

  const submitRegister = useCallback(
    async (u: string, p: string) => {
      try {
        const raw = await apiClient.default.register({ username: u, password: p });
        const parsed = parseAuthResponse(raw);
        if (!parsed) throw new Error('Unexpected register response');
        persistSession(parsed.token, parsed.username);
        toast.success('Account created. You are signed in.');
        closeAuthModal();
      } catch (e) {
        toast.error(getApiErrorMessage(e));
        throw e;
      }
    },
    [closeAuthModal, persistSession, toast]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      username,
      isAuthenticated: Boolean(token),
      logout,
      openAuthModal,
      closeAuthModal,
    }),
    [token, username, logout, openAuthModal, closeAuthModal]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AuthModal
        open={modal.open}
        tab={modal.tab}
        onTabChange={(tab) => setModal((m) => ({ ...m, tab }))}
        onClose={closeAuthModal}
        onLogin={submitLogin}
        onRegister={submitRegister}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
