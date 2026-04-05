import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type ToastType = 'success' | 'error' | 'info';

type ToastItem = { id: string; message: string; type: ToastType };

const AUTO_DISMISS_MS = 3500;

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  /** Remove all visible toasts (e.g. wallet disconnect on Blockchain demo). */
  clearAll: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const baseId = useId();

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const push = useCallback((message: string, type: ToastType) => {
    const id = `${baseId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [baseId, dismiss]);

  const success = useCallback((message: string) => push(message, 'success'), [push]);
  const errorFn = useCallback((message: string) => push(message, 'error'), [push]);
  const info = useCallback((message: string) => push(message, 'info'), [push]);

  const value = useMemo<ToastContextValue>(
    () => ({
      success,
      error: errorFn,
      info,
      clearAll,
    }),
    [success, errorFn, info, clearAll]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          top: '1rem',
          right: '1rem',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          maxWidth: 'min(360px, calc(100vw - 2rem))',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const palette =
            t.type === 'success'
              ? { background: '#ecfdf5', color: '#065f46', border: '#a7f3d0' }
              : t.type === 'info'
                ? { background: '#eff6ff', color: '#1e40af', border: '#93c5fd' }
                : { background: '#fef2f2', color: '#991b1b', border: '#fecaca' };
          return (
            <div
              key={t.id}
              role="status"
              style={{
                pointerEvents: 'auto',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
                background: palette.background,
                color: palette.color,
                border: `1px solid ${palette.border}`,
              }}
            >
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
