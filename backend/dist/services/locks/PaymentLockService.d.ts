export declare class PaymentLockService {
    private static getLockKey;
    /**
     * Acquires a lock on a payment transaction.
     * TTL is set to a short duration (10 seconds) to prevent double clicks.
     */
    static acquireLock(invoiceOrTenantId: string, actorId: string, ttlSeconds?: number): Promise<boolean>;
    /**
     * Releases a payment transaction lock.
     */
    static releaseLock(invoiceOrTenantId: string, actorId: string): Promise<boolean>;
}
//# sourceMappingURL=PaymentLockService.d.ts.map