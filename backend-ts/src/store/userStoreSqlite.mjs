/**
 * Persistent users (username → bcrypt hash) in SQLite.
 * @param {import('better-sqlite3').Database} db
 */
export function createSqliteUserStore(db) {
  const insert = db.prepare(`INSERT INTO users (username, password_hash) VALUES (?, ?)`);
  const selectHash = db.prepare(`SELECT password_hash FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`);
  const selectExists = db.prepare(`SELECT 1 AS x FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`);
  const selectId = db.prepare(`SELECT id FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`);

  return {
    /** @param {string} normalizedUsername */
    getIdByUsername(normalizedUsername) {
      const row = selectId.get(normalizedUsername);
      if (row?.id == null) return undefined;
      return Number(row.id);
    },

    /** @param {string} normalizedUsername lowercased trimmed */
    has(normalizedUsername) {
      return Boolean(selectExists.get(normalizedUsername));
    },
    /**
     * @param {string} normalizedUsername
     * @param {string} passwordHash
     * @returns {boolean} false if username already exists
     */
    add(normalizedUsername, passwordHash) {
      try {
        insert.run(normalizedUsername, passwordHash);
        return true;
      } catch (e) {
        const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : '';
        const code = e && typeof e === 'object' && 'code' in e ? String(e.code) : '';
        if (code === 'SQLITE_CONSTRAINT_UNIQUE' || msg.includes('UNIQUE constraint failed')) {
          return false;
        }
        throw e;
      }
    },
    /**
     * @param {string} normalizedUsername
     * @returns {{ passwordHash: string } | undefined}
     */
    get(normalizedUsername) {
      const row = selectHash.get(normalizedUsername);
      if (!row?.password_hash) return undefined;
      return { passwordHash: row.password_hash };
    },
  };
}
