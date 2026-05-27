import redis from '../../utils/redis';

export class PaymentLockService {
  private static getLockKey(invoiceOrTenantId: string): string {
    return `pgos:payment-lock:${invoiceOrTenantId}`;
  }

  /**
   * Acquires a lock on a payment transaction.
   * TTL is set to a short duration (10 seconds) to prevent double clicks.
   */
  static async acquireLock(invoiceOrTenantId: string, actorId: string, ttlSeconds = 10): Promise<boolean> {
    const lockKey = this.getLockKey(invoiceOrTenantId);
    const result = await redis.set(lockKey, actorId, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Releases a payment transaction lock.
   */
  static async releaseLock(invoiceOrTenantId: string, actorId: string): Promise<boolean> {
    const lockKey = this.getLockKey(invoiceOrTenantId);
    const currentOwner = await redis.get(lockKey);
    if (currentOwner === actorId) {
      await redis.del(lockKey);
      return true;
    }
    return false;
  }
}
