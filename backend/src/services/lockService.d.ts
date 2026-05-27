/**
 * Creates a temporary reservation lock for a bed.
 * Locks the bed for 5 minutes (300 seconds).
 */
export declare const lockBed: (bedId: string, actorId: string) => Promise<boolean>;
/**
 * Checks if a bed is locked, and by whom.
 */
export declare const getBedLockOwner: (bedId: string) => Promise<string | null>;
/**
 * Releases the bed lock manually.
 * Requires verifying the actor releasing it is the owner.
 */
export declare const releaseBedLock: (bedId: string, actorId: string) => Promise<boolean>;
/**
 * Verifies if the actor is allowed to allocate this bed.
 * True if it's unlocked, OR if the current actor holds the lock.
 */
export declare const canAllocateBed: (bedId: string, actorId: string) => Promise<boolean>;
//# sourceMappingURL=lockService.d.ts.map