package blockchain

import (
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"task/backend-go/internal/dao"
)

var (
	addrRe = regexp.MustCompile(`^0x[a-fA-F0-9]{40}$`)
	hashRe = regexp.MustCompile(`^0x[a-fA-F0-9]{64}$`)
)

type Handler struct {
	d *dao.Dao
}

func NewHandler(d *dao.Dao) *Handler {
	return &Handler{d: d}
}

func parseChainID(s string) (int64, bool) {
	n, err := strconv.ParseInt(strings.TrimSpace(s), 10, 64)
	if err != nil || n < 1 {
		return 0, false
	}
	return n, true
}

func normalizeWallet(s string) (string, bool) {
	s = strings.TrimSpace(s)
	if !addrRe.MatchString(s) {
		return "", false
	}
	return strings.ToLower(s), true
}

type appendBody struct {
	ChainID        int64  `json:"chainId"`
	WalletAddress  string `json:"walletAddress"`
	Items          []item `json:"items"`
}

type item struct {
	Hash         string  `json:"hash"`
	To           string  `json:"to"`
	AmountHuman  string  `json:"amountHuman"`
	AmountRaw    string  `json:"amountRaw"`
	Symbol       string  `json:"symbol"`
	Asset        string  `json:"asset"`
	Status       string  `json:"status"`
	BlockNumber  *string `json:"blockNumber"`
	Timestamp    float64 `json:"timestamp"`
}

func validItem(it item) bool {
	if !hashRe.MatchString(it.Hash) || !addrRe.MatchString(it.To) {
		return false
	}
	if strings.TrimSpace(it.AmountHuman) == "" || strings.TrimSpace(it.AmountRaw) == "" || strings.TrimSpace(it.Symbol) == "" {
		return false
	}
	if it.Asset != "native" && it.Asset != "erc20" {
		return false
	}
	if it.Status != "success" && it.Status != "reverted" && it.Status != "failed" {
		return false
	}
	if it.BlockNumber != nil && *it.BlockNumber == "" {
		return false
	}
	if it.Timestamp < 0 || it.Timestamp > 1e15 {
		return false
	}
	return true
}

func (h *Handler) List(c *gin.Context) {
	chainID, ok := parseChainID(c.Query("chainId"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"message": "chainId (positive int) and wallet (0x + 40 hex) are required", "code": "VALIDATION", "status": 400})
		return
	}
	wallet, ok := normalizeWallet(c.Query("wallet"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"message": "chainId (positive int) and wallet (0x + 40 hex) are required", "code": "VALIDATION", "status": 400})
		return
	}
	rows, err := h.d.BlockchainTransfersList(c.Request.Context(), chainID, wallet)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	items := make([]gin.H, 0, len(rows))
	for _, r := range rows {
		var bn interface{}
		if r.BlockNumber != nil {
			bn = *r.BlockNumber
		} else {
			bn = nil
		}
		items = append(items, gin.H{
			"hash":         r.Hash,
			"to":           r.To,
			"amountHuman":  r.AmountHuman,
			"amountRaw":    r.AmountRaw,
			"symbol":       r.Symbol,
			"asset":        r.Asset,
			"status":       r.Status,
			"blockNumber":  bn,
			"timestamp":    r.TimestampMs,
		})
	}
	c.JSON(http.StatusOK, gin.H{"items": items})
}

func (h *Handler) Append(c *gin.Context) {
	var body appendBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "chainId, walletAddress, and non-empty items[] are required", "code": "VALIDATION", "status": 400})
		return
	}
	if body.ChainID < 1 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "chainId, walletAddress, and non-empty items[] are required", "code": "VALIDATION", "status": 400})
		return
	}
	wallet, ok := normalizeWallet(body.WalletAddress)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"message": "chainId, walletAddress, and non-empty items[] are required", "code": "VALIDATION", "status": 400})
		return
	}
	if len(body.Items) == 0 || len(body.Items) > 200 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "items[] must be 1..200", "code": "VALIDATION", "status": 400})
		return
	}
	rows := make([]dao.BlockchainTransferRow, 0, len(body.Items))
	for _, it := range body.Items {
		if !validItem(it) {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid item in items[]", "code": "VALIDATION", "status": 400})
			return
		}
		ts := int64(it.Timestamp + 0.5)
		var bn *string
		if it.BlockNumber != nil {
			s := *it.BlockNumber
			bn = &s
		}
		rows = append(rows, dao.BlockchainTransferRow{
			Hash: strings.ToLower(it.Hash), To: strings.ToLower(it.To),
			AmountHuman: it.AmountHuman, AmountRaw: it.AmountRaw, Symbol: it.Symbol,
			Asset: it.Asset, Status: it.Status, BlockNumber: bn, TimestampMs: ts,
		})
	}
	if err := h.d.BlockchainTransfersInsertIgnore(c.Request.Context(), body.ChainID, wallet, rows); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"ok": true, "inserted": len(rows)})
}

func (h *Handler) Clear(c *gin.Context) {
	chainID, ok := parseChainID(c.Query("chainId"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"message": "chainId and wallet query params are required", "code": "VALIDATION", "status": 400})
		return
	}
	wallet, ok := normalizeWallet(c.Query("wallet"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"message": "chainId and wallet query params are required", "code": "VALIDATION", "status": 400})
		return
	}
	if err := h.d.BlockchainTransfersClear(c.Request.Context(), chainID, wallet); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
