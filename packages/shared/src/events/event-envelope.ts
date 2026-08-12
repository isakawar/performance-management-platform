import { randomUUID } from 'crypto';

export interface EventEnvelope<TPayload> {
  eventId: string;
  eventType: string;
  occurredAt: string;
  payload: TPayload;
}

export function createEventEnvelope<TPayload>(
  eventType: string,
  payload: TPayload,
  idGenerator: () => string = randomUUID,
): EventEnvelope<TPayload> {
  return {
    eventId: idGenerator(),
    eventType,
    occurredAt: new Date().toISOString(),
    payload,
  };
}
