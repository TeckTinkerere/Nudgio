import type {Instant, LocalTime, ReminderSummary, UUID} from '../../../native-client/types';
import {relativeDayOf, reminderStatus, sortByStatus} from '../reminderStatus';

const NOW = new Date(2026, 9, 2, 12, 0, 0);

const base = (id: string, overrides: Partial<ReminderSummary> = {}): ReminderSummary => ({
  id: id as UUID,
  label: id,
  mediaId: 'm' as UUID,
  mediaKind: 'image',
  profileId: 'p' as UUID,
  enabledIntent: true,
  effectiveState: 'active',
  nextOccurrence: null,
  repeatSummary: '',
  schedule: {type: 'daily', localTime: '07:00:00' as LocalTime, zonePolicy: 'follow_device'},
  action: null,
  ...overrides,
});

const next = (id: string, at: Date) =>
  base(id, {
    nextOccurrence: {id: `o-${id}` as UUID, reminderId: id as UUID, kind: 'base', scheduledAt: at.toISOString() as Instant, state: 'pending'},
  });

describe('reminderStatus', () => {
  it('distinguishes next, paused, done and unscheduled', () => {
    const at = new Date(2026, 9, 3, 7, 0);
    expect(reminderStatus(next('a', at), NOW)).toEqual({kind: 'next', at});
    expect(reminderStatus(base('b', {enabledIntent: false}), NOW).kind).toBe('paused');
    const pastOnce = base('c', {schedule: {type: 'once', instant: '2026-10-01T09:00:00Z' as Instant, originZone: 'UTC' as never}});
    expect(reminderStatus(pastOnce, NOW).kind).toBe('done');
    expect(reminderStatus(base('d'), NOW).kind).toBe('unscheduled');
  });

  it('reports missing media ahead of the pause it caused', () => {
    // The integrity sweep disables these, so without the earlier check they
    // would read as "Paused" — indistinguishable from a reminder the user
    // paused, next to a thumbnail that still renders from cache.
    const broken = base('broken', {enabledIntent: false, mediaMissing: true});
    expect(reminderStatus(broken, NOW).kind).toBe('mediaMissing');
    // Still reported while enabled, for the window between the file going
    // missing and the next sweep running.
    expect(reminderStatus(base('e', {mediaMissing: true}), NOW).kind).toBe('mediaMissing');
  });

  it('sorts soonest first, then waiting, paused and done', () => {
    const later = next('later', new Date(2026, 9, 5, 7, 0));
    const soon = next('soon', new Date(2026, 9, 2, 18, 0));
    const paused = base('paused', {enabledIntent: false});
    const done = base('done', {schedule: {type: 'once', instant: '2026-09-01T09:00:00Z' as Instant, originZone: 'UTC' as never}});
    const waiting = base('waiting');
    // Broken sorts second: it is the only state needing the user to act, and
    // burying it under every paused reminder is how it stayed invisible.
    const broken = base('broken', {enabledIntent: false, mediaMissing: true});
    expect(sortByStatus([done, paused, later, waiting, soon, broken], NOW).map(r => r.id)).toEqual([
      'soon', 'later', 'broken', 'waiting', 'paused', 'done',
    ]);
  });
});

describe('relativeDayOf', () => {
  it.each([
    [new Date(2026, 9, 2, 23, 59), 'today'],
    [new Date(2026, 9, 3, 0, 1), 'tomorrow'],
    [new Date(2026, 9, 6, 9, 0), 'thisWeek'],
    [new Date(2026, 9, 20, 9, 0), 'later'],
  ])('%p is %p', (at, expected) => {
    expect(relativeDayOf(at, NOW)).toBe(expected);
  });
});
