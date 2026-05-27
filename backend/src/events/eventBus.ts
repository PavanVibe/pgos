import { EventEmitter } from 'events';
import prisma from '../utils/prisma';
import { EventType } from '../types/eventTypes';

export const eventBus = new EventEmitter();

// Export CoreEvents as backward-compatible map/enum, or re-export standard types
export { EventType };
export const CoreEvents = EventType;

// Helper to log events to DB
export const emitAndLogEvent = async (entityId: string, eventType: EventType | string, metadata: any = {}) => {
  eventBus.emit(eventType, { entityId, ...metadata });
  
  await prisma.eventLog.create({
    data: {
      entityId,
      eventType: eventType as string,
      metadata,
    }
  });
};

