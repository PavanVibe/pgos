"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BedLockService = void 0;
const redis_1 = __importDefault(require("../../utils/redis"));
class BedLockService {
    static getLockKey(bedId) {
        return `pgos:bed-lock:${bedId}`;
    }
    /**
     * Acquires a lock on a bed number/ID for a specific operator.
     * TTL defaults to 5 minutes (300 seconds).
     */
    static async acquireLock(bedId, actorId, ttlSeconds = 300) {
        const lockKey = this.getLockKey(bedId);
        const result = await redis_1.default.set(lockKey, actorId, 'EX', ttlSeconds, 'NX');
        return result === 'OK';
    }
    /**
     * Releases a lock manually, ensuring the actor releasing it matches the owner.
     */
    static async releaseLock(bedId, actorId) {
        const lockKey = this.getLockKey(bedId);
        const currentOwner = await redis_1.default.get(lockKey);
        if (currentOwner === actorId) {
            await redis_1.default.del(lockKey);
            return true;
        }
        return false;
    }
    /**
     * Checks if a bed is currently locked, returning the owner ID if locked.
     */
    static async getLockOwner(bedId) {
        const lockKey = this.getLockKey(bedId);
        return await redis_1.default.get(lockKey);
    }
    /**
     * Verifies if the operator is allowed to mutate this bed.
     * Allowed if the bed is completely unlocked OR if the active operator owns the lock.
     */
    static async canMutate(bedId, actorId) {
        const owner = await this.getLockOwner(bedId);
        if (!owner)
            return true;
        return owner === actorId;
    }
}
exports.BedLockService = BedLockService;
//# sourceMappingURL=BedLockService.js.map