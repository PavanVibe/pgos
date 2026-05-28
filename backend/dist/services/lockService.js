"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.canAllocateBed = exports.releaseBedLock = exports.getBedLockOwner = exports.lockBed = void 0;
const BedLockService_1 = require("./locks/BedLockService");
/**
 * Creates a temporary reservation lock for a bed.
 * Locks the bed for 5 minutes (300 seconds).
 */
const lockBed = async (bedId, actorId) => {
    return await BedLockService_1.BedLockService.acquireLock(bedId, actorId);
};
exports.lockBed = lockBed;
/**
 * Checks if a bed is locked, and by whom.
 */
const getBedLockOwner = async (bedId) => {
    return await BedLockService_1.BedLockService.getLockOwner(bedId);
};
exports.getBedLockOwner = getBedLockOwner;
/**
 * Releases the bed lock manually.
 * Requires verifying the actor releasing it is the owner.
 */
const releaseBedLock = async (bedId, actorId) => {
    return await BedLockService_1.BedLockService.releaseLock(bedId, actorId);
};
exports.releaseBedLock = releaseBedLock;
/**
 * Verifies if the actor is allowed to allocate this bed.
 * True if it's unlocked, OR if the current actor holds the lock.
 */
const canAllocateBed = async (bedId, actorId) => {
    return await BedLockService_1.BedLockService.canMutate(bedId, actorId);
};
exports.canAllocateBed = canAllocateBed;
//# sourceMappingURL=lockService.js.map