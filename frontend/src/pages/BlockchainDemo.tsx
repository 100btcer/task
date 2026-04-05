import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ConnectButton, useChainModal } from '@rainbow-me/rainbowkit';
import { formatUnits, isAddress, parseUnits } from 'viem';
import type { Hash } from 'viem';
import {
  useAccount,
  useBalance,
  useChainId,
  usePublicClient,
  useReadContracts,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import { Spinner, useToast } from '../components';
import { CHAIN_ID, CONTRACT_ADDRESS, getExpectedChainLabel, getNativeCurrencySymbol } from '../blockchain/config';
import { useTxConfirmationTimeout } from '../blockchain/useTxConfirmationTimeout';
import { blockchainUiConfig } from '../config/blockchainUiConfig';
import { MODAL_CLOSE_BUTTON_CLASS, modalCloseButtonStyle } from '../styles/modalClose';
import { ERC20_ABI } from '../blockchain/contract';
import { transactionExplorerUrl } from '../blockchain/explorer';
import {
  appendTransferHistoryRemote,
  clearTransferHistoryRemote,
  fetchTransferHistoryFromApi,
} from '../lib/transferHistoryApi';

const ZERO = '0x0000000000000000000000000000000000000000';

const TRANSFER_HISTORY_PAGE_SIZE = 5;

/** Extra headroom on top of `estimateContractGas` × `getGasPrice` (fee spikes, priority fee). */
const GAS_COST_BUFFER_NUM = 125n;
const GAS_COST_BUFFER_DEN = 100n;

/** Match API Demo primary actions — soft blue, clear enabled vs disabled. */
const transferBtnPrimaryBase: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  padding: '0.55rem 1.2rem',
  borderRadius: '8px',
  border: '1px solid transparent',
  color: '#fff',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
  minWidth: '8.5rem',
};

const transferBtnEnabled: CSSProperties = {
  ...transferBtnPrimaryBase,
  background: '#60a5fa',
  borderColor: '#3b82f6',
  boxShadow: '0 1px 3px rgba(96, 165, 250, 0.35)',
};

const transferBtnDisabled: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  padding: '0.55rem 1.2rem',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
  background: '#f1f5f9',
  color: '#94a3b8',
  cursor: 'not-allowed',
  boxShadow: 'none',
  minWidth: '8.5rem',
};

const transferBtnPending: CSSProperties = {
  ...transferBtnEnabled,
  opacity: 0.88,
  cursor: 'wait',
};

/** Match API Demo modals (Change status / Delete / …). */
const statusModalCardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  maxWidth: '440px',
  width: '100%',
  boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(15, 23, 42, 0.03)',
  overflow: 'hidden',
};

const statusModalHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '0.75rem',
  padding: '1.25rem 1.5rem 1rem',
  background: 'linear-gradient(180deg, #f8fafc 0%, #fff 100%)',
  borderBottom: '1px solid #f1f5f9',
};

const statusModalTitleStyle: CSSProperties = {
  margin: 0,
  flex: '1 1 auto',
  fontSize: '1.125rem',
  fontWeight: 700,
  color: '#0f172a',
  letterSpacing: '-0.02em',
  lineHeight: 1.35,
};

const statusModalBodyStyle: CSSProperties = {
  padding: '1.1rem 1.5rem 0',
};

const statusModalFooterStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: '0.65rem',
  marginTop: '1.35rem',
  padding: '1rem 1.5rem 1.25rem',
  borderTop: '1px solid #f1f5f9',
  background: '#fafafa',
};

const statusModalBtnSecondary: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  padding: '0.55rem 1.15rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#475569',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
  minWidth: '5.5rem',
};

const statusModalBtnPrimaryBase: CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 600,
  padding: '0.55rem 1.2rem',
  borderRadius: '8px',
  border: '1px solid transparent',
  color: '#fff',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.08)',
  minWidth: '8.5rem',
};

const modalDangerButton: CSSProperties = {
  ...statusModalBtnPrimaryBase,
  background: '#f87171',
  borderColor: '#ef4444',
  boxShadow: '0 1px 3px rgba(248, 113, 113, 0.35)',
};

/** Same as API Demo list row actions (View / Change status / Delete). */
const listActionBtn: CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  padding: '0.5rem 0.95rem',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  background: '#fff',
  color: '#334155',
  cursor: 'pointer',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
};

type TransferAsset = 'erc20' | 'native';

type PendingTransferMeta = {
  to: `0x${string}`;
  amountHuman: string;
  amountRaw: bigint;
  symbol: string;
};

type TransferHistoryRow = {
  hash: Hash;
  to: `0x${string}`;
  amountHuman: string;
  amountRaw: string;
  symbol: string;
  asset: TransferAsset;
  /** `failed` = could not confirm (RPC/timeout) — still listed for visibility */
  status: 'success' | 'reverted' | 'failed';
  blockNumber: bigint | null;
  timestamp: number;
};

type PersistedTransferRow = Omit<TransferHistoryRow, 'blockNumber'> & { blockNumber: string | null };

/** One list per wallet + chain (ERC-20 + native). */
function transferHistoryStorageKey(walletAddress: string): string {
  return `task-blockchain-transfer-history:v2:${CHAIN_ID}:${walletAddress.toLowerCase()}`;
}

function legacyTransferHistoryStorageKey(walletAddress: string): string {
  const contract = (CONTRACT_ADDRESS || ZERO).toLowerCase();
  return `task-blockchain-transfer-history:v1:${CHAIN_ID}:${walletAddress.toLowerCase()}:${contract}`;
}

function serializeTransferHistory(rows: TransferHistoryRow[]): string {
  const payload: PersistedTransferRow[] = rows.map((r) => ({
    ...r,
    blockNumber: r.blockNumber != null ? r.blockNumber.toString() : null,
  }));
  return JSON.stringify(payload);
}

function parseTransferHistory(json: string): TransferHistoryRow[] {
  const raw = JSON.parse(json) as (PersistedTransferRow & { asset?: TransferAsset })[];
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => {
    const status =
      r.status === 'success' || r.status === 'reverted' || r.status === 'failed' ? r.status : 'failed';
    const asset: TransferAsset = r.asset === 'native' ? 'native' : 'erc20';
    return {
      ...r,
      asset,
      status,
      blockNumber: r.blockNumber != null && r.blockNumber !== '' ? BigInt(r.blockNumber) : null,
    };
  });
}

function persistTransferHistory(walletAddress: string | undefined, rows: TransferHistoryRow[]): void {
  if (!walletAddress || typeof window === 'undefined') return;
  try {
    const key = transferHistoryStorageKey(walletAddress);
    if (rows.length === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, serializeTransferHistory(rows));
  } catch {
    /* quota or private mode */
  }
}

/** Best-effort sync of new row(s) to shared SQLite via Tasks API (backend-ts / backend-go). */
function syncNewTransferRowsToApi(walletAddress: string | undefined, rows: TransferHistoryRow[]): void {
  if (!walletAddress || rows.length === 0) return;
  void appendTransferHistoryRemote(CHAIN_ID, walletAddress, rows);
}

const panelStyle: CSSProperties = {
  padding: '1rem 1.1rem',
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
};

const panelTitleStyle: CSSProperties = {
  margin: '0 0 0.65rem',
  fontSize: '1.02rem',
  fontWeight: 700,
};

const dlStyle: CSSProperties = {
  margin: 0,
  display: 'grid',
  gap: '0.5rem 1.25rem',
  gridTemplateColumns: 'auto 1fr',
};

const dtStyle: CSSProperties = {
  fontWeight: 600,
  color: '#64748b',
  fontSize: '0.8rem',
};

function isContractConfigured(): boolean {
  return !!CONTRACT_ADDRESS && CONTRACT_ADDRESS.toLowerCase() !== ZERO;
}

/** Narrowed shape for `useReadContracts` result rows (enough for parsing). */
type ReadRow = { status: 'success' | 'failure'; result?: unknown };

function readDecimals(data: ReadRow[] | undefined, index: number): number {
  const r = data?.[index];
  if (r?.status !== 'success' || r.result === undefined) return 18;
  const v = r.result;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'bigint') return Number(v);
  return 18;
}

function readString(data: ReadRow[] | undefined, index: number): string | undefined {
  const r = data?.[index];
  return r?.status === 'success' && typeof r.result === 'string' ? r.result : undefined;
}

function readBigint(data: ReadRow[] | undefined, index: number): bigint | undefined {
  const r = data?.[index];
  return r?.status === 'success' && typeof r.result === 'bigint' ? r.result : undefined;
}

function formatTransferTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function BlockchainDemo() {
  const toast = useToast();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { openChainModal } = useChainModal();
  const {
    switchChainAsync,
    isPending: switchPending,
    error: switchChainError,
    reset: resetSwitchChain,
  } = useSwitchChain();

  const wrongNetwork = isConnected && chainId !== CHAIN_ID;
  const contractReady = isContractConfigured();
  const contractAddr = contractReady ? (CONTRACT_ADDRESS as `0x${string}`) : undefined;

  const tokenContracts = useMemo(() => {
    if (!contractAddr || wrongNetwork) return [];
    const c = { address: contractAddr, abi: ERC20_ABI } as const;
    return [
      { ...c, functionName: 'name' as const },
      { ...c, functionName: 'symbol' as const },
      { ...c, functionName: 'decimals' as const },
      { ...c, functionName: 'totalSupply' as const },
      ...(address ? [{ ...c, functionName: 'balanceOf' as const, args: [address] as const }] : []),
    ];
  }, [contractAddr, address, wrongNetwork]);

  const {
    data: tokenReads,
    isFetching: tokenReadsFetching,
    refetch: refetchTokenReads,
  } = useReadContracts({
    contracts: tokenContracts,
    query: { enabled: tokenContracts.length > 0 },
  });

  const {
    data: nativeBalance,
    isFetching: nativeFetching,
    refetch: refetchNative,
  } = useBalance({
    address,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(isConnected && address && !wrongNetwork) },
  });

  const tokenDecimals = readDecimals(tokenReads, 2);
  const tokenName = readString(tokenReads, 0);
  const tokenSymbol = readString(tokenReads, 1);
  const totalSupplyRaw = readBigint(tokenReads, 3);
  const userTokenRaw = address ? readBigint(tokenReads, 4) : undefined;

  const totalSupplyFormatted =
    totalSupplyRaw !== undefined ? formatUnits(totalSupplyRaw, tokenDecimals) : undefined;
  const userTokenFormatted =
    userTokenRaw !== undefined ? formatUnits(userTokenRaw, tokenDecimals) : undefined;

  const {
    writeContract,
    data: erc20Hash,
    isPending: isErc20WritePending,
    error: erc20WriteError,
    reset: resetErc20Write,
  } = useWriteContract();

  const {
    sendTransaction,
    data: nativeHash,
    isPending: isNativeSendPending,
    error: nativeSendError,
    reset: resetNativeSend,
  } = useSendTransaction();

  const {
    isLoading: isErc20Confirming,
    isSuccess: erc20HasReceipt,
    isError: erc20ReceiptWaitFailed,
    error: erc20ReceiptWaitError,
    data: erc20Receipt,
  } = useWaitForTransactionReceipt({
    hash: erc20Hash,
    pollingInterval: blockchainUiConfig.pollingIntervalMs,
  });

  const {
    isLoading: isNativeConfirming,
    isSuccess: nativeHasReceipt,
    isError: nativeReceiptWaitFailed,
    error: nativeReceiptWaitError,
    data: nativeReceipt,
  } = useWaitForTransactionReceipt({
    hash: nativeHash,
    pollingInterval: blockchainUiConfig.pollingIntervalMs,
  });

  const receiptPollSeconds = Math.max(1, Math.round(blockchainUiConfig.pollingIntervalMs / 1000));
  const receiptTimeoutSeconds = Math.round(blockchainUiConfig.confirmationTimeoutMs / 1000);

  const erc20ConfirmTimedOut = useTxConfirmationTimeout({
    hash: erc20Hash,
    isConfirming: isErc20Confirming,
    timeoutMs: blockchainUiConfig.confirmationTimeoutMs,
  });
  const nativeConfirmTimedOut = useTxConfirmationTimeout({
    hash: nativeHash,
    isConfirming: isNativeConfirming,
    timeoutMs: blockchainUiConfig.confirmationTimeoutMs,
  });

  const erc20TxSuccess = Boolean(erc20HasReceipt && erc20Receipt?.status === 'success');
  /** Wagmi throws on reverted receipts, so `receipt` is never `reverted` here — UI uses history / toasts for reverts. */
  const erc20TxReverted = Boolean(erc20HasReceipt && erc20Receipt?.status === 'reverted');
  const nativeTxSuccess = Boolean(nativeHasReceipt && nativeReceipt?.status === 'success');
  const nativeTxReverted = Boolean(nativeHasReceipt && nativeReceipt?.status === 'reverted');

  /** Inline transfer outcome (success/revert/errors/timeout) only while wallet is connected. */
  const showTransferFeedback = Boolean(isConnected && address);

  const transferUiActiveRef = useRef(false);
  useEffect(() => {
    transferUiActiveRef.current = showTransferFeedback;
  }, [showTransferFeedback]);

  useEffect(() => {
    if (isConnected) return;
    setTransferHint(null);
    setNativeTransferHint(null);
    resetErc20Write();
    resetNativeSend();
    toast.clearAll();
  }, [isConnected, resetErc20Write, resetNativeSend, toast]);

  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [transferHint, setTransferHint] = useState<string | null>(null);
  const [nativeToAddress, setNativeToAddress] = useState('');
  const [nativeAmount, setNativeAmount] = useState('');
  const [nativeTransferHint, setNativeTransferHint] = useState<string | null>(null);
  const [transferHistory, setTransferHistory] = useState<TransferHistoryRow[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const pendingErc20Ref = useRef<PendingTransferMeta | null>(null);
  const pendingNativeRef = useRef<PendingTransferMeta | null>(null);
  const processedTxHashesRef = useRef<Set<string>>(new Set());
  const successToastSentRef = useRef<Set<string>>(new Set());
  const erc20PrepLockRef = useRef(false);
  const nativePrepLockRef = useRef(false);

  const [isPreparingTokenTransfer, setIsPreparingTokenTransfer] = useState(false);
  const [isPreparingNativeTransfer, setIsPreparingNativeTransfer] = useState(false);

  const erc20TxBusy =
    isPreparingTokenTransfer ||
    isErc20WritePending ||
    (Boolean(erc20Hash) && isErc20Confirming);
  const nativeTxBusy =
    isPreparingNativeTransfer ||
    isNativeSendPending ||
    (Boolean(nativeHash) && isNativeConfirming);

  const decimalsReady = tokenReads?.[2]?.status === 'success';

  const transferFormReady =
    Boolean(toAddress.trim() && amount.trim()) &&
    !wrongNetwork &&
    contractReady &&
    Boolean(address) &&
    decimalsReady;

  const nativeDecimals = nativeBalance?.decimals ?? 18;
  const nativeCurrencyLabel = nativeBalance?.symbol ?? getNativeCurrencySymbol();

  const nativeTransferFormReady =
    Boolean(nativeToAddress.trim() && nativeAmount.trim()) && !wrongNetwork && Boolean(address);

  useEffect(() => {
    setHistoryPage(1);
    processedTxHashesRef.current = new Set();
    if (!address) {
      setTransferHistory([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      let localRows: TransferHistoryRow[] = [];
      try {
        const v2 = localStorage.getItem(transferHistoryStorageKey(address));
        if (v2) {
          localRows = parseTransferHistory(v2);
        } else {
          const v1 = localStorage.getItem(legacyTransferHistoryStorageKey(address));
          localRows = v1 ? parseTransferHistory(v1) : [];
          if (v1 && localRows.length > 0) {
            persistTransferHistory(address, localRows);
            try {
              localStorage.removeItem(legacyTransferHistoryStorageKey(address));
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        localRows = [];
      }

      const remote = await fetchTransferHistoryFromApi(CHAIN_ID, address);
      if (cancelled) return;

      if (remote === null) {
        setTransferHistory(localRows);
        processedTxHashesRef.current = new Set(localRows.map((r) => r.hash));
        return;
      }

      const serverHashes = new Set(remote.map((r) => r.hash));
      const missing = localRows.filter((r) => !serverHashes.has(r.hash));
      if (missing.length > 0) {
        await appendTransferHistoryRemote(CHAIN_ID, address, missing);
      }
      const merged = await fetchTransferHistoryFromApi(CHAIN_ID, address);
      if (cancelled) return;
      const finalRows = merged ?? remote;
      setTransferHistory(finalRows);
      processedTxHashesRef.current = new Set(finalRows.map((r) => r.hash));
      persistTransferHistory(address, finalRows);
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (erc20TxSuccess || nativeTxSuccess) {
      void refetchTokenReads();
      void refetchNative();
    }
  }, [erc20TxSuccess, nativeTxSuccess, refetchTokenReads, refetchNative]);

  useEffect(() => {
    if (!erc20HasReceipt || !erc20Hash || !erc20Receipt) return;
    if (!isConnected || !address) return;
    if (processedTxHashesRef.current.has(erc20Hash)) return;
    const meta = pendingErc20Ref.current;
    if (!meta) return;
    processedTxHashesRef.current.add(erc20Hash);
    pendingErc20Ref.current = null;
    const row: TransferHistoryRow = {
      hash: erc20Hash,
      to: meta.to,
      amountHuman: meta.amountHuman,
      amountRaw: meta.amountRaw.toString(),
      symbol: meta.symbol,
      asset: 'erc20',
      status: erc20Receipt.status === 'success' ? 'success' : 'reverted',
      blockNumber: erc20Receipt.blockNumber,
      timestamp: Date.now(),
    };
    setTransferHistory((prev) => {
      const next = [row, ...prev];
      if (address) persistTransferHistory(address, next);
      return next;
    });
    syncNewTransferRowsToApi(address, [row]);
    setHistoryPage(1);
    if (
      erc20Receipt.status === 'success' &&
      !successToastSentRef.current.has(erc20Hash) &&
      transferUiActiveRef.current
    ) {
      successToastSentRef.current.add(erc20Hash);
      toast.success('ERC-20 transfer confirmed on-chain.');
    }
  }, [erc20HasReceipt, erc20Hash, erc20Receipt, address, isConnected, toast]);

  useEffect(() => {
    if (!nativeHasReceipt || !nativeHash || !nativeReceipt) return;
    if (!isConnected || !address) return;
    if (processedTxHashesRef.current.has(nativeHash)) return;
    const meta = pendingNativeRef.current;
    if (!meta) return;
    processedTxHashesRef.current.add(nativeHash);
    pendingNativeRef.current = null;
    const row: TransferHistoryRow = {
      hash: nativeHash,
      to: meta.to,
      amountHuman: meta.amountHuman,
      amountRaw: meta.amountRaw.toString(),
      symbol: meta.symbol,
      asset: 'native',
      status: nativeReceipt.status === 'success' ? 'success' : 'reverted',
      blockNumber: nativeReceipt.blockNumber,
      timestamp: Date.now(),
    };
    setTransferHistory((prev) => {
      const next = [row, ...prev];
      if (address) persistTransferHistory(address, next);
      return next;
    });
    syncNewTransferRowsToApi(address, [row]);
    setHistoryPage(1);
    if (
      nativeReceipt.status === 'success' &&
      !successToastSentRef.current.has(nativeHash) &&
      transferUiActiveRef.current
    ) {
      successToastSentRef.current.add(nativeHash);
      toast.success(`${meta.symbol} transfer confirmed on-chain.`);
    }
  }, [nativeHasReceipt, nativeHash, nativeReceipt, address, isConnected, toast]);

  /**
   * Wagmi’s `waitForTransactionReceipt` throws when the receipt status is `reverted`, so the query ends in `isError`
   * and the success effect above never runs. Fetch the receipt with viem and still append history + toast.
   */
  useEffect(() => {
    if (!erc20Hash || !erc20ReceiptWaitFailed || !erc20ReceiptWaitError) return;
    if (!isConnected || !address) return;
    const meta = pendingErc20Ref.current;
    if (!meta) return;
    if (processedTxHashesRef.current.has(erc20Hash)) return;

    processedTxHashesRef.current.add(erc20Hash);
    pendingErc20Ref.current = null;

    const errMsg =
      erc20ReceiptWaitError instanceof Error ? erc20ReceiptWaitError.message : 'Transaction confirmation failed';

    const pushRow = (row: TransferHistoryRow, toastFn: 'error' | 'success', message: string) => {
      setTransferHistory((prev) => {
        const next = [row, ...prev];
        if (address) persistTransferHistory(address, next);
        return next;
      });
      syncNewTransferRowsToApi(address, [row]);
      setHistoryPage(1);
      if (!transferUiActiveRef.current) return;
      if (toastFn === 'error') toast.error(message);
      else toast.success(message);
    };

    if (!publicClient) {
      pushRow(
        {
          hash: erc20Hash,
          to: meta.to,
          amountHuman: meta.amountHuman,
          amountRaw: meta.amountRaw.toString(),
          symbol: meta.symbol,
          asset: 'erc20',
          status: 'failed',
          blockNumber: null,
          timestamp: Date.now(),
        },
        'error',
        `${errMsg} (could not load a public client to verify the receipt).`
      );
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rec = await publicClient.getTransactionReceipt({ hash: erc20Hash });
        if (cancelled) return;
        if (rec?.status === 'reverted') {
          pushRow(
            {
              hash: erc20Hash,
              to: meta.to,
              amountHuman: meta.amountHuman,
              amountRaw: meta.amountRaw.toString(),
              symbol: meta.symbol,
              asset: 'erc20',
              status: 'reverted',
              blockNumber: rec.blockNumber,
              timestamp: Date.now(),
            },
            'error',
            `ERC-20 transfer reverted: ${errMsg}`
          );
          return;
        }
        if (rec?.status === 'success') {
          void refetchTokenReads();
          void refetchNative();
          pushRow(
            {
              hash: erc20Hash,
              to: meta.to,
              amountHuman: meta.amountHuman,
              amountRaw: meta.amountRaw.toString(),
              symbol: meta.symbol,
              asset: 'erc20',
              status: 'success',
              blockNumber: rec.blockNumber,
              timestamp: Date.now(),
            },
            'success',
            'ERC-20 transfer confirmed on-chain.'
          );
          return;
        }
        pushRow(
          {
            hash: erc20Hash,
            to: meta.to,
            amountHuman: meta.amountHuman,
            amountRaw: meta.amountRaw.toString(),
            symbol: meta.symbol,
            asset: 'erc20',
            status: 'failed',
            blockNumber: null,
            timestamp: Date.now(),
          },
          'error',
          `${errMsg} (no receipt yet — check the explorer or try again).`
        );
      } catch (e) {
        if (cancelled) return;
        const m = e instanceof Error ? e.message : String(e);
        pushRow(
          {
            hash: erc20Hash,
            to: meta.to,
            amountHuman: meta.amountHuman,
            amountRaw: meta.amountRaw.toString(),
            symbol: meta.symbol,
            asset: 'erc20',
            status: 'failed',
            blockNumber: null,
            timestamp: Date.now(),
          },
          'error',
          `Could not read receipt: ${m}`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    erc20Hash,
    erc20ReceiptWaitFailed,
    erc20ReceiptWaitError,
    publicClient,
    address,
    isConnected,
    toast,
    refetchTokenReads,
    refetchNative,
  ]);

  useEffect(() => {
    if (!nativeHash || !nativeReceiptWaitFailed || !nativeReceiptWaitError) return;
    if (!isConnected || !address) return;
    const meta = pendingNativeRef.current;
    if (!meta) return;
    if (processedTxHashesRef.current.has(nativeHash)) return;

    processedTxHashesRef.current.add(nativeHash);
    pendingNativeRef.current = null;

    const errMsg =
      nativeReceiptWaitError instanceof Error ? nativeReceiptWaitError.message : 'Transaction confirmation failed';

    const pushRow = (row: TransferHistoryRow, toastFn: 'error' | 'success', message: string) => {
      setTransferHistory((prev) => {
        const next = [row, ...prev];
        if (address) persistTransferHistory(address, next);
        return next;
      });
      syncNewTransferRowsToApi(address, [row]);
      setHistoryPage(1);
      if (!transferUiActiveRef.current) return;
      if (toastFn === 'error') toast.error(message);
      else toast.success(message);
    };

    if (!publicClient) {
      pushRow(
        {
          hash: nativeHash,
          to: meta.to,
          amountHuman: meta.amountHuman,
          amountRaw: meta.amountRaw.toString(),
          symbol: meta.symbol,
          asset: 'native',
          status: 'failed',
          blockNumber: null,
          timestamp: Date.now(),
        },
        'error',
        `${errMsg} (could not load a public client to verify the receipt).`
      );
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const rec = await publicClient.getTransactionReceipt({ hash: nativeHash });
        if (cancelled) return;
        if (rec?.status === 'reverted') {
          pushRow(
            {
              hash: nativeHash,
              to: meta.to,
              amountHuman: meta.amountHuman,
              amountRaw: meta.amountRaw.toString(),
              symbol: meta.symbol,
              asset: 'native',
              status: 'reverted',
              blockNumber: rec.blockNumber,
              timestamp: Date.now(),
            },
            'error',
            `${meta.symbol} transfer reverted: ${errMsg}`
          );
          return;
        }
        if (rec?.status === 'success') {
          void refetchTokenReads();
          void refetchNative();
          pushRow(
            {
              hash: nativeHash,
              to: meta.to,
              amountHuman: meta.amountHuman,
              amountRaw: meta.amountRaw.toString(),
              symbol: meta.symbol,
              asset: 'native',
              status: 'success',
              blockNumber: rec.blockNumber,
              timestamp: Date.now(),
            },
            'success',
            `${meta.symbol} transfer confirmed on-chain.`
          );
          return;
        }
        pushRow(
          {
            hash: nativeHash,
            to: meta.to,
            amountHuman: meta.amountHuman,
            amountRaw: meta.amountRaw.toString(),
            symbol: meta.symbol,
            asset: 'native',
            status: 'failed',
            blockNumber: null,
            timestamp: Date.now(),
          },
          'error',
          `${errMsg} (no receipt yet — check the explorer or try again).`
        );
      } catch (e) {
        if (cancelled) return;
        const m = e instanceof Error ? e.message : String(e);
        pushRow(
          {
            hash: nativeHash,
            to: meta.to,
            amountHuman: meta.amountHuman,
            amountRaw: meta.amountRaw.toString(),
            symbol: meta.symbol,
            asset: 'native',
            status: 'failed',
            blockNumber: null,
            timestamp: Date.now(),
          },
          'error',
          `Could not read receipt: ${m}`
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    nativeHash,
    nativeReceiptWaitFailed,
    nativeReceiptWaitError,
    publicClient,
    address,
    isConnected,
    toast,
    refetchTokenReads,
    refetchNative,
  ]);

  const totalHistoryPages = Math.max(1, Math.ceil(transferHistory.length / TRANSFER_HISTORY_PAGE_SIZE));
  const historyPageClamped = Math.min(historyPage, totalHistoryPages);
  const historySlice = useMemo(() => {
    const start = (historyPageClamped - 1) * TRANSFER_HISTORY_PAGE_SIZE;
    return transferHistory.slice(start, start + TRANSFER_HISTORY_PAGE_SIZE);
  }, [transferHistory, historyPageClamped]);

  useEffect(() => {
    if (historyPage > totalHistoryPages) setHistoryPage(totalHistoryPages);
  }, [historyPage, totalHistoryPages]);

  const handleTransfer = async () => {
    if (!contractAddr || !address || wrongNetwork) return;
    if (erc20PrepLockRef.current || isErc20WritePending || (Boolean(erc20Hash) && isErc20Confirming)) return;

    const addr = toAddress.trim();
    const amountStr = amount.trim();
    if (!addr || !amountStr) return;
    if (!isAddress(addr)) {
      setTransferHint('Enter a valid 0x recipient address.');
      return;
    }
    if (!decimalsReady) {
      setTransferHint('Token decimals are still loading; try again in a moment.');
      return;
    }
    let raw: bigint;
    try {
      raw = parseUnits(amountStr, tokenDecimals);
    } catch {
      setTransferHint(
        `Invalid amount: use a decimal number with at most ${tokenDecimals} fractional digits (e.g. with 6 decimals, 0.01 is sent as 10000 on-chain units).`
      );
      return;
    }
    if (raw <= 0n) {
      setTransferHint('Amount must be greater than zero.');
      return;
    }

    erc20PrepLockRef.current = true;
    setIsPreparingTokenTransfer(true);
    setTransferHint(null);

    try {
      const { data: freshReads } = await refetchTokenReads();
      const latestTokenBal = freshReads ? readBigint(freshReads as ReadRow[], 4) : undefined;
      if (latestTokenBal === undefined) {
        const row = freshReads?.[4];
        const msg =
          row?.status === 'failure'
            ? 'Could not load your token balance. Check the network and try again.'
            : 'Your token balance is still loading; wait a moment and try again.';
        setTransferHint(msg);
        if (row?.status === 'failure') toast.error(msg);
        else toast.info(msg);
        return;
      }
      if (raw > latestTokenBal) {
        const sym = tokenSymbol ?? 'TOKEN';
        const have = formatUnits(latestTokenBal, tokenDecimals);
        const msg = `Insufficient ${sym} balance: you have ${have} ${sym}, but the transfer amount is ${amountStr} ${sym}.`;
        setTransferHint(msg);
        toast.error(msg);
        return;
      }

      if (!publicClient) {
        const msg = 'Cannot estimate network fees (no RPC client). Try again or refresh the page.';
        setTransferHint(msg);
        toast.error(msg);
        return;
      }

      const { data: nb } = await refetchNative();
      if (!nb) {
        const msg = 'Could not load native balance for gas. Wait a moment and try again.';
        setTransferHint(msg);
        toast.error(msg);
        return;
      }

      let gas: bigint;
      let gasPrice: bigint;
      try {
        [gas, gasPrice] = await Promise.all([
          publicClient.estimateContractGas({
            account: address,
            address: contractAddr,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [addr as `0x${string}`, raw],
          }),
          publicClient.getGasPrice(),
        ]);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        const msg = `Could not estimate gas: ${m}`;
        setTransferHint(msg);
        toast.error(msg);
        return;
      }

      const estimatedMaxWei = (gas * gasPrice * GAS_COST_BUFFER_NUM) / GAS_COST_BUFFER_DEN;
      if (nb.value < estimatedMaxWei) {
        const nativeSym = nb.symbol ?? 'native';
        const need = formatUnits(estimatedMaxWei, nb.decimals);
        const have = formatUnits(nb.value, nb.decimals);
        const msg = `Insufficient ${nativeSym} for network fees: need about ${need} ${nativeSym} (you have ${have} ${nativeSym}).`;
        setTransferHint(msg);
        toast.error(msg);
        return;
      }

      resetErc20Write();
      pendingErc20Ref.current = {
        to: addr as `0x${string}`,
        amountHuman: amountStr,
        amountRaw: raw,
        symbol: tokenSymbol ?? 'TOKEN',
      };
      writeContract(
        {
          address: contractAddr,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [addr as `0x${string}`, raw],
        },
        {
          onError: (err) => {
            pendingErc20Ref.current = null;
            toast.error(err instanceof Error ? err.message : 'Transfer was not submitted.');
          },
        }
      );
    } finally {
      setIsPreparingTokenTransfer(false);
      erc20PrepLockRef.current = false;
    }
  };

  const handleNativeTransfer = async () => {
    if (!address || wrongNetwork) return;
    if (nativePrepLockRef.current || isNativeSendPending || (Boolean(nativeHash) && isNativeConfirming)) return;

    const addr = nativeToAddress.trim();
    const amountStr = nativeAmount.trim();
    if (!addr || !amountStr) return;
    if (!isAddress(addr)) {
      setNativeTransferHint('Enter a valid 0x recipient address.');
      return;
    }

    let valueWei: bigint;
    try {
      valueWei = parseUnits(amountStr, nativeDecimals);
    } catch {
      setNativeTransferHint(
        `Invalid amount: use a decimal number with at most ${nativeDecimals} fractional digits.`
      );
      return;
    }
    if (valueWei <= 0n) {
      setNativeTransferHint('Amount must be greater than zero.');
      return;
    }

    nativePrepLockRef.current = true;
    setIsPreparingNativeTransfer(true);
    setNativeTransferHint(null);

    try {
      const { data: nb } = await refetchNative();
      if (!nb) {
        const msg = 'Could not load native balance. Wait a moment and try again.';
        setNativeTransferHint(msg);
        toast.error(msg);
        return;
      }

      if (valueWei > nb.value) {
        const sym = nb.symbol ?? getNativeCurrencySymbol();
        const have = formatUnits(nb.value, nb.decimals);
        const msg = `Insufficient ${sym} balance: you have ${have} ${sym}, but the transfer amount is ${amountStr} ${sym}.`;
        setNativeTransferHint(msg);
        toast.error(msg);
        return;
      }

      if (!publicClient) {
        const msg = 'Cannot estimate network fees (no RPC client). Try again or refresh the page.';
        setNativeTransferHint(msg);
        toast.error(msg);
        return;
      }

      let gas: bigint;
      let gasPrice: bigint;
      try {
        [gas, gasPrice] = await Promise.all([
          publicClient.estimateGas({
            account: address,
            to: addr as `0x${string}`,
            value: valueWei,
          }),
          publicClient.getGasPrice(),
        ]);
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        const msg = `Could not estimate gas: ${m}`;
        setNativeTransferHint(msg);
        toast.error(msg);
        return;
      }

      const gasCostBuffered = (gas * gasPrice * GAS_COST_BUFFER_NUM) / GAS_COST_BUFFER_DEN;
      const totalNeeded = valueWei + gasCostBuffered;

      if (nb.value < totalNeeded) {
        const sym = nb.symbol ?? getNativeCurrencySymbol();
        const need = formatUnits(totalNeeded, nb.decimals);
        const have = formatUnits(nb.value, nb.decimals);
        const msg = `Insufficient ${sym}: need about ${need} ${sym} for amount + network fees (you have ${have} ${sym}).`;
        setNativeTransferHint(msg);
        toast.error(msg);
        return;
      }

      const symSend = nb.symbol ?? getNativeCurrencySymbol();
      resetNativeSend();
      pendingNativeRef.current = {
        to: addr as `0x${string}`,
        amountHuman: amountStr,
        amountRaw: valueWei,
        symbol: symSend,
      };
      sendTransaction(
        {
          to: addr as `0x${string}`,
          value: valueWei,
          chainId: CHAIN_ID,
        },
        {
          onError: (err) => {
            pendingNativeRef.current = null;
            toast.error(err instanceof Error ? err.message : 'Transfer was not submitted.');
          },
        }
      );
    } finally {
      setIsPreparingNativeTransfer(false);
      nativePrepLockRef.current = false;
    }
  };

  const expectedLabel = getExpectedChainLabel();

  const handleSwitchChain = async () => {
    resetSwitchChain();
    try {
      await switchChainAsync({ chainId: CHAIN_ID });
    } catch {
      openChainModal?.();
    }
  };

  const tokenPanelLoading = tokenContracts.length > 0 && tokenReadsFetching && !tokenReads;
  const readFailure = tokenReads?.some((r) => r.status === 'failure');

  const rightColumnBlocked = contractReady && wrongNetwork && isConnected;

  return (
    <div style={{ textAlign: 'left' }}>
      <h1>Blockchain Demo</h1>
      <p>
        Wallets and networks use <strong>RainbowKit</strong> (official connect modal) on top of <strong>wagmi</strong> +{' '}
        <strong>viem</strong> on <strong>Polygon PoS mainnet</strong> (chain ID 137). Set{' '}
        <code>VITE_CHAIN_ID</code>, <code>VITE_CONTRACT_ADDRESS</code>, and <code>VITE_WALLETCONNECT_PROJECT_ID</code> in{' '}
        <code>.env</code> (free WalletConnect / Reown Cloud project for mobile &amp; WalletConnect).
      </p>

      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          marginTop: '0.75rem',
        }}
      >
        {/* Left: wallet + actions */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <p style={{ marginTop: 0 }}>
            Expected chain: <strong>{expectedLabel}</strong> (<code>chain ID {CHAIN_ID}</code>).
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <ConnectButton showBalance={false} />
          </div>

          {isConnected && wrongNetwork && (
            <div
              role="status"
              style={{ marginBottom: '1rem', padding: '0.75rem', background: '#fff7ed', borderRadius: '6px' }}
            >
              <strong>Wrong network.</strong> Switch to <strong>{expectedLabel}</strong> (chain ID <code>{CHAIN_ID}</code>)
              using the network control on the connect button, or:
              <button
                type="button"
                onClick={() => void handleSwitchChain()}
                disabled={switchPending}
                style={{ marginLeft: '0.75rem' }}
                aria-busy={switchPending}
              >
                {switchPending ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Spinner size="sm" />
                    Switching…
                  </span>
                ) : (
                  'Switch chain'
                )}
              </button>
              {switchChainError && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#b45309' }} role="alert">
                  {switchChainError.message}
                </p>
              )}
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                If the wallet does not prompt, the button opens RainbowKit&apos;s network picker to choose{' '}
                <strong>{expectedLabel}</strong>.
              </p>
            </div>
          )}

          {!contractReady && (
            <p style={{ color: '#64748b', marginBottom: '1rem' }}>
              Set <code>VITE_CONTRACT_ADDRESS</code> in <code>.env</code> to a Polygon ERC-20.
            </p>
          )}

          <>
            {!isConnected && (
              <p
                style={{
                  margin: '0 0 1rem',
                  padding: '0.65rem 0.85rem',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  fontSize: '0.88rem',
                  color: '#475569',
                  lineHeight: 1.5,
                }}
                role="status"
              >
                <strong>Wallet not connected.</strong> Use <strong>Connect</strong> above to sign transactions. You can fill
                the forms below first; <strong>Transfer</strong> buttons stay disabled until a wallet is connected.
              </p>
            )}
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.35rem' }}>Transfer ERC-20</h2>
              {contractReady ? (
                <p style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                  {!isConnected ? (
                    <>
                      Sends the configured ERC-20 on <strong>{expectedLabel}</strong> once a wallet is connected. Contract{' '}
                      <code style={{ fontSize: '0.76rem', wordBreak: 'break-all' }} title={CONTRACT_ADDRESS}>
                        {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-8)}
                      </code>
                      .
                    </>
                  ) : wrongNetwork ? (
                    <>
                      <strong>Token contract:</strong> ERC-20{' '}
                      <code style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}>{CONTRACT_ADDRESS}</code>. Switch to{' '}
                      <strong>{expectedLabel}</strong> to load the ticker and submit a transfer.
                    </>
                  ) : tokenSymbol || tokenName ? (
                    <>
                      Sends <strong>{tokenSymbol ?? '—'}</strong>
                      {tokenName && tokenName !== tokenSymbol ? <> ({tokenName})</> : null} on <strong>{expectedLabel}</strong>
                      {' — contract '}
                      <code style={{ fontSize: '0.76rem', wordBreak: 'break-all' }} title={CONTRACT_ADDRESS}>
                        {CONTRACT_ADDRESS.slice(0, 10)}…{CONTRACT_ADDRESS.slice(-8)}
                      </code>
                      .
                    </>
                  ) : readFailure ? (
                    <span style={{ color: '#b45309' }}>
                      Could not read token name/symbol. Transfer still targets ERC-20{' '}
                      <code style={{ fontSize: '0.76rem', wordBreak: 'break-all' }}>{CONTRACT_ADDRESS}</code>.
                    </span>
                  ) : tokenReadsFetching ? (
                    <>Loading token name and symbol…</>
                  ) : (
                    <>
                      ERC-20 transfer for{' '}
                      <code style={{ fontSize: '0.78rem', wordBreak: 'break-all' }}>{CONTRACT_ADDRESS}</code>.
                    </>
                  )}
                </p>
              ) : (
                <p style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                  Set <code>VITE_CONTRACT_ADDRESS</code> to enable ERC-20 transfer (separate from native coin below).
                </p>
              )}
              {contractReady && !wrongNetwork && isConnected && (
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
                  On <strong>Transfer ERC-20</strong>, the app refetches your token balance and your native balance for gas;
                  if either is insufficient, it shows a message and does not submit the transaction.
                </p>
              )}
              <div style={{ marginTop: '0.25rem' }}>
                <input
                  type="text"
                  value={toAddress}
                  onChange={(e) => {
                    setToAddress(e.target.value);
                    setTransferHint(null);
                  }}
                  placeholder="ERC-20 recipient (0x…)"
                  aria-label="ERC-20 transfer recipient"
                  disabled={!contractReady}
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    padding: '0.5rem',
                    width: '100%',
                    maxWidth: '400px',
                    boxSizing: 'border-box',
                    opacity: contractReady ? 1 : 0.6,
                  }}
                />
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setTransferHint(null);
                  }}
                  placeholder={
                    !contractReady
                      ? 'Set contract address first'
                      : decimalsReady
                        ? `ERC-20 amount (e.g. 0.01 — ${tokenDecimals} decimals)`
                        : 'Amount (loading decimals…)'
                  }
                  aria-label="ERC-20 transfer amount as a decimal token value"
                  disabled={!contractReady}
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    padding: '0.5rem',
                    width: '100%',
                    maxWidth: '400px',
                    boxSizing: 'border-box',
                    opacity: contractReady ? 1 : 0.6,
                  }}
                />
                {showTransferFeedback && transferHint && (
                  <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem', color: '#b45309' }} role="alert">
                    {transferHint}
                  </p>
                )}
                {showTransferFeedback && erc20WriteError && (
                  <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.5rem' }} role="alert">
                    {erc20WriteError.message}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void handleTransfer();
                  }}
                  disabled={
                    erc20TxBusy ||
                    !isConnected ||
                    !toAddress.trim() ||
                    !amount.trim() ||
                    wrongNetwork ||
                    !contractReady ||
                    !address ||
                    !decimalsReady
                  }
                  aria-busy={erc20TxBusy}
                  style={
                    erc20TxBusy ? transferBtnPending : transferFormReady ? transferBtnEnabled : transferBtnDisabled
                  }
                >
                  {erc20TxBusy ? (
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                      <Spinner size="sm" />
                      {isPreparingTokenTransfer
                        ? 'Checking balance and gas…'
                        : isErc20WritePending
                          ? 'Confirm in wallet…'
                          : erc20ConfirmTimedOut
                            ? 'Still waiting for receipt…'
                            : `Confirming on-chain… (poll every ${receiptPollSeconds}s)`}
                    </span>
                  ) : (
                    'Transfer ERC-20'
                  )}
                </button>
                {showTransferFeedback && erc20Hash && isErc20Confirming && erc20ConfirmTimedOut && (
                  <p
                    style={{
                      margin: '0.5rem 0 0',
                      padding: '0.5rem 0.65rem',
                      background: '#fffbeb',
                      border: '1px solid #fcd34d',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      color: '#92400e',
                      lineHeight: 1.45,
                      maxWidth: '400px',
                    }}
                    role="alert"
                  >
                    No on-chain receipt after {receiptTimeoutSeconds}s — the tx may still be pending, dropped, or the
                    network is slow. Check the explorer; confirmation can still arrive later.
                    {transactionExplorerUrl(erc20Hash) ? (
                      <>
                        {' '}
                        <a href={transactionExplorerUrl(erc20Hash)!} target="_blank" rel="noopener noreferrer">
                          Open in explorer
                        </a>
                      </>
                    ) : null}
                  </p>
                )}
                {showTransferFeedback && erc20TxSuccess && (
                  <span style={{ marginLeft: '0.5rem', color: 'green' }}>Success</span>
                )}
                {showTransferFeedback && erc20TxReverted && (
                  <span style={{ marginLeft: '0.5rem', color: 'red' }}>Reverted</span>
                )}
              </div>

              <hr
                style={{
                  border: 'none',
                  borderTop: '1px solid #e2e8f0',
                  margin: '1.35rem 0 1rem',
                }}
                aria-hidden="true"
              />

              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.35rem' }}>
                Transfer native ({nativeCurrencyLabel})
              </h2>
              <p style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                {!isConnected ? (
                  <>
                    Sends the chain gas token (<strong>{nativeCurrencyLabel}</strong> on <strong>{expectedLabel}</strong>)
                    after you connect — separate from the ERC-20 form above.
                  </>
                ) : wrongNetwork ? (
                  <>
                    Sends the chain gas token (e.g. <strong>POL</strong> on Polygon). Switch to{' '}
                    <strong>{expectedLabel}</strong> to submit.
                  </>
                ) : (
                  <>
                    Plain value transfer of <strong>{nativeCurrencyLabel}</strong> on <strong>{expectedLabel}</strong> — not
                    the ERC-20 above. The app refetches your native balance, checks that the amount does not exceed it, then
                    checks amount plus estimated network fees; if not enough, it warns you and does not submit.
                  </>
                )}
              </p>
              <div style={{ marginTop: '0.25rem' }}>
                <input
                  type="text"
                  value={nativeToAddress}
                  onChange={(e) => {
                    setNativeToAddress(e.target.value);
                    setNativeTransferHint(null);
                  }}
                  placeholder={`Native recipient (0x…) — ${nativeCurrencyLabel}`}
                  aria-label="Native coin transfer recipient"
                  disabled={wrongNetwork}
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    padding: '0.5rem',
                    width: '100%',
                    maxWidth: '400px',
                    boxSizing: 'border-box',
                    opacity: wrongNetwork ? 0.6 : 1,
                  }}
                />
                <input
                  type="text"
                  value={nativeAmount}
                  onChange={(e) => {
                    setNativeAmount(e.target.value);
                    setNativeTransferHint(null);
                  }}
                  placeholder={`Amount in ${nativeCurrencyLabel} (e.g. 0.01 — ${nativeDecimals} decimals)`}
                  aria-label="Native coin transfer amount"
                  disabled={wrongNetwork}
                  style={{
                    display: 'block',
                    marginBottom: '0.5rem',
                    padding: '0.5rem',
                    width: '100%',
                    maxWidth: '400px',
                    boxSizing: 'border-box',
                    opacity: wrongNetwork ? 0.6 : 1,
                  }}
                />
                {showTransferFeedback && nativeTransferHint && (
                  <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.85rem', color: '#b45309' }} role="alert">
                    {nativeTransferHint}
                  </p>
                )}
                {showTransferFeedback && nativeSendError && (
                  <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.5rem' }} role="alert">
                    {nativeSendError.message}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void handleNativeTransfer();
                  }}
                  disabled={
                    nativeTxBusy ||
                    !isConnected ||
                    !nativeToAddress.trim() ||
                    !nativeAmount.trim() ||
                    wrongNetwork ||
                    !address
                  }
                  aria-busy={nativeTxBusy}
                  style={
                    nativeTxBusy
                      ? transferBtnPending
                      : nativeTransferFormReady
                        ? transferBtnEnabled
                        : transferBtnDisabled
                  }
                >
                  {nativeTxBusy ? (
                    <span
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                    >
                      <Spinner size="sm" />
                      {isPreparingNativeTransfer
                        ? 'Checking balance and gas…'
                        : isNativeSendPending
                          ? 'Confirm in wallet…'
                          : nativeConfirmTimedOut
                            ? 'Still waiting for receipt…'
                            : `Confirming on-chain… (poll every ${receiptPollSeconds}s)`}
                    </span>
                  ) : (
                    `Transfer ${nativeCurrencyLabel}`
                  )}
                </button>
                {showTransferFeedback && nativeHash && isNativeConfirming && nativeConfirmTimedOut && (
                  <p
                    style={{
                      margin: '0.5rem 0 0',
                      padding: '0.5rem 0.65rem',
                      background: '#fffbeb',
                      border: '1px solid #fcd34d',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      color: '#92400e',
                      lineHeight: 1.45,
                      maxWidth: '400px',
                    }}
                    role="alert"
                  >
                    No on-chain receipt after {receiptTimeoutSeconds}s — the tx may still be pending, dropped, or the
                    network is slow. Check the explorer; confirmation can still arrive later.
                    {transactionExplorerUrl(nativeHash) ? (
                      <>
                        {' '}
                        <a href={transactionExplorerUrl(nativeHash)!} target="_blank" rel="noopener noreferrer">
                          Open in explorer
                        </a>
                      </>
                    ) : null}
                  </p>
                )}
                {showTransferFeedback && nativeTxSuccess && (
                  <span style={{ marginLeft: '0.5rem', color: 'green' }}>Success</span>
                )}
                {showTransferFeedback && nativeTxReverted && (
                  <span style={{ marginLeft: '0.5rem', color: 'red' }}>Reverted</span>
                )}
              </div>
          </>
        </div>

        {/* Right: balances first, then token metadata */}
        <div style={{ flex: '1 1 300px', minWidth: 0 }}>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 0.75rem' }}>On-chain data</h2>

          {!contractReady && (
            <p style={{ color: '#64748b', margin: 0 }}>
              Set <code>VITE_CONTRACT_ADDRESS</code> to show token details and balances here.
            </p>
          )}

          {contractReady && rightColumnBlocked && (
            <div style={{ ...panelStyle, marginBottom: '0.75rem' }} role="status">
              <p style={{ margin: 0, color: '#64748b' }}>
                Switch to <strong>{expectedLabel}</strong> to load contract data in this column.
              </p>
            </div>
          )}

          {contractReady && !wrongNetwork && (
            <>
              <section style={{ ...panelStyle, marginBottom: '1rem' }} aria-label="Your balances">
                <h3 style={panelTitleStyle}>Your balances</h3>
                {!isConnected || !address ? (
                  <p style={{ margin: 0, color: '#94a3b8' }}>Connect a wallet to see your balances on Polygon.</p>
                ) : tokenPanelLoading ? (
                  <p style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }} role="status">
                    <Spinner size="sm" />
                    Loading…
                  </p>
                ) : (
                  <dl style={dlStyle}>
                    <dt style={dtStyle}>{tokenSymbol ?? 'Token'}</dt>
                    <dd style={{ margin: 0 }}>
                      {tokenReadsFetching && userTokenRaw === undefined ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Spinner size="sm" />
                          Loading…
                        </span>
                      ) : userTokenFormatted != null && tokenSymbol ? (
                        `${userTokenFormatted} ${tokenSymbol}`
                      ) : (
                        '—'
                      )}
                    </dd>
                    <dt style={dtStyle}>{nativeCurrencyLabel}</dt>
                    <dd style={{ margin: 0 }}>
                      {nativeFetching && !nativeBalance ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Spinner size="sm" />
                          Loading…
                        </span>
                      ) : nativeBalance ? (
                        `${nativeBalance.formatted} ${nativeBalance.symbol}`
                      ) : (
                        '—'
                      )}
                    </dd>
                  </dl>
                )}
              </section>

              <section style={panelStyle} aria-label="Token metadata">
                <h3 style={panelTitleStyle}>Token metadata</h3>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', wordBreak: 'break-all', color: '#475569' }}>
                  <strong>Contract</strong>{' '}
                  <a
                    href={`https://polygonscan.com/address/${contractAddr}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {contractAddr}
                  </a>
                </p>
                {tokenPanelLoading ? (
                  <p style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: 0 }} role="status">
                    <Spinner size="sm" />
                    Loading…
                  </p>
                ) : (
                  <dl style={dlStyle}>
                    <dt style={dtStyle}>Name</dt>
                    <dd style={{ margin: 0 }}>{tokenName ?? '—'}</dd>
                    <dt style={dtStyle}>Symbol</dt>
                    <dd style={{ margin: 0 }}>{tokenSymbol ?? '—'}</dd>
                    <dt style={dtStyle}>Decimals</dt>
                    <dd style={{ margin: 0 }}>{tokenReads?.[2]?.status === 'success' ? String(tokenDecimals) : '—'}</dd>
                    <dt style={dtStyle}>Total supply</dt>
                    <dd style={{ margin: 0 }}>
                      {totalSupplyFormatted != null && tokenSymbol
                        ? `${totalSupplyFormatted} ${tokenSymbol}`
                        : totalSupplyFormatted != null
                          ? totalSupplyFormatted
                          : '—'}
                    </dd>
                  </dl>
                )}
              </section>

              {readFailure && (
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem', color: '#b45309' }} role="alert">
                  Some contract reads failed (non-standard ERC-20 or RPC error). Check the console or Polygonscan.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      <section style={{ marginTop: '2rem' }} aria-label="Transfer history">
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Transfer history</h2>
          {isConnected && transferHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setClearHistoryOpen(true)}
              style={{ ...listActionBtn, borderColor: '#fecaca', color: '#b91c1c' }}
            >
              Clear history
            </button>
          )}
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#64748b' }}>
          Each row shows whether the transfer was <strong>ERC-20</strong> or <strong>native</strong> chain coin. Amounts use
          the asset&apos;s decimals. Rows are stored in the shared Tasks API database (same SQLite as{' '}
          <code>backend-ts</code> / <code>backend-go</code>) and mirrored in this browser for offline resilience.
        </p>
        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.88rem',
              background: '#fff',
            }}
          >
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: '0.55rem 0.75rem', fontWeight: 600, width: '3.25rem' }}>ID</th>
                <th style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>Asset</th>
                <th style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>Time</th>
                <th style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>Block</th>
                <th style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>To</th>
                <th style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>On-chain units</th>
                <th style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>Transaction</th>
              </tr>
            </thead>
            <tbody>
              {transferHistory.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: '1.1rem 0.75rem',
                      color: '#64748b',
                      textAlign: 'center',
                      borderTop: '1px solid #e2e8f0',
                    }}
                  >
                    {!isConnected
                      ? 'Connect a wallet to load transfer history for this chain (from the API when available).'
                      : 'ERC-20 and native transfers appear here after you submit them (successful, reverted, or failed).'}
                  </td>
                </tr>
              ) : (
                historySlice.map((row, sliceIndex) => {
                      const url = transactionExplorerUrl(row.hash);
                      const rowId =
                        (historyPageClamped - 1) * TRANSFER_HISTORY_PAGE_SIZE + sliceIndex + 1;
                      return (
                        <tr key={`${row.hash}-${row.timestamp}`} style={{ borderTop: '1px solid #e2e8f0' }}>
                          <td
                            style={{
                              padding: '0.55rem 0.75rem',
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              color: '#475569',
                              whiteSpace: 'nowrap',
                            }}
                            title="Order in history (#1 = most recent)"
                          >
                            #{rowId}
                          </td>
                          <td
                            style={{
                              padding: '0.55rem 0.75rem',
                              fontWeight: 600,
                              fontSize: '0.82rem',
                              whiteSpace: 'nowrap',
                              color: row.asset === 'native' ? '#0369a1' : '#5b21b6',
                            }}
                          >
                            {row.asset === 'native' ? `Native (${row.symbol})` : `ERC-20 (${row.symbol})`}
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem', whiteSpace: 'nowrap', color: '#475569' }}>
                            {formatTransferTime(row.timestamp)}
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem', fontFamily: 'ui-monospace, monospace', fontSize: '0.8rem' }}>
                            {row.blockNumber != null ? row.blockNumber.toString() : '—'}
                          </td>
                          <td
                            style={{
                              padding: '0.55rem 0.75rem',
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: '0.8rem',
                              wordBreak: 'break-all',
                              maxWidth: '10rem',
                            }}
                          >
                            {row.to}
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem' }}>
                            {row.amountHuman} {row.symbol}
                          </td>
                          <td
                            style={{
                              padding: '0.55rem 0.75rem',
                              fontFamily: 'ui-monospace, monospace',
                              fontSize: '0.78rem',
                            }}
                          >
                            {row.amountRaw}
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem' }}>
                            <span
                              style={{
                                fontWeight: 600,
                                color:
                                  row.status === 'success'
                                    ? '#166534'
                                    : row.status === 'reverted'
                                      ? '#b91c1c'
                                      : '#b45309',
                              }}
                            >
                              {row.status === 'success'
                                ? 'Success'
                                : row.status === 'reverted'
                                  ? 'Reverted'
                                  : 'Failed'}
                            </span>
                          </td>
                          <td style={{ padding: '0.55rem 0.75rem', wordBreak: 'break-all' }}>
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer">
                                {row.hash.slice(0, 10)}…{row.hash.slice(-8)}
                              </a>
                            ) : (
                              <code style={{ fontSize: '0.78rem' }}>{row.hash}</code>
                            )}
                          </td>
                        </tr>
                      );
                    })
              )}
            </tbody>
          </table>
        </div>
        {transferHistory.length > 0 && totalHistoryPages > 1 && (
          <nav
            style={{
              marginTop: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
            aria-label="Transfer history pagination"
          >
            <button
              type="button"
              disabled={historyPageClamped <= 1}
              onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
              style={listActionBtn}
            >
              Previous
            </button>
            <span style={{ fontSize: '0.9rem', color: '#475569' }}>
              Page {historyPageClamped} / {totalHistoryPages} ({transferHistory.length} transfer
              {transferHistory.length === 1 ? '' : 's'})
            </span>
            <button
              type="button"
              disabled={historyPageClamped >= totalHistoryPages}
              onClick={() => setHistoryPage((p) => Math.min(totalHistoryPages, p + 1))}
              style={listActionBtn}
            >
              Next
            </button>
          </nav>
        )}
      </section>

      {clearHistoryOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem',
          }}
          role="presentation"
          onClick={() => setClearHistoryOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-history-title"
            onClick={(e) => e.stopPropagation()}
            style={statusModalCardStyle}
          >
            <div style={statusModalHeaderStyle}>
              <h3 id="clear-history-title" style={statusModalTitleStyle}>
                Clear transfer history?
              </h3>
              <button
                type="button"
                aria-label="Close"
                className={MODAL_CLOSE_BUTTON_CLASS}
                style={modalCloseButtonStyle}
                onClick={() => setClearHistoryOpen(false)}
              >
                ×
              </button>
            </div>
            <div style={statusModalBodyStyle}>
              <p style={{ margin: '0 0 0.85rem', color: '#334155', fontSize: '0.95rem', lineHeight: 1.5 }}>
                This removes all entries from the list, from the shared API database, and from this browser&apos;s cache
                for this wallet on this chain (ERC-20 and native).
              </p>
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  background: '#fef2f2',
                  borderRadius: '8px',
                  border: '1px solid #fecaca',
                }}
                role="alert"
              >
                <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#b91c1c' }}>
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div style={statusModalFooterStyle}>
              <button type="button" style={statusModalBtnSecondary} onClick={() => setClearHistoryOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                style={modalDangerButton}
                onClick={() => {
                  void (async () => {
                    if (address) {
                      await clearTransferHistoryRemote(CHAIN_ID, address);
                    }
                    setTransferHistory([]);
                    setHistoryPage(1);
                    processedTxHashesRef.current = new Set();
                    if (address) persistTransferHistory(address, []);
                    setClearHistoryOpen(false);
                  })();
                }}
              >
                Clear history
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
