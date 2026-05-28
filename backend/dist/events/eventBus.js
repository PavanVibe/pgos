"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitAndLogEvent = exports.CoreEvents = exports.EventType = exports.eventBus = void 0;
const events_1 = require("events");
const prisma_1 = __importDefault(require("../utils/prisma"));
const eventTypes_1 = require("../types/eventTypes");
Object.defineProperty(exports, "EventType", { enumerable: true, get: function () { return eventTypes_1.EventType; } });
exports.eventBus = new events_1.EventEmitter();
exports.CoreEvents = eventTypes_1.EventType;
// Helper to log events to DB
const emitAndLogEvent = async (entityId, eventType, metadata = {}) => {
    exports.eventBus.emit(eventType, { entityId, ...metadata });
    await prisma_1.default.eventLog.create({
        data: {
            entityId,
            eventType: eventType,
            metadata,
        }
    });
};
exports.emitAndLogEvent = emitAndLogEvent;
//# sourceMappingURL=eventBus.js.map