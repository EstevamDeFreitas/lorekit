import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SyncOperationDto } from './dto/push-sync.dto';

describe('calendar synchronization contract', () => {
  it.each(['Calendar', 'CalendarRevision'])('accepts %s with the existing versioned generic payload', async entityType => {
    const payload = entityType === 'Calendar'
      ? { id: 'calendar', worldId: 'world', latestRevisionId: 'revision' }
      : { id: 'revision', calendarId: 'calendar', revision: 1, rulesJson: '{"version":1,"months":[]}' };
    const operation = plainToInstance(SyncOperationDto, { operationId: 'eb55e03b-6995-4bcf-b9ae-4b38108b7e9a', entityType, entityId: payload.id, operation: 'upsert', schemaVersion: 1, payload });
    expect(await validate(operation)).toEqual([]);
    expect(JSON.parse(JSON.stringify(operation)).payload).toEqual(payload);
  });
  it('preserves date references until their revisions arrive', async () => {
    const payload = { id: 'event', calendarStartJson: '{"version":1,"calendarId":"calendar","revisionId":"not-yet-received","precision":"year","year":-4}' };
    const operation = plainToInstance(SyncOperationDto, { operationId: 'eb55e03b-6995-4bcf-b9ae-4b38108b7e9a', entityType: 'Event', entityId: 'event', operation: 'upsert', schemaVersion: 1, payload });
    expect(await validate(operation)).toEqual([]);
    expect(operation.payload).toEqual(payload);
  });
});
