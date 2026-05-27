export declare class BedLockService {
    private static getLockKey;
    /**
     * Acquires a lock on a bed number/ID for a specific operator.
     * TTL defaults to 5 minutes (300 seconds).
     */
    static acquireLock(bedId: string, actorId: string, ttlSeconds?: number): Promise<boolean>;
    /**
     * Releases a lock manually, ensuring the actor releasing it matches the owner.
     */
    static releaseLock(bedId: string, actorId: string): Promise<boolean>;
    /**
     * Checks if a bed is currently locked, returning the owner ID if locked.
     */
    static getLockOwner(bedId: string): Promise<string | null>;
    /**
     * Verifies if the operator is allowed to mutate this bed.
     * Allowed if the bed is completely unlocked OR if the active operator owns the lock.
     */
    static canMutate(bedId: string, actorId: string): Promise<boolean>;
}
//# sourceMappingURL=BedLockService.d.ts.map