import { useState, useEffect, useMemo, useCallback, useRef, type CSSProperties } from 'react';
import { useIsMutating, useMutationState } from '@tanstack/react-query';
import {
  TASKS_CREATE_MUTATION_KEY,
  TASKS_DELETE_MUTATION_KEY,
  TASKS_PATCH_MUTATION_KEY,
} from '../constants/mutationKeys';
import {
  tryAcquireCreateLock,
  tryAcquireDeleteLock,
  tryAcquirePatchLock,
  releaseCreateLock,
  releaseDeleteLock,
  releasePatchLock,
} from '../lib/submitLocks';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api';
import { useTasksList, useTask, useCreateTask, usePatchTask, useDeleteTask, getApiErrorMessage } from '../hooks/useApi';
import { notifyWriteAuthIssue } from '../lib/apiWriteAuth';
import { MODAL_CLOSE_BUTTON_CLASS, modalCloseButtonStyle } from '../styles/modalClose';
import type { PatchTaskRequest } from '../api/openapi';
import { ErrorMessage, Loading, Spinner, useToast } from '../components';
import type { Task } from '../api/openapi';

const PAGE_SIZE = 3;

const statusModalCardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  maxWidth: '440px',
  width: '100%',
  boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.03)',
  overflow: 'hidden',
};

const statusModalHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '1.25rem 1.5rem 1rem',
  background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)',
  borderBottom: '1px solid #f1f5f9',
};

const statusModalTitleStyle: CSSProperties = {
  margin: 0,
  flex: '1 1 auto',
  fontSize: '1.125rem',
  fontWeight: 700,
  color: '#0f172a',
  letterSpacing: '-0.02em',
  lineHeight: 1.35,
};

const statusModalBodyStyle: CSSProperties = {
  padding: '1.1rem 1.5rem 0',
};

const statusModalFooterStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '0.65rem',
  marginTop: '1.35rem',
  padding: '1rem 1.5rem 1.25rem',
  borderTop: '1px solid #f1f5f9',
  background: '#fafafa',
};

const statusModalBtnSecondary: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  padding: '0.55rem 1.15rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#475569',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  minWidth: '5.5rem',
};

const statusModalBtnPrimaryBase: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  padding: '0.55rem 1.2rem',
  borderRadius: '8px',
  border: '1px solid transparent',
  color: '#fff',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
  minWidth: '8.5rem',
};

/** Primary form actions (Create, Save changes) — softer blue, same scale as status modal. */
const primaryFormButtonEnabled: CSSProperties = {
  ...statusModalBtnPrimaryBase,
  background: '#60a5fa',
  borderColor: '#3b82f6',
  boxShadow: '0 1px 3px rgba(96, 165, 250, 0.35)',
};

const primaryFormButtonDisabled: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  padding: '0.55rem 1.2rem',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  background: '#f1f5f9',
  color: '#94a3b8',
  cursor: 'not-allowed',
  boxShadow: 'none',
  minWidth: '8.5rem',
};

const primaryFormButtonPending: CSSProperties = {
  ...primaryFormButtonEnabled,
  opacity: 0.88,
  cursor: 'wait',
};

/** Delete modal — same scale as status modal confirm; soft destructive red. */
const modalDangerButton: CSSProperties = {
  ...statusModalBtnPrimaryBase,
  background: '#f87171',
  borderColor: '#ef4444',
  boxShadow: '0 1px 3px rgba(248, 113, 113, 0.35)',
};

const modalDangerButtonPending: CSSProperties = {
  ...modalDangerButton,
  opacity: 0.88,
  cursor: 'wait',
};

type DeleteTarget = { id: number; title: string };

type StatusToggleTarget = { id: number; title: string; completed: boolean };

type ApiDemoAuthHint =
  | null
  | 'create'
  | { kind: 'list-row'; taskId: number }
  | 'detail-status';

/** Fixed `en-US` locale so dates never follow the OS language (e.g. Chinese numerals). */
function formatTaskDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** List + detail: same pill style, labels `open` / `done`. */
function taskStatusBadgeStyle(completed: boolean): CSSProperties {
  return {
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    padding: '0.2rem 0.55rem',
    borderRadius: '999px',
    flexShrink: 0,
    ...(completed
      ? { background: '#dcfce7', color: '#166534' }
      : { background: '#e2e8f0', color: '#475569' }),
  };
}

function TaskStatusBadge({ completed }: { completed: boolean }) {
  return <span style={taskStatusBadgeStyle(completed)}>{completed ? 'done' : 'open'}</span>;
}

const idBadgeStyle: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: '0.72rem',
  fontWeight: 700,
  color: '#475569',
  background: '#f1f5f9',
  padding: '0.2rem 0.5rem',
  borderRadius: '6px',
  border: '1px solid #e2e8f0',
  flexShrink: 0,
};

const listActionBtn: CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  padding: '0.5rem 0.95rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
};

/** Inline nudge beside actions when the user is not signed in (API Demo). */
const signInBesideButtonHintStyle: CSSProperties = {
  fontSize: '0.78rem',
  color: '#b45309',
  fontWeight: 600,
  lineHeight: 1.35,
  maxWidth: 280,
};

const listMetaLine: CSSProperties = {
  fontSize: '0.78rem',
  color: '#64748b',
  lineHeight: 1.45,
};

function TaskDetailView({ task }: { task: Task }) {
  const desc = task.description?.trim();
  return (
    <section
      style={{
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '1rem 1.1rem',
        marginBottom: '0.75rem',
        textAlign: 'left',
      }}
      aria-label="Task details from API"
    >
      {/* Match list item header: #id left, status pill right */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            minWidth: 0,
            flex: '1 1 8rem',
            justifyContent: 'flex-start',
          }}
        >
          <span style={idBadgeStyle} title="Task id">
            #{task.id}
          </span>
        </div>
        <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
          <TaskStatusBadge completed={task.completed} />
        </div>
      </div>
      <h3
        style={{
          margin: '0.5rem 0 0',
          fontSize: '1.05rem',
          fontWeight: 700,
          color: '#0f172a',
          lineHeight: 1.35,
          textAlign: 'left',
        }}
      >
        {task.title}
      </h3>
      {desc ? (
        <p
          style={{
            margin: '0.35rem 0 0',
            fontSize: '0.85rem',
            color: '#64748b',
            lineHeight: 1.5,
            textAlign: 'left',
          }}
        >
          {desc}
        </p>
      ) : (
        <p
          style={{
            margin: '0.35rem 0 0',
            fontSize: '0.85rem',
            color: '#94a3b8',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          No description
        </p>
      )}
      <div
        style={{
          marginTop: '0.7rem',
          paddingTop: '0.7rem',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.65rem 1.25rem',
          justifyContent: 'flex-start',
        }}
      >
        <span style={listMetaLine}>
          <span style={{ color: '#94a3b8', fontWeight: 600, marginRight: '0.35rem' }}>Created</span>
          {formatTaskDateTime(task.createdAt)}
        </span>
        <span style={listMetaLine}>
          <span style={{ color: '#94a3b8', fontWeight: 600, marginRight: '0.35rem' }}>Updated</span>
          {formatTaskDateTime(task.updatedAt)}
        </span>
      </div>
    </section>
  );
}

export function ApiDemo() {
  const toast = useToast();
  const { isAuthenticated, openAuthModal, logout } = useAuth();

  const onWriteAuthError = useCallback(
    (error: unknown) =>
      notifyWriteAuthIssue(error, {
        toastInfo: (m) => toast.info(m),
        openLoginModal: () => openAuthModal('login'),
        logout,
      }),
    [toast, openAuthModal, logout]
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [statusToggleTarget, setStatusToggleTarget] = useState<StatusToggleTarget | null>(null);
  const [apiAuthHint, setApiAuthHint] = useState<ApiDemoAuthHint>(null);

  const listParams = useMemo(() => ({ page, limit: PAGE_SIZE }), [page]);
  const { data, isLoading, isFetching, error, refetch } = useTasksList(listParams);
  const { data: detail, isLoading: detailLoading, isFetching: detailFetching, error: detailError, refetch: refetchDetail } =
    useTask(selectedId);
  const createTask = useCreateTask();
  const deleteTask = useDeleteTask();
  const patchTask = usePatchTask();

  const createMutating = useIsMutating({ mutationKey: TASKS_CREATE_MUTATION_KEY }) > 0;
  const patchMutating = useIsMutating({ mutationKey: TASKS_PATCH_MUTATION_KEY }) > 0;
  const deleteMutating = useIsMutating({ mutationKey: TASKS_DELETE_MUTATION_KEY }) > 0;

  const pendingPatchVars = useMutationState({
    filters: { mutationKey: [...TASKS_PATCH_MUTATION_KEY], status: 'pending' },
    select: (m) => m.state.variables as { taskId: number; body: PatchTaskRequest } | undefined,
  });
  const patchingTaskId = pendingPatchVars[0]?.taskId;

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1),
    [data]
  );

  useEffect(() => {
    if (data && page > totalPages) setPage(totalPages);
  }, [data, page, totalPages]);

  useEffect(() => {
    if (error instanceof ApiError && error.status === 401) {
      onWriteAuthError(error);
    }
  }, [error, onWriteAuthError]);

  useEffect(() => {
    if (isAuthenticated) setApiAuthHint(null);
  }, [isAuthenticated]);

  useEffect(() => {
    if (detailError instanceof ApiError && detailError.status === 401) {
      onWriteAuthError(detailError);
    }
  }, [detailError, onWriteAuthError]);

  const handleCreate = () => {
    if (!isAuthenticated) {
      setApiAuthHint('create');
      openAuthModal('login');
      return;
    }
    if (!title.trim()) {
      toast.info('Enter a task title first.');
      return;
    }
    if (createTask.isPending || createMutating) return;
    if (!tryAcquireCreateLock()) return;
    createTask.mutate(
      { title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}) },
      {
        onSuccess: () => {
          setTitle('');
          setDescription('');
          toast.success('Task created.');
        },
        onError: (e) => {
          if (onWriteAuthError(e)) createTask.reset();
        },
        onSettled: () => {
          releaseCreateLock();
        },
      }
    );
  };

  const confirmToggleCompleted = () => {
    if (!statusToggleTarget) return;
    if (!isAuthenticated) {
      setApiAuthHint(
        statusToggleTarget.id === selectedId ? 'detail-status' : { kind: 'list-row', taskId: statusToggleTarget.id },
      );
      openAuthModal('login');
      return;
    }
    if (patchMutating || patchTask.isPending) return;
    if (!tryAcquirePatchLock()) return;
    const { id: taskId, completed } = statusToggleTarget;
    const next = !Boolean(completed);
    patchTask.mutate(
      { taskId, body: { completed: next } },
      {
        onSuccess: () => {
          toast.success(next ? 'Marked as done.' : 'Marked as open.');
          setStatusToggleTarget(null);
        },
        onError: (e) => {
          if (onWriteAuthError(e)) patchTask.reset();
        },
        onSettled: () => {
          releasePatchLock();
        },
      }
    );
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    if (!isAuthenticated) {
      setApiAuthHint({ kind: 'list-row', taskId: deleteTarget.id });
      openAuthModal('login');
      return;
    }
    if (deleteMutating || deleteTask.isPending) return;
    if (!tryAcquireDeleteLock()) return;
    const { id } = deleteTarget;
    deleteTask.mutate(id, {
      onSuccess: () => {
        toast.success('Task deleted successfully.');
        setDeleteTarget(null);
        if (selectedId === id) setSelectedId(null);
      },
      onError: (e) => {
        if (onWriteAuthError(e)) deleteTask.reset();
      },
      onSettled: () => {
        releaseDeleteLock();
      },
    });
  };

  const listBusy = isLoading || (isFetching && !isLoading);

  /** Avoid showing a previous task while a new `selectedId` is loading. */
  const detailMatches = Boolean(selectedId && detail && detail.id === selectedId);
  const detailContentLoading = Boolean(
    selectedId && !detailMatches && (detailLoading || detailFetching)
  );

  return (
    <div>
      <h1>API Demo</h1>
      <p>
        This page uses the Tasks REST API. The reference backend is <code>backend-ts/</code> (Node.js + Express + SQLite); the
        contract is <code>docs/api-spec.json</code>. In <code>frontend/.env</code>, use <code>VITE_API_BASE_URL=/api</code>{' '}
        in development (Vite proxies to the local server). <strong>All task endpoints</strong> (list, detail, create, update,
        delete) require a signed-in user: use <strong>Log in</strong> in the header or <strong>Register</strong> in the modal.
        The app sends <code>Authorization: Bearer …</code> on every Tasks API call; each user only sees their own tasks. Use
        your <strong>Log in</strong> session (not <code>VITE_API_TOKEN</code> alone) for in-app prompts. If the token is
        invalid or missing, the app clears the session when the server returns 401 and can open the login modal.
      </p>

      {error && (
        <ErrorMessage message={getApiErrorMessage(error)} onDismiss={() => refetch()} />
      )}
      {createTask.isError && (
        <ErrorMessage
          message={getApiErrorMessage(createTask.error)}
          onDismiss={() => createTask.reset()}
        />
      )}
      {patchTask.isError && (
        <ErrorMessage
          message={getApiErrorMessage(patchTask.error)}
          onDismiss={() => patchTask.reset()}
        />
      )}

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title"
          style={{ marginRight: '0.5rem', padding: '0.5rem', width: '220px' }}
        />
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          style={{ marginRight: '0.5rem', padding: '0.5rem', width: '280px' }}
        />
        <div
          style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.75rem', verticalAlign: 'middle' }}
        >
          <button
            type="button"
            onClick={handleCreate}
            disabled={createTask.isPending || createMutating}
            aria-busy={createTask.isPending || createMutating}
            style={
              createTask.isPending || createMutating
                ? primaryFormButtonPending
                : !title.trim()
                  ? primaryFormButtonDisabled
                  : primaryFormButtonEnabled
            }
          >
            {createTask.isPending || createMutating ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                <Spinner size="sm" />
                Creating…
              </span>
            ) : (
              'Create'
            )}
          </button>
          {apiAuthHint === 'create' && !isAuthenticated && (
            <span style={signInBesideButtonHintStyle} role="status" aria-live="polite">
              Please sign in to create tasks (use Register in the modal if you need an account).
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 320px', minWidth: 0, position: 'relative' }}>
          <h2 style={{ fontSize: '1.1rem' }}>List (GET /tasks)</h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0.5rem' }}>
            {data !== undefined && (
              <>
                {data.total} task{data.total === 1 ? '' : 's'} · Page {page} of {totalPages}
              </>
            )}
          </p>

          {listBusy && (
            <div
              style={{
                marginBottom: '0.75rem',
                padding: data === undefined ? '1rem' : '0.6rem 0.9rem',
                background: '#eff6ff',
                borderRadius: '8px',
                border: '1px solid #93c5fd',
                display: 'flex',
                alignItems: 'center',
                justifyContent: data === undefined ? 'center' : 'flex-start',
                minHeight: data === undefined ? 100 : undefined,
              }}
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              {data === undefined ? (
                <Loading message={isLoading ? 'Loading tasks…' : 'Loading…'} />
              ) : (
                <Loading compact message="Updating list…" />
              )}
            </div>
          )}

          {!listBusy && data && data.items.length === 0 && (
            <p style={{ color: '#64748b', padding: '1rem 0' }}>No tasks on this page. Create one above or go back a page.</p>
          )}

          {data && data.items.length > 0 && (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, opacity: isFetching && !isLoading ? 0.65 : 1 }}>
              {data.items.map((task) => {
                const descPreview = task.description?.trim();
                const selected = selectedId === task.id;
                return (
                  <li
                    key={task.id}
                    aria-current={selected ? 'true' : undefined}
                    style={{
                      border: selected ? '1px solid #93c5fd' : '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '1rem 1.05rem',
                      marginBottom: '0.65rem',
                      background: selected ? 'linear-gradient(180deg, #f0f9ff 0%, #f8fafc 100%)' : '#fff',
                      boxShadow: selected
                        ? 'inset 3px 0 0 0 #60a5fa, 0 4px 14px rgba(96, 165, 250, 0.1)'
                        : '0 1px 3px rgba(15, 23, 42, 0.06)',
                      transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          flexWrap: 'wrap',
                          minWidth: 0,
                          flex: '1 1 8rem',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <span style={idBadgeStyle} title="Task id">
                          #{task.id}
                        </span>
                        {selected && (
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              color: '#3b82f6',
                            }}
                          >
                            Detail open
                          </span>
                        )}
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
                        <TaskStatusBadge completed={task.completed} />
                      </div>
                    </div>
                    <h3
                      style={{
                        margin: '0.5rem 0 0',
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        lineHeight: 1.35,
                        textAlign: 'left',
                      }}
                    >
                      {task.title}
                    </h3>
                    {descPreview ? (
                      <p
                        style={{
                          margin: '0.35rem 0 0',
                          fontSize: '0.85rem',
                          color: '#64748b',
                          lineHeight: 1.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textAlign: 'left',
                        }}
                      >
                        {descPreview}
                      </p>
                    ) : null}
                    <div
                      style={{
                        marginTop: '0.7rem',
                        paddingTop: '0.7rem',
                        borderTop: '1px solid #f1f5f9',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.65rem 1.25rem',
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                      }}
                    >
                      <span style={listMetaLine}>
                        <span style={{ color: '#94a3b8', fontWeight: 600, marginRight: '0.35rem' }}>Created</span>
                        {formatTaskDateTime(task.createdAt)}
                      </span>
                      <span style={listMetaLine}>
                        <span style={{ color: '#94a3b8', fontWeight: 600, marginRight: '0.35rem' }}>Updated</span>
                        {formatTaskDateTime(task.updatedAt)}
                      </span>
                    </div>
                    <div
                      style={{
                        marginTop: '0.85rem',
                        display: 'flex',
                        gap: '0.5rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                      aria-label="Task actions"
                    >
                      <button type="button" style={listActionBtn} onClick={() => setSelectedId(task.id)}>
                        Detail
                      </button>
                      <button
                        type="button"
                        style={listActionBtn}
                        disabled={patchMutating || !!deleteTarget || !!statusToggleTarget}
                        onClick={() => {
                          if (!isAuthenticated) {
                            setApiAuthHint({ kind: 'list-row', taskId: task.id });
                            openAuthModal('login');
                            return;
                          }
                          setStatusToggleTarget({
                            id: task.id,
                            title: task.title,
                            completed: task.completed,
                          });
                        }}
                      >
                        {patchingTaskId === task.id ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Spinner size="sm" />
                            Updating…
                          </span>
                        ) : (
                          'Change status…'
                        )}
                      </button>
                      <button
                        type="button"
                        style={{ ...listActionBtn, borderColor: '#fecaca', color: '#b91c1c' }}
                        onClick={() => {
                          if (!isAuthenticated) {
                            setApiAuthHint({ kind: 'list-row', taskId: task.id });
                            openAuthModal('login');
                            return;
                          }
                          setDeleteTarget({ id: task.id, title: task.title });
                        }}
                        disabled={!!deleteTarget || !!statusToggleTarget || deleteMutating}
                      >
                        Delete
                      </button>
                      {typeof apiAuthHint === 'object' &&
                        apiAuthHint !== null &&
                        apiAuthHint.kind === 'list-row' &&
                        apiAuthHint.taskId === task.id &&
                        !isAuthenticated && (
                          <span
                            style={{ ...signInBesideButtonHintStyle, flexBasis: '100%', marginTop: '0.15rem' }}
                            role="status"
                            aria-live="polite"
                          >
                            Please sign in to change status or delete tasks.
                          </span>
                        )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {data && data.total > 0 && (
            <nav
              style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}
              aria-label="Task list pagination"
            >
              <button
                type="button"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-busy={isFetching}
                style={listActionBtn}
              >
                Previous
              </button>
              <span style={{ fontSize: '0.9rem', color: '#475569' }}>
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-busy={isFetching}
                style={listActionBtn}
              >
                Next
              </button>
            </nav>
          )}
        </div>

        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <h2 style={{ fontSize: '1.1rem' }}>Detail</h2>
          {!selectedId && (
            <p style={{ color: '#64748b' }}>Select a task and click <strong>Detail</strong> to load <code>GET /tasks/:id</code>.</p>
          )}
          {selectedId && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#475569', marginTop: 0, wordBreak: 'break-all' }}>
                Request: <code>GET /tasks/{selectedId}</code>
              </p>
              <div
                style={{
                  marginTop: '0.5rem',
                  minHeight: 280,
                  border: '1px solid #94a3b8',
                  borderRadius: '8px',
                  background: '#fff',
                  padding: '1rem',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  ...(detailContentLoading
                    ? { alignItems: 'center', justifyContent: 'center' }
                    : {}),
                }}
              >
                {detailContentLoading && (
                  <div role="status" aria-live="polite" aria-busy="true">
                    <Loading message="Loading task detail…" />
                  </div>
                )}

                {!detailContentLoading && !detailMatches && detailError && (
                  <ErrorMessage message={getApiErrorMessage(detailError)} onDismiss={() => refetchDetail()} />
                )}

                {!detailContentLoading && detailMatches && detail && (
                  <>
                    {detailError && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <ErrorMessage message={getApiErrorMessage(detailError)} onDismiss={() => refetchDetail()} />
                      </div>
                    )}
                    {detailFetching && !detailLoading && (
                      <p
                        style={{
                          fontSize: '0.85rem',
                          color: '#475569',
                          marginTop: 0,
                          marginBottom: '0.65rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.45rem',
                        }}
                        role="status"
                        aria-live="polite"
                        aria-busy="true"
                      >
                        <Spinner size="sm" />
                        Refreshing detail…
                      </p>
                    )}
                    <TaskDetailView task={detail} />
                    <div
                      style={{
                        marginTop: '0.85rem',
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                      aria-label="Task actions"
                    >
                      <button
                        type="button"
                        style={listActionBtn}
                        disabled={patchMutating || !!deleteTarget || !!statusToggleTarget}
                        onClick={() => {
                          if (!isAuthenticated) {
                            setApiAuthHint('detail-status');
                            openAuthModal('login');
                            return;
                          }
                          setStatusToggleTarget({
                            id: detail.id,
                            title: detail.title,
                            completed: detail.completed,
                          });
                        }}
                      >
                        {patchingTaskId === detail.id ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                            <Spinner size="sm" />
                            Updating…
                          </span>
                        ) : (
                          'Change status…'
                        )}
                      </button>
                      {apiAuthHint === 'detail-status' && !isAuthenticated && (
                        <span style={signInBesideButtonHintStyle} role="status" aria-live="polite">
                          Please sign in to change task status.
                        </span>
                      )}
                    </div>
                    <hr
                      style={{
                        border: 'none',
                        borderTop: '1px solid #e2e8f0',
                        margin: '1.1rem 0 0.85rem',
                      }}
                      aria-hidden="true"
                    />
                    <p style={{ marginTop: 0, fontSize: '0.9rem', fontWeight: 600 }}>Edit title and description</p>
                    <PatchTaskForm
                      taskId={detail.id}
                      initialTitle={detail.title}
                      initialDescription={detail.description ?? ''}
                      onPatched={() => refetchDetail()}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {statusToggleTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="presentation"
          onClick={() => {
            if (!patchTask.isPending && !patchMutating) {
              patchTask.reset();
              setStatusToggleTarget(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-toggle-title"
            onClick={(e) => e.stopPropagation()}
            style={statusModalCardStyle}
          >
            <div style={statusModalHeaderStyle}>
              <h3 id="status-toggle-title" style={statusModalTitleStyle}>
                Change task status?
              </h3>
              <button
                type="button"
                aria-label="Close"
                disabled={patchTask.isPending || patchMutating}
                className={MODAL_CLOSE_BUTTON_CLASS}
                style={modalCloseButtonStyle}
                onClick={() => {
                  patchTask.reset();
                  setStatusToggleTarget(null);
                }}
              >
                ×
              </button>
            </div>
            <div style={statusModalBodyStyle}>
              <p style={{ margin: '0 0 0.85rem', color: '#334155', fontSize: '0.95rem', lineHeight: 1.5 }}>
                <strong style={{ color: '#0f172a' }}>{statusToggleTarget.title}</strong>
                <br />
                <span style={{ fontSize: '0.8rem', color: '#64748b', wordBreak: 'break-all' }}>
                  ID: {statusToggleTarget.id}
                </span>
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '0.5rem 0.75rem',
                  padding: '0.65rem 0.85rem',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  marginBottom: '0.75rem',
                }}
              >
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>New status</span>
                <TaskStatusBadge completed={!statusToggleTarget.completed} />
                <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                  via PATCH <code style={{ fontSize: '0.76rem' }}>completed</code>
                </span>
              </div>
              <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                You are about to mark this task as{' '}
                <strong style={{ color: '#334155' }}>{statusToggleTarget.completed ? 'open' : 'done'}</strong>.
              </p>
              {patchTask.isError && (
                <p style={{ color: '#b91c1c', fontSize: '0.9rem', margin: '0.75rem 0 0' }} role="alert">
                  {getApiErrorMessage(patchTask.error)}
                </p>
              )}
            </div>
            <div style={statusModalFooterStyle}>
              <button
                type="button"
                disabled={patchTask.isPending || patchMutating}
                style={{
                  ...statusModalBtnSecondary,
                  ...(patchTask.isPending || patchMutating ? { opacity: 0.55, cursor: 'not-allowed' } : {}),
                }}
                onClick={() => {
                  patchTask.reset();
                  setStatusToggleTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmToggleCompleted}
                disabled={patchTask.isPending || patchMutating}
                aria-busy={patchTask.isPending || patchMutating}
                style={{
                  ...statusModalBtnPrimaryBase,
                  ...(statusToggleTarget.completed
                    ? {
                        background: '#7d92a4',
                        borderColor: '#64748b',
                        boxShadow: '0 1px 3px rgba(100, 116, 139, 0.3)',
                      }
                    : {
                        background: '#34d399',
                        borderColor: '#10b981',
                        boxShadow: '0 1px 3px rgba(52, 211, 153, 0.35)',
                      }),
                  ...(patchTask.isPending || patchMutating ? { opacity: 0.75, cursor: 'wait' } : {}),
                }}
              >
                {patchTask.isPending ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    <Spinner size="sm" />
                    Updating…
                  </span>
                ) : statusToggleTarget.completed ? (
                  'Mark as open'
                ) : (
                  'Mark as done'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="presentation"
          onClick={() => !deleteTask.isPending && !deleteMutating && setDeleteTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-task-title"
            onClick={(e) => e.stopPropagation()}
            style={statusModalCardStyle}
          >
            <div style={statusModalHeaderStyle}>
              <h3 id="delete-task-title" style={statusModalTitleStyle}>
                Delete this task?
              </h3>
              <button
                type="button"
                aria-label="Close"
                disabled={deleteTask.isPending || deleteMutating}
                className={MODAL_CLOSE_BUTTON_CLASS}
                style={modalCloseButtonStyle}
                onClick={() => {
                  deleteTask.reset();
                  setDeleteTarget(null);
                }}
              >
                ×
              </button>
            </div>
            <div style={statusModalBodyStyle}>
              <p style={{ margin: '0 0 0.85rem', color: '#334155', fontSize: '0.95rem', lineHeight: 1.5 }}>
                <strong style={{ color: '#0f172a' }}>{deleteTarget.title}</strong>
                <br />
                <span style={{ fontSize: '0.8rem', color: '#64748b', wordBreak: 'break-all' }}>
                  ID: {deleteTarget.id}
                </span>
              </p>
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  background: '#fef2f2',
                  borderRadius: '8px',
                  border: '1px solid #fecaca',
                  marginBottom: '0.75rem',
                }}
                role="alert"
              >
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#b91c1c' }}>
                  This cannot be undone.
                </p>
              </div>
              {deleteTask.isError && (
                <p style={{ color: '#b91c1c', fontSize: '0.9rem', margin: '0.75rem 0 0' }} role="alert">
                  {getApiErrorMessage(deleteTask.error)}
                </p>
              )}
            </div>
            <div style={statusModalFooterStyle}>
              <button
                type="button"
                disabled={deleteTask.isPending || deleteMutating}
                style={{
                  ...statusModalBtnSecondary,
                  ...(deleteTask.isPending || deleteMutating ? { opacity: 0.55, cursor: 'not-allowed' } : {}),
                }}
                onClick={() => {
                  deleteTask.reset();
                  setDeleteTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteTask.isPending || deleteMutating}
                aria-busy={deleteTask.isPending || deleteMutating}
                style={
                  deleteTask.isPending || deleteMutating ? modalDangerButtonPending : modalDangerButton
                }
              >
                {deleteTask.isPending || deleteMutating ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                    <Spinner size="sm" />
                    Deleting…
                  </span>
                ) : (
                  'Delete task'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function normalizeDescription(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  return t === '' ? null : t;
}

function PatchTaskForm({
  taskId,
  initialTitle,
  initialDescription,
  onPatched,
}: {
  taskId: number;
  initialTitle: string;
  initialDescription: string;
  onPatched: () => void;
}) {
  const toast = useToast();
  const { isAuthenticated, openAuthModal, logout } = useAuth();
  const onWriteAuthError = useCallback(
    (error: unknown) =>
      notifyWriteAuthIssue(error, {
        toastInfo: (m) => toast.info(m),
        openLoginModal: () => openAuthModal('login'),
        logout,
      }),
    [toast, openAuthModal, logout]
  );
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [saveSignInHint, setSaveSignInHint] = useState(false);
  const patch = usePatchTask();
  const patchBusy = useIsMutating({ mutationKey: TASKS_PATCH_MUTATION_KEY }) > 0;
  const lastSyncedTaskId = useRef<number | null>(null);

  /** Only reset fields when switching tasks — not when `detail` refetches or auth modal opens (preserves edits if save blocked). */
  useEffect(() => {
    if (lastSyncedTaskId.current === taskId) return;
    lastSyncedTaskId.current = taskId;
    setTitle(initialTitle);
    setDescription(initialDescription);
  }, [taskId, initialTitle, initialDescription]);

  useEffect(() => {
    if (isAuthenticated) setSaveSignInHint(false);
  }, [isAuthenticated]);

  const titleTrim = title.trim();
  const descNorm = normalizeDescription(description);
  const initialDescNorm = normalizeDescription(initialDescription);
  const titleChanged = titleTrim !== initialTitle.trim();
  const descriptionChanged = descNorm !== initialDescNorm;
  const canSave = titleTrim.length > 0 && (titleChanged || descriptionChanged);

  const submit = () => {
    if (!canSave) return;
    if (!isAuthenticated) {
      setSaveSignInHint(true);
      openAuthModal('login');
      return;
    }
    if (patch.isPending || patchBusy) return;
    if (!tryAcquirePatchLock()) return;
    const body: PatchTaskRequest = {};
    if (titleChanged) body.title = titleTrim;
    if (descriptionChanged) body.description = descNorm;
    patch.mutate(
      { taskId, body },
      {
        onSuccess: () => {
          onPatched();
          toast.success('Task updated.');
        },
        onError: (e) => {
          if (onWriteAuthError(e)) patch.reset();
        },
        onSettled: () => {
          releasePatchLock();
        },
      }
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', alignItems: 'stretch', maxWidth: 480 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left', fontSize: '0.85rem', color: '#475569' }}>
        Title
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={patchBusy}
          aria-invalid={titleTrim.length === 0}
          style={{ padding: '0.5rem', width: '100%', boxSizing: 'border-box' }}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', textAlign: 'left', fontSize: '0.85rem', color: '#475569' }}>
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={patchBusy}
          placeholder="Optional — leave empty to clear"
          rows={4}
          style={{
            padding: '0.5rem',
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            minHeight: '88px',
            fontFamily: 'inherit',
          }}
        />
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
        <button
          type="button"
          onClick={submit}
          disabled={patch.isPending || patchBusy || !canSave}
          aria-busy={patch.isPending || patchBusy}
          style={
            patch.isPending || patchBusy
              ? primaryFormButtonPending
              : !canSave
                ? primaryFormButtonDisabled
                : primaryFormButtonEnabled
          }
        >
          {patch.isPending || patchBusy ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <Spinner size="sm" />
              Saving…
            </span>
          ) : (
            'Save changes'
          )}
        </button>
        {saveSignInHint && !isAuthenticated && (
          <span style={signInBesideButtonHintStyle} role="status" aria-live="polite">
            Please sign in to save changes.
          </span>
        )}
        {!titleChanged && !descriptionChanged && titleTrim.length > 0 && (
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No changes yet</span>
        )}
        {titleTrim.length === 0 && <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>Title is required</span>}
      </div>
      {patch.isError && (
        <span style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{getApiErrorMessage(patch.error)}</span>
      )}
    </div>
  );
}
