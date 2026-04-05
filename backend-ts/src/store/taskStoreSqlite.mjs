/** @typedef {{ id: number; userId: number; title: string; description?: string; completed: boolean; createdAt: string; updatedAt: string }} TaskRow */

function nowIso() {
  return new Date().toISOString();
}

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

/**
 * @param {import('better-sqlite3').Database} db
 */
function rowToTask(r) {
  return {
    id: Number(r.id),
    userId: Number(r.user_id),
    title: r.title,
    description: r.description == null ? undefined : String(r.description),
    completed: Boolean(r.completed),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Persistent task store (SQLite). Every method is scoped to `userId`.
 * @param {import('better-sqlite3').Database} db
 */
export function createSqliteTaskStore(db) {
  const selectAllDesc = db.prepare(
    `SELECT id, user_id, title, description, completed, created_at, updated_at FROM tasks WHERE user_id = ? ORDER BY datetime(created_at) DESC, id DESC`
  );
  const selectById = db.prepare(
    `SELECT id, user_id, title, description, completed, created_at, updated_at FROM tasks WHERE id = ? AND user_id = ?`
  );
  const insert = db.prepare(
    `INSERT INTO tasks (user_id, title, description, completed, created_at, updated_at) VALUES (@user_id, @title, @description, 0, @created_at, @updated_at)`
  );
  const deleteById = db.prepare(`DELETE FROM tasks WHERE id = ? AND user_id = ?`);
  const exists = db.prepare(`SELECT 1 AS x FROM tasks WHERE id = ? AND user_id = ? LIMIT 1`);

  return {
    /** @param {number} userId */
    listSortedDesc(userId) {
      const uid = normalizeUserId(userId);
      if (uid === null) return [];
      return selectAllDesc.all(uid).map(rowToTask);
    },
    /** @param {number} userId */
    get(userId, rawId) {
      const uid = normalizeUserId(userId);
      const id = normalizeId(rawId);
      if (uid === null || id === null) return undefined;
      const r = selectById.get(id, uid);
      return r ? rowToTask(r) : undefined;
    },
    /** @param {number} userId */
    create(userId, { title, description }) {
      const uid = normalizeUserId(userId);
      if (uid === null) throw new Error('invalid userId');
      const t = nowIso();
      const desc =
        typeof description === 'string' && description.trim() !== '' ? description.trim() : null;
      const info = insert.run({
        user_id: uid,
        title: title.trim(),
        description: desc,
        created_at: t,
        updated_at: t,
      });
      const id = Number(info.lastInsertRowid);
      return /** @type {TaskRow} */ ({
        id,
        userId: uid,
        title: title.trim(),
        description: desc ?? undefined,
        completed: false,
        createdAt: t,
        updatedAt: t,
      });
    },
    /** @param {number} userId */
    update(userId, rawId, body) {
      const uid = normalizeUserId(userId);
      const id = normalizeId(rawId);
      if (uid === null || id === null) return null;
      const current = selectById.get(id, uid);
      if (!current) return null;

      let title = current.title;
      let description = current.description;
      let completed = Boolean(current.completed);
      if (typeof body.title === 'string') title = body.title.trim();
      if ('description' in body) {
        description =
          body.description === null || body.description === undefined
            ? null
            : String(body.description);
      }
      if ('completed' in body && typeof body.completed === 'boolean') {
        completed = body.completed;
      }
      const updatedAt = nowIso();

      db.prepare(
        `UPDATE tasks SET title = ?, description = ?, completed = ?, updated_at = ? WHERE id = ? AND user_id = ?`
      ).run(title, description, completed ? 1 : 0, updatedAt, id, uid);

      return rowToTask({
        id,
        user_id: uid,
        title,
        description,
        completed: completed ? 1 : 0,
        created_at: current.created_at,
        updated_at: updatedAt,
      });
    },
    /** @param {number} userId */
    delete(userId, rawId) {
      const uid = normalizeUserId(userId);
      const id = normalizeId(rawId);
      if (uid === null || id === null) return false;
      const r = deleteById.run(id, uid);
      return r.changes > 0;
    },
    /** @param {number} userId */
    has(userId, rawId) {
      const uid = normalizeUserId(userId);
      const id = normalizeId(rawId);
      if (uid === null || id === null) return false;
      return Boolean(exists.get(id, uid));
    },
  };
}
