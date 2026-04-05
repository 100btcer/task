import { useEffect, useState } from 'react';
import type { Hash } from 'viem';

/**
 * True after `timeoutMs` elapses while `hash` is set and `isConfirming` is still true.
 * Resets when the hash changes, confirmation finishes, or the wait is no longer active.
 */
export function useTxConfirmationTimeout({
  hash,
  isConfirming,
  timeoutMs,
}: {
  hash: Hash | undefined;
  isConfirming: boolean;
  timeoutMs: number;
}): boolean {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!hash || !isConfirming) {
      setTimedOut(false);
      return;
    }
    setTimedOut(false);
    const id = window.setTimeout(() => setTimedOut(true), timeoutMs);
    return () => window.clearTimeout(id);
  }, [hash, isConfirming, timeoutMs]);

  return timedOut;
}
