import redis from '../../utils/redis';

export class BedLockService {
  private static getLockKey(bedId: string): string {
    return `pgos:bed-lock:${bedId}`;
  }

  /**
   * Acquires a lock on a bed number/ID for a specific operator.
   * TTL defaults to 5 minutes (300 seconds).
   */
  static async acquireLock(bedId: string, actorId: string, ttlSeconds = 300): Promise<boolean> {
    const lockKey = this.getLockKey(bedId);
    const result = await redis.set(lockKey, actorId, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Releases a lock manually, ensuring the actor releasing it matches the owner.
   */
  static async releaseLock(bedId: string, actorId: string): Promise<boolean> {
    const lockKey = this.getLockKey(bedId);
    const currentOwner = await redis.get(lockKey);
    if (currentOwner === actorId) {
      await redis.del(lockKey);
      return true;
    }
    return false;
  }

  /**
   * Checks if a bed is currently locked, returning the owner ID if locked.
   */
  static async getLockOwner(bedId: string): Promise<string | null> {
    const lockKey = this.getLockKey(bedId);
    return await redis.get(lockKey);
  }

  /**
   * Verifies if the operator is allowed to mutate this bed.
   * Allowed if the bed is completely unlocked OR if the active operator owns the lock.
   */
  static async canMutate(bedId: string, actorId: string): Promise<boolean> {
    const owner = await this.getLockOwner(bedId);
    if (!owner) return true;
    return owner === actorId;
  }
}
