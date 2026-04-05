package dao

import (
	"context"
	"database/sql"
	"strings"
)

// BlockchainTransferRow matches JSON / frontend TransferHistoryRow (block number as decimal string).
type BlockchainTransferRow struct {
	Hash         string
	To           string
	AmountHuman  string
	AmountRaw    string
	Symbol       string
	Asset        string
	Status       string
	BlockNumber  *string
	TimestampMs  int64
}

func (d *Dao) BlockchainTransfersList(ctx context.Context, chainID int64, walletLower string) ([]BlockchainTransferRow, error) {
	rows, err := d.db.QueryContext(ctx,
		`SELECT tx_hash, to_address, amount_human, amount_raw, symbol, asset, status, block_number, timestamp_ms
		 FROM blockchain_transfer_history WHERE chain_id = ? AND wallet_address = ? ORDER BY timestamp_ms DESC, id DESC`,
		chainID, walletLower,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []BlockchainTransferRow
	for rows.Next() {
		var r BlockchainTransferRow
		var block sql.NullString
		if err := rows.Scan(&r.Hash, &r.To, &r.AmountHuman, &r.AmountRaw, &r.Symbol, &r.Asset, &r.Status, &block, &r.TimestampMs); err != nil {
			return nil, err
		}
		if block.Valid {
			s := block.String
			r.BlockNumber = &s
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (d *Dao) BlockchainTransfersInsertIgnore(ctx context.Context, chainID int64, walletLower string, items []BlockchainTransferRow) error {
	if len(items) == 0 {
		return nil
	}
	tx, err := d.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	stmt, err := tx.PrepareContext(ctx,
		`INSERT OR IGNORE INTO blockchain_transfer_history (
			chain_id, wallet_address, tx_hash, to_address, amount_human, amount_raw, symbol, asset, status, block_number, timestamp_ms
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		_ = tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, it := range items {
		var block interface{}
		if it.BlockNumber != nil {
			block = *it.BlockNumber
		}
		_, err := stmt.ExecContext(ctx,
			chainID, walletLower, strings.ToLower(it.Hash), strings.ToLower(it.To),
			it.AmountHuman, it.AmountRaw, it.Symbol, it.Asset, it.Status, block, it.TimestampMs,
		)
		if err != nil {
			_ = tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

func (d *Dao) BlockchainTransfersClear(ctx context.Context, chainID int64, walletLower string) error {
	_, err := d.db.ExecContext(ctx,
		`DELETE FROM blockchain_transfer_history WHERE chain_id = ? AND wallet_address = ?`,
		chainID, walletLower,
	)
	return err
}
