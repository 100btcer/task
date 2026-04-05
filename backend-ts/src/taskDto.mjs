export function taskToJson(t) {
  return {
    id: Number(t.id),
    userId: Number(t.userId),
    title: t.title,
    description: t.description ?? null,
    completed: t.completed,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}
