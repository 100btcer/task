/**
 * Synchronous in-flight flags so a second `mutate()` in the same tick (double-click)
 * cannot run before React re-renders disabled buttons.
 */
let createLocked = false;
let patchLocked = false;
let deleteLocked = false;

export function tryAcquireCreateLock(): boolean {
  if (createLocked) return false;
  createLocked = true;
  return true;
}

export function releaseCreateLock(): void {
  createLocked = false;
}

export function tryAcquirePatchLock(): boolean {
  if (patchLocked) return false;
  patchLocked = true;
  return true;
}

export function releasePatchLock(): void {
  patchLocked = false;
}

export function tryAcquireDeleteLock(): boolean {
  if (deleteLocked) return false;
  deleteLocked = true;
  return true;
}

export function releaseDeleteLock(): void {
  deleteLocked = false;
}
