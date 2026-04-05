/**
 * Blockchain Demo — persist ERC-20 / native transfer rows (same DB as tasks).
 * @param {import('better-sqlite3').Database} db
 */
export function createBlockchainTransferHistoryStore(db) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO blockchain_transfer_history (
      chain_id, wallet_address, tx_hash, to_address, amount_human, amount_raw, symbol, asset, status, block_number, timestamp_ms
    ) VALUES (@chain_id, @wallet_address, @tx_hash, @to_address, @amount_human, @amount_raw, @symbol, @asset, @status, @block_number, @timestamp_ms)`
  );
  const select = db.prepare(
    `SELECT tx_hash, to_address, amount_human, amount_raw, symbol, asset, status, block_number, timestamp_ms
     FROM blockchain_transfer_history WHERE chain_id = ? AND wallet_address = ? ORDER BY timestamp_ms DESC, id DESC`
  );
  const del = db.prepare(`DELETE FROM blockchain_transfer_history WHERE chain_id = ? AND wallet_address = ?`);

  return {
    /**
     * @param {number} chainId
     * @param {string} walletLower
     */
    list(chainId, walletLower) {
      return select.all(chainId, walletLower).map((r) => ({
        hash: r.tx_hash,
        to: r.to_address,
        amountHuman: r.amount_human,
        amountRaw: r.amount_raw,
        symbol: r.symbol,
        asset: r.asset,
        status: r.status,
        blockNumber: r.block_number == null ? null : String(r.block_number),
        timestamp: Number(r.timestamp_ms),
      }));
    },
    /**
     * @param {number} chainId
     * @param {string} walletLower
     * @param {Array<{ hash: string; to: string; amountHuman: string; amountRaw: string; symbol: string; asset: string; status: string; blockNumber: string | null; timestamp: number }>} items
     */
    insertIgnoreBatch(chainId, walletLower, items) {
      const run = db.transaction(() => {
        for (const it of items) {
          insert.run({
            chain_id: chainId,
            wallet_address: walletLower,
            tx_hash: it.hash,
            to_address: it.to,
            amount_human: it.amountHuman,
            amount_raw: it.amountRaw,
            symbol: it.symbol,
            asset: it.asset,
            status: it.status,
            block_number: it.blockNumber == null ? null : String(it.blockNumber),
            timestamp_ms: it.timestamp,
          });
        }
      });
      run();
    },
    /** @param {number} chainId @param {string} walletLower */
    clear(chainId, walletLower) {
      del.run(chainId, walletLower);
    },
  };
}
