/** In-memory task store — used only when `createApp({ store })` overrides the default SQLite store. */

function now() {
  return new Date().toISOString();
}

/**
 * @typedef {{ id: number; userId: number; title: string; description?: string; completed: boolean; createdAt: string; updatedAt: string }} TaskRow
 */

export function createTaskStore() {
  let nextId = 1;
  /** @type {Map<number, TaskRow>} */
  const tasks = new Map();

  function normalizeId(raw) {
    const n = Number.parseInt(String(raw), 10);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
  }

  function normalizeUserId(raw) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
  }

  return {
    /** @param {number} userId */
    listSortedDesc(userId) {
      const uid = normalizeUserId(userId);
      if (uid === null) return [];
      return [...tasks.values()]
        .filter((t) => t.userId === uid)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    },
    /** @param {number} userId */
    get(userId, rawId) {
      const uid = normalizeUserId(userId);
      const id = normalizeId(rawId);
      if (uid === null || id === null) return undefined;
      const t = tasks.get(id);
      if (!t || t.userId !== uid) return undefined;
      return t;
    },
    /** @param {number} userId */
    create(userId, { title, description }) {
      const uid = normalizeUserId(userId);
      if (uid === null) throw new Error('invalid userId');
      const id = nextId++;
      const t = now();
      const task = {
        id,
        userId: uid,
        title: title.trim(),
        description: typeof description === 'string' ? description : undefined,
        completed: false,
        createdAt: t,
        updatedAt: t,
      };
      tasks.set(id, task);
      return task;
    },
    /** @param {number} userId */
    update(userId, rawId, body) {
      const uid = normalizeUserId(userId);
      const id = normalizeId(rawId);
      if (uid === null || id === null) return null;
      const task = tasks.get(id);
      if (!task || task.userId !== uid) return null;
      if (typeof body.title === 'string') task.title = body.title.trim();
      if ('description' in body) {
        task.description =
          body.description === null || body.description === undefined ? undefined : String(body.description);
      }
      if ('completed' in body && typeof body.completed === 'boolean') {
        task.completed = body.completed;
      }
      task.updatedAt = now();
      return task;
    },
    /** @param {number} userId */
    delete(userId, rawId) {
      const uid = normalizeUserId(userId);
      const id = normalizeId(rawId);
      if (uid === null || id === null) return false;
      const task = tasks.get(id);
      if (!task || task.userId !== uid) return false;
      return tasks.delete(id);
    },
    /** @param {number} userId */
    has(userId, rawId) {
      const uid = normalizeUserId(userId);
      const id = normalizeId(rawId);
      if (uid === null || id === null) return false;
      const task = tasks.get(id);
      return Boolean(task && task.userId === uid);
    },
  };
}
