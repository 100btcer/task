/**
 * Tasks API hooks — all requests go through `apiClient` → this repo’s **backend-ts** (or URL in `VITE_API_BASE_URL`).
 */
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { apiClient, getApiErrorMessage, ApiError } from '../api';
import { ensureWritableApiToken, hasWritableApiToken } from '../lib/apiWriteAuth';
import {
  TASKS_CREATE_MUTATION_KEY,
  TASKS_DELETE_MUTATION_KEY,
  TASKS_PATCH_MUTATION_KEY,
} from '../constants/mutationKeys';
import type { CreateTaskRequest, PatchTaskRequest, Task, TaskListResponse } from '../api/openapi';

/**
 * Normalize task JSON from the API. Accepts ids as numbers or digit strings (some proxies/servers stringify ids).
 * Parses a JSON string body if needed.
 */
function parseTaskResponse(raw: unknown): Task {
  let data: unknown = raw;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data) as unknown;
    } catch {
      throw new Error('Unexpected task response shape');
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Unexpected task response shape');
  }
  const o = data as Record<string, unknown>;
  const rawId = o.id;
  let id: number;
  if (typeof rawId === 'number' && Number.isFinite(rawId)) {
    id = rawId;
  } else if (typeof rawId === 'string' && /^\d+$/.test(rawId.trim())) {
    id = Number.parseInt(rawId.trim(), 10);
  } else {
    throw new Error('Unexpected task response shape');
  }
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('Unexpected task response shape');
  }
  if (typeof o.title !== 'string') {
    throw new Error('Unexpected task response shape');
  }
  const completed = typeof o.completed === 'boolean' ? o.completed : false;
  const createdAt = typeof o.createdAt === 'string' ? o.createdAt : '';
  const updatedAt = typeof o.updatedAt === 'string' ? o.updatedAt : '';

  const rawUserId = o.userId;
  let userId: number;
  if (typeof rawUserId === 'number' && Number.isFinite(rawUserId)) {
    userId = rawUserId;
  } else if (typeof rawUserId === 'string' && /^\d+$/.test(rawUserId.trim())) {
    userId = Number.parseInt(rawUserId.trim(), 10);
  } else {
    throw new Error('Unexpected task response shape');
  }
  if (!Number.isInteger(userId) || userId < 1) {
    throw new Error('Unexpected task response shape');
  }

  const task: Task = {
    id,
    userId,
    title: o.title,
    completed,
    createdAt,
    updatedAt,
  };
  if ('description' in o) {
    if (o.description === null) task.description = null;
    else if (typeof o.description === 'string') task.description = o.description;
  }
  return task;
}

function asTaskList(data: TaskListResponse | { message?: string }): TaskListResponse {
  if (data && typeof data === 'object' && Array.isArray((data as TaskListResponse).items)) {
    const d = data as TaskListResponse;
    return {
      ...d,
      items: d.items.map((item) => parseTaskResponse(item)),
    };
  }
  throw new Error('Unexpected task list response shape');
}

function asTask(data: Task | { message?: string }): Task {
  return parseTaskResponse(data);
}

function attachAbort<T>(signal: AbortSignal, promise: { cancel: () => void; finally: (fn: () => void) => Promise<T> }): Promise<T> {
  const onAbort = () => promise.cancel();
  signal.addEventListener('abort', onAbort);
  return promise.finally(() => signal.removeEventListener('abort', onAbort));
}

/**
 * GET /tasks – paginated list (see generated DefaultService.listTasks).
 */
export function useTasksList(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: ({ signal }) =>
      attachAbort(signal, apiClient.default.listTasks(params?.page ?? 1, params?.limit ?? 20)),
    enabled: hasWritableApiToken(),
    select: asTaskList,
    placeholderData: keepPreviousData,
    // Avoid replaceEqualDeep reusing nested task references when PATCH toggles `completed` (badge must update).
    structuralSharing: false,
  });
}

/**
 * GET /tasks/{taskId} – task detail.
 */
export function useTask(taskId: number | null) {
  return useQuery({
    queryKey: ['tasks', taskId],
    queryFn: ({ signal }) => attachAbort(signal, apiClient.default.getTask(taskId!)),
    enabled: taskId != null && hasWritableApiToken(),
    select: asTask,
    structuralSharing: false,
  });
}

/**
 * POST /tasks – create task.
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: TASKS_CREATE_MUTATION_KEY,
    mutationFn: async (body: CreateTaskRequest) => {
      ensureWritableApiToken();
      const res = await apiClient.default.createTask(body);
      try {
        return parseTaskResponse(res);
      } catch {
        throw new Error('Unexpected create response');
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

type PatchTaskVars = { taskId: number; body: PatchTaskRequest };

type PatchTaskCtx = { previous: [QueryKey, unknown][] };

function isTaskList(data: unknown): data is TaskListResponse {
  return (
    !!data &&
    typeof data === 'object' &&
    'items' in data &&
    Array.isArray((data as TaskListResponse).items)
  );
}

function isTaskDetail(data: unknown): data is Task {
  return (
    !!data &&
    typeof data === 'object' &&
    'id' in data &&
    'title' in data &&
    !('items' in data)
  );
}

/**
 * PATCH /tasks/{taskId} – partial update (pass taskId per call).
 * Optimistic cache updates for list + detail; rolls back on error.
 */
export function usePatchTask() {
  const queryClient = useQueryClient();
  return useMutation<Task, unknown, PatchTaskVars, PatchTaskCtx>({
    mutationKey: TASKS_PATCH_MUTATION_KEY,
    mutationFn: async ({ taskId, body }) => {
      ensureWritableApiToken();
      const res = await apiClient.default.patchTask(taskId, body);
      try {
        return parseTaskResponse(res);
      } catch {
        throw new Error('Unexpected PATCH response');
      }
    },
    onMutate: async ({ taskId, body }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueriesData({ queryKey: ['tasks'] });
      queryClient.setQueriesData({ queryKey: ['tasks'] }, (old) => {
        if (old === undefined || old === null) return old;
        if (isTaskList(old)) {
          return {
            ...old,
            items: old.items.map((t) => (t.id === taskId ? { ...t, ...body } : t)),
          };
        }
        if (isTaskDetail(old) && old.id === taskId) {
          return { ...old, ...body };
        }
        return old;
      });
      return { previous };
    },
    onSuccess: (updatedTask, { taskId }) => {
      queryClient.setQueriesData({ queryKey: ['tasks'] }, (old) => {
        if (old === undefined || old === null) return old;
        if (isTaskList(old)) {
          return {
            ...old,
            items: old.items.map((t) => (t.id === taskId ? { ...updatedTask } : t)),
          };
        }
        if (isTaskDetail(old) && old.id === taskId) {
          return { ...updatedTask };
        }
        return old;
      });
    },
    onError: (_err, _vars, ctx) => {
      ctx?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
    },
    onSettled: (_data, _err, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['tasks', taskId] });
    },
  });
}

/**
 * DELETE /tasks/{taskId}.
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: TASKS_DELETE_MUTATION_KEY,
    mutationFn: async (taskId: number) => {
      ensureWritableApiToken();
      try {
        await apiClient.default.deleteTask(taskId);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return;
        throw e;
      }
    },
    onSuccess: (_data, taskId) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.removeQueries({ queryKey: ['tasks', taskId] });
    },
  });
}

export { getApiErrorMessage };
