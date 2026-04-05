/**
 * In-memory users (username → bcrypt hash). Used only when `createApp({ userStore })` overrides SQLite.
 */
export function createUserStore() {
  let nextUserId = 1;
  /** @type {Map<string, { passwordHash: string; id: number }>} */
  const users = new Map();

  return {
    /** @param {string} normalizedUsername */
    getIdByUsername(normalizedUsername) {
      return users.get(normalizedUsername)?.id;
    },

    /**
     * @param {string} normalizedUsername lowercased trimmed
     */
    has(normalizedUsername) {
      return users.has(normalizedUsername);
    },
    /**
     * @param {string} normalizedUsername
     * @param {string} passwordHash
     * @returns {boolean} false if username already exists
     */
    add(normalizedUsername, passwordHash) {
      if (users.has(normalizedUsername)) return false;
      const id = nextUserId++;
      users.set(normalizedUsername, { passwordHash, id });
      return true;
    },
    /**
     * @param {string} normalizedUsername
     * @returns {{ passwordHash: string } | undefined}
     */
    get(normalizedUsername) {
      return users.get(normalizedUsername);
    },
  };
}
