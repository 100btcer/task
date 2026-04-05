import { Router } from 'express';
import { taskToJson } from '../taskDto.mjs';

/**
 * Task HTTP routes. Mounted after {@link createRequireUserForTasksMiddleware}: `req.auth.userId` is set.
 */
export function createTasksRouter(store) {
  const router = Router();

  function qParam(raw, fallback) {
    const s = Array.isArray(raw) ? String(raw[0]) : String(raw ?? fallback);
    return s;
  }

  function userId(req) {
    return /** @type {number} */ (req.auth.userId);
  }

  router.get('/', (req, res, next) => {
    try {
      const page = Math.max(1, parseInt(qParam(req.query.page, '1'), 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(qParam(req.query.limit, '20'), 10) || 20));
      const all = store.listSortedDesc(userId(req));
      const total = all.length;
      const start = (page - 1) * limit;
      const items = all.slice(start, start + limit).map(taskToJson);
      res.json({ items, total, page, limit });
    } catch (e) {
      next(e);
    }
  });

  router.post('/', (req, res) => {
    const { title, description } = req.body ?? {};
    if (typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ message: 'title is required', code: 'VALIDATION', status: 400 });
    }
    const task = store.create(userId(req), { title, description });
    res.status(201).json(taskToJson(task));
  });

  router.get('/:taskId', (req, res) => {
    const task = store.get(userId(req), req.params.taskId);
    if (!task) {
      return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND', status: 404 });
    }
    res.json(taskToJson(task));
  });

  /** Partial update: body may include any of `title`, `description`, `completed` — omit keys you do not change (e.g. `{ completed: true }` only). */
  router.patch('/:taskId', (req, res) => {
    const task = store.update(userId(req), req.params.taskId, req.body ?? {});
    if (!task) {
      return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND', status: 404 });
    }
    res.json(taskToJson(task));
  });

  router.delete('/:taskId', (req, res) => {
    if (!store.has(userId(req), req.params.taskId)) {
      return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND', status: 404 });
    }
    store.delete(userId(req), req.params.taskId);
    // 200 + JSON body (not 204): some browsers/proxies mishandle empty DELETE responses with the OpenAPI client.
    res.status(200).json({ ok: true });
  });

  return router;
}
