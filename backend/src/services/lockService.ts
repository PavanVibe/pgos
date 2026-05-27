import { BedLockService } from './locks/BedLockService';

/**
 * Creates a temporary reservation lock for a bed.
 * Locks the bed for 5 minutes (300 seconds).
 */
export const lockBed = async (bedId: string, actorId: string): Promise<boolean> => {
  return await BedLockService.acquireLock(bedId, actorId);
};

/**
 * Checks if a bed is locked, and by whom.
 */
export const getBedLockOwner = async (bedId: string): Promise<string | null> => {
  return await BedLockService.getLockOwner(bedId);
};

/**
 * Releases the bed lock manually.
 * Requires verifying the actor releasing it is the owner.
 */
export const releaseBedLock = async (bedId: string, actorId: string): Promise<boolean> => {
  return await BedLockService.releaseLock(bedId, actorId);
};

/**
 * Verifies if the actor is allowed to allocate this bed.
 * True if it's unlocked, OR if the current actor holds the lock.
 */
export const canAllocateBed = async (bedId: string, actorId: string): Promise<boolean> => {
  return await BedLockService.canMutate(bedId, actorId);
};

