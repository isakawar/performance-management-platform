import { createEventEnvelope } from './event-envelope';

describe('createEventEnvelope', () => {
  it('wraps a payload with eventId, eventType, occurredAt, and the payload itself', () => {
    const envelope = createEventEnvelope(
      'AssessmentSubmitted',
      { reviewId: 'r-1', userId: 'u-1' },
      () => 'fixed-id',
    );

    expect(envelope).toEqual({
      eventId: 'fixed-id',
      eventType: 'AssessmentSubmitted',
      occurredAt: envelope.occurredAt,
      payload: { reviewId: 'r-1', userId: 'u-1' },
    });
  });

  it('produces a parseable ISO-8601 timestamp', () => {
    const envelope = createEventEnvelope('AssessmentSubmitted', {}, () => 'fixed-id');

    expect(Number.isNaN(Date.parse(envelope.occurredAt))).toBe(false);
  });

  it('defaults to a random eventId when no generator is supplied', () => {
    const first = createEventEnvelope('AssessmentSubmitted', {});
    const second = createEventEnvelope('AssessmentSubmitted', {});

    expect(first.eventId).not.toBe(second.eventId);
  });
});
