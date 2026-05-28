import { EventEmitter } from 'events';
import { EventType } from '../types/eventTypes';
export declare const eventBus: EventEmitter<any>;
export { EventType };
export declare const CoreEvents: typeof EventType;
export declare const emitAndLogEvent: (entityId: string, eventType: EventType | string, metadata?: any) => Promise<void>;
//# sourceMappingURL=eventBus.d.ts.map