"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentLockService = void 0;
const redis_1 = __importDefault(require("../../utils/redis"));
class PaymentLockService {
    static getLockKey(invoiceOrTenantId) {
        return `pgos:payment-lock:${invoiceOrTenantId}`;
    }
    /**
     * Acquires a lock on a payment transaction.
     * TTL is set to a short duration (10 seconds) to prevent double clicks.
     */
    static async acquireLock(invoiceOrTenantId, actorId, ttlSeconds = 10) {
        const lockKey = this.getLockKey(invoiceOrTenantId);
        const result = await redis_1.default.set(lockKey, actorId, 'EX', ttlSeconds, 'NX');
        return result === 'OK';
    }
    /**
     * Releases a payment transaction lock.
     */
    static async releaseLock(invoiceOrTenantId, actorId) {
        const lockKey = this.getLockKey(invoiceOrTenantId);
        const currentOwner = await redis_1.default.get(lockKey);
        if (currentOwner === actorId) {
            await redis_1.default.del(lockKey);
            return true;
        }
        return false;
    }
}
exports.PaymentLockService = PaymentLockService;
//# sourceMappingURL=PaymentLockService.js.map