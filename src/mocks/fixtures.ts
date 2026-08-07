/**
 * UI-development mock data.
 *
 * MR-18: "Fixtures are synthetic." Every title, note and byte count below is
 * invented for screen development — none of it is real user content, and
 * nothing here is imported by production code paths that ship to a device
 * with the real Kotlin module registered (see `demoNativeModule.ts`'s module
 * doc for exactly where the line is).
 *
 * Shapes are typed against `native-client/types.ts` DTOs so a screen built
 * against this data needs no changes when a real bridge call replaces it —
 * only the data *source* changes, never the shape a component consumes.
 */
import {mockProfiles} from '../native-client/mockNativeModule';
import type {
  BackupInspection,
  ByteCount,
  ExportPreview,
  Instant,
  LocalDate,
  LocalTime,
  MediaDetail,
  MediaKind,
  NamedRef,
  OccurrenceSummary,
  ReminderDetail,
  ScheduleRuleDto,
  UUID,
  ZoneId,
} from '../native-client/types';

const uuid = (value: string): UUID => value as UUID;
const localTime = (value: string): LocalTime => value as LocalTime;
const instant = (isoOffsetMinutes: number): Instant =>
  new Date(Date.now() + isoOffsetMinutes * 60_000).toISOString() as Instant;
const bytes = (value: number): ByteCount => String(value) as ByteCount;

// --- Categories and tags -----------------------------------------------------
// Named constants, not an indexed array: under `noUncheckedIndexedAccess`,
// `array[i]` types as `T | undefined` regardless of literal bounds. Naming
// each value sidesteps that everywhere below and reads better at each seed.

const categoryMornings: NamedRef = {id: uuid('c0000000-0000-4000-8000-000000000001'), name: 'Mornings'};
const categoryReflection: NamedRef = {id: uuid('c0000000-0000-4000-8000-000000000002'), name: 'Reflection'};
const categoryFamily: NamedRef = {id: uuid('c0000000-0000-4000-8000-000000000003'), name: 'Family'};
const categoryWellness: NamedRef = {id: uuid('c0000000-0000-4000-8000-000000000004'), name: 'Wellness'};

export const mockCategories: readonly NamedRef[] = [
  categoryMornings,
  categoryReflection,
  categoryFamily,
  categoryWellness,
];

const tagShort: NamedRef = {id: uuid('7a000000-0000-4000-8000-000000000001'), name: 'short'};
const tagDaily: NamedRef = {id: uuid('7a000000-0000-4000-8000-000000000002'), name: 'daily'};
const tagVoiceNote: NamedRef = {id: uuid('7a000000-0000-4000-8000-000000000003'), name: 'voice-note'};
const tagFavorite: NamedRef = {id: uuid('7a000000-0000-4000-8000-000000000004'), name: 'favorite'};

export const mockTags: readonly NamedRef[] = [tagShort, tagDaily, tagVoiceNote, tagFavorite];

// --- Media --------------------------------------------------------------------

interface MediaSeed {
  readonly id: string;
  readonly kind: MediaKind;
  readonly title: string;
  readonly notes?: string;
  readonly durationMs?: number;
  readonly sizeBytes: number;
  readonly category?: NamedRef;
  readonly tags?: readonly NamedRef[];
  readonly activeReminderCount: number;
  readonly integrity?: MediaDetail['integrity'];
  readonly createdOffsetDays: number;
}

const mediaSeeds: readonly MediaSeed[] = [
  {
    id: 'm0000000-0000-4000-8000-000000000001',
    kind: 'video',
    title: 'Morning remembrance',
    notes: 'A short recitation to start the day gently.',
    durationMs: 93_000,
    sizeBytes: 42 * 1024 * 1024,
    category: categoryMornings,
    tags: [tagDaily, tagFavorite],
    activeReminderCount: 2,
    createdOffsetDays: -30,
  },
  {
    id: 'm0000000-0000-4000-8000-000000000002',
    kind: 'audio',
    title: 'Dad’s voice note — encouragement',
    notes: 'Recorded before the exam season.',
    durationMs: 38_000,
    sizeBytes: 3 * 1024 * 1024,
    category: categoryFamily,
    tags: [tagVoiceNote, tagFavorite],
    activeReminderCount: 1,
    createdOffsetDays: -12,
  },
  {
    id: 'm0000000-0000-4000-8000-000000000003',
    kind: 'image',
    title: 'Gratitude journal prompt',
    notes: 'Three things, every evening.',
    sizeBytes: 1.8 * 1024 * 1024,
    category: categoryReflection,
    tags: [tagDaily],
    activeReminderCount: 1,
    createdOffsetDays: -8,
  },
  {
    id: 'm0000000-0000-4000-8000-000000000004',
    kind: 'text',
    title: 'Stretch break checklist',
    notes: 'Neck, shoulders, wrists, standing hips.',
    sizeBytes: 2 * 1024,
    category: categoryWellness,
    tags: [tagShort, tagDaily],
    activeReminderCount: 1,
    createdOffsetDays: -20,
  },
  {
    id: 'm0000000-0000-4000-8000-000000000005',
    kind: 'video',
    title: 'Kids’ bedtime story — the kind fox',
    durationMs: 246_000,
    sizeBytes: 118 * 1024 * 1024,
    category: categoryFamily,
    tags: [tagFavorite],
    activeReminderCount: 1,
    createdOffsetDays: -5,
  },
  {
    id: 'm0000000-0000-4000-8000-000000000006',
    kind: 'audio',
    title: 'Evening duʿaʾ, short',
    durationMs: 52_000,
    sizeBytes: 4.5 * 1024 * 1024,
    category: categoryReflection,
    tags: [tagShort, tagDaily],
    activeReminderCount: 1,
    createdOffsetDays: -60,
  },
  {
    id: 'm0000000-0000-4000-8000-000000000007',
    kind: 'image',
    title: 'Water bottle reminder card',
    sizeBytes: 900 * 1024,
    category: categoryWellness,
    activeReminderCount: 0,
    integrity: 'missing',
    createdOffsetDays: -45,
  },
  {
    id: 'm0000000-0000-4000-8000-000000000008',
    kind: 'video',
    title: 'Weekly check-in with Mom',
    durationMs: 187_000,
    sizeBytes: 76 * 1024 * 1024,
    category: categoryFamily,
    tags: [tagFavorite],
    activeReminderCount: 1,
    createdOffsetDays: -3,
  },
];

export const mockMedia: readonly MediaDetail[] = mediaSeeds.map(seed => ({
  id: uuid(seed.id),
  kind: seed.kind,
  title: seed.title,
  notes: seed.notes,
  durationMs: seed.durationMs,
  sizeBytes: bytes(seed.sizeBytes),
  mimeType:
    seed.kind === 'video'
      ? 'video/mp4'
      : seed.kind === 'audio'
        ? 'audio/mp4'
        : seed.kind === 'image'
          ? 'image/webp'
          : 'application/json',
  category: seed.category,
  tags: seed.tags ?? [],
  activeReminderCount: seed.activeReminderCount,
  integrity: seed.integrity ?? 'healthy',
  createdAt: instant(seed.createdOffsetDays * 24 * 60),
  updatedAt: instant(seed.createdOffsetDays * 24 * 60),
  entityVersion: 1,
}));

export const findMockMedia = (id: UUID): MediaDetail | undefined =>
  mockMedia.find(item => item.id === id);

// --- Reminders and today's occurrences -----------------------------------------

interface ReminderSeed {
  readonly id: string;
  readonly label: string;
  readonly mediaIndex: number;
  readonly profileIndex: number;
  readonly repeatSummary: string;
  /** Real schedule shape, kept consistent with `repeatSummary`'s text. */
  readonly schedule: ScheduleRuleDto;
  readonly enabledIntent: boolean;
  readonly effectiveState: ReminderDetail['effectiveState'];
  readonly dueInMinutes: number;
  readonly occurrenceState: OccurrenceSummary['state'];
}

const reminderSeeds: readonly ReminderSeed[] = [
  {
    id: 'r0000000-0000-4000-8000-000000000001',
    label: 'Morning remembrance',
    mediaIndex: 0,
    profileIndex: 1,
    repeatSummary: 'Every day at 6:15 AM',
    schedule: {type: 'daily', localTime: localTime('06:15:00'), zonePolicy: 'follow_device'},
    enabledIntent: true,
    effectiveState: 'active',
    dueInMinutes: 42,
    occurrenceState: 'pending',
  },
  {
    id: 'r0000000-0000-4000-8000-000000000002',
    label: 'Stretch break',
    mediaIndex: 3,
    profileIndex: 0,
    repeatSummary: 'Weekdays at 2:30 PM',
    schedule: {
      type: 'weekdays',
      localTime: localTime('14:30:00'),
      isoWeekdays: [1, 2, 3, 4, 5],
      zonePolicy: 'follow_device',
    },
    enabledIntent: true,
    effectiveState: 'active',
    dueInMinutes: 205,
    occurrenceState: 'pending',
  },
  {
    id: 'r0000000-0000-4000-8000-000000000003',
    label: 'Gratitude journal',
    mediaIndex: 2,
    profileIndex: 0,
    repeatSummary: 'Every day at 9:00 PM',
    schedule: {type: 'daily', localTime: localTime('21:00:00'), zonePolicy: 'follow_device'},
    enabledIntent: true,
    effectiveState: 'active',
    dueInMinutes: -95,
    occurrenceState: 'accepted',
  },
  {
    id: 'r0000000-0000-4000-8000-000000000004',
    label: 'Weekly check-in with Mom',
    mediaIndex: 7,
    profileIndex: 2,
    repeatSummary: 'Sundays at 5:00 PM',
    schedule: {
      type: 'weekdays',
      localTime: localTime('17:00:00'),
      isoWeekdays: [7],
      zonePolicy: 'follow_device',
    },
    enabledIntent: true,
    effectiveState: 'active',
    dueInMinutes: -260,
    occurrenceState: 'dismissed',
  },
  {
    id: 'r0000000-0000-4000-8000-000000000005',
    label: 'Evening duʿaʾ',
    mediaIndex: 5,
    profileIndex: 1,
    repeatSummary: 'Every day at 7:45 PM',
    schedule: {type: 'daily', localTime: localTime('19:45:00'), zonePolicy: 'follow_device'},
    enabledIntent: true,
    effectiveState: 'active',
    dueInMinutes: -140,
    occurrenceState: 'missed',
  },
  {
    id: 'r0000000-0000-4000-8000-000000000006',
    label: 'Kids’ bedtime story',
    mediaIndex: 4,
    profileIndex: 0,
    repeatSummary: 'Every day at 8:30 PM',
    schedule: {type: 'daily', localTime: localTime('20:30:00'), zonePolicy: 'follow_device'},
    enabledIntent: false,
    effectiveState: 'disabled',
    dueInMinutes: 375,
    occurrenceState: 'pending',
  },
  {
    id: 'r0000000-0000-4000-8000-000000000007',
    label: 'Water bottle nudge',
    mediaIndex: 6,
    profileIndex: 0,
    repeatSummary: 'Weekdays at 11:00 AM',
    schedule: {
      type: 'weekdays',
      localTime: localTime('11:00:00'),
      isoWeekdays: [1, 2, 3, 4, 5],
      zonePolicy: 'follow_device',
    },
    enabledIntent: true,
    effectiveState: 'needs_setup',
    dueInMinutes: 640,
    occurrenceState: 'pending',
  },
  {
    id: 'r0000000-0000-4000-8000-000000000008',
    label: 'Dad’s voice note',
    mediaIndex: 1,
    profileIndex: 1,
    repeatSummary: 'Once — Thursday at 8:00 AM',
    schedule: {
      type: 'once',
      instant: instant(1500),
      originZone: 'Asia/Singapore' as ZoneId,
    },
    enabledIntent: true,
    effectiveState: 'active',
    dueInMinutes: 1500,
    occurrenceState: 'pending',
  },
  {
    id: 'r0000000-0000-4000-8000-000000000009',
    label: 'Pay rent reminder',
    mediaIndex: 2,
    profileIndex: 0,
    repeatSummary: 'Monthly on day 1 at 9:00 AM',
    schedule: {
      type: 'monthly',
      localTime: localTime('09:00:00'),
      dayOfMonth: 1,
      zonePolicy: 'follow_device',
    },
    enabledIntent: true,
    effectiveState: 'active',
    dueInMinutes: 4200,
    occurrenceState: 'pending',
  },
  {
    id: 'r0000000-0000-4000-8000-000000000010',
    label: 'Anniversary reminder',
    mediaIndex: 5,
    profileIndex: 1,
    repeatSummary: 'Yearly on March 14 at 8:00 AM',
    schedule: {
      type: 'yearly',
      localTime: localTime('08:00:00'),
      month: 3,
      dayOfMonth: 14,
      zonePolicy: 'follow_device',
    },
    enabledIntent: true,
    effectiveState: 'active',
    dueInMinutes: 60_000,
    occurrenceState: 'pending',
  },
  {
    id: 'r0000000-0000-4000-8000-000000000011',
    label: 'Water the plants',
    mediaIndex: 3,
    profileIndex: 0,
    repeatSummary: 'Every 3 days at 10:00 AM',
    schedule: {
      type: 'custom',
      localTime: localTime('10:00:00'),
      intervalDays: 3,
      anchorDate: '2026-08-01' as LocalDate,
      zonePolicy: 'follow_device',
    },
    enabledIntent: true,
    effectiveState: 'active',
    dueInMinutes: 900,
    occurrenceState: 'pending',
  },
];

const occurrenceFor = (seed: ReminderSeed): OccurrenceSummary => ({
  id: uuid(`o0000000-0000-4000-8000-${seed.id.slice(-12)}`),
  reminderId: uuid(seed.id),
  kind: 'base',
  scheduledAt: instant(seed.dueInMinutes),
  state: seed.occurrenceState,
});

export const mockReminders: readonly ReminderDetail[] = reminderSeeds.map(seed => {
  const media = mockMedia[seed.mediaIndex];
  const profile = mockProfiles[seed.profileIndex];
  if (!media || !profile) {
    throw new Error(`Mock reminder seed "${seed.id}" references a missing media/profile index.`);
  }
  return {
    id: uuid(seed.id),
    label: seed.label,
    mediaId: media.id,
    mediaKind: media.kind,
    thumbnailToken: undefined,
    profileId: profile.id,
    enabledIntent: seed.enabledIntent,
    effectiveState: seed.effectiveState,
    nextOccurrence: seed.effectiveState === 'disabled' ? null : occurrenceFor(seed),
    repeatSummary: seed.repeatSummary,
    notes: undefined,
    schedule: seed.schedule,
    snooze: {defaultMinutes: 10, allowCustom: true, minimumMinutes: 1, maximumMinutes: 1440},
    historyEnabled: true,
    createdAt: instant(-60 * 24 * 60),
    updatedAt: instant(-24 * 60),
    entityVersion: 1,
  };
});

export const findMockReminder = (id: UUID): ReminderDetail | undefined =>
  mockReminders.find(item => item.id === id);

export interface TodayEntry {
  readonly occurrence: OccurrenceSummary;
  readonly reminder: ReminderDetail;
}

/** Today's timeline (MR-03 "Today screen"): chronological, mixed states. */
export const mockTodayOccurrences: readonly TodayEntry[] = mockReminders
  .map((reminder): TodayEntry | null =>
    reminder.nextOccurrence === null ? null : {occurrence: reminder.nextOccurrence, reminder},
  )
  .filter((entry): entry is TodayEntry => entry !== null)
  .sort((a, b) => a.occurrence.scheduledAt.localeCompare(b.occurrence.scheduledAt));

export const mockNextReminder = mockTodayOccurrences.find(
  entry => entry.occurrence.state === 'pending',
);

// --- Backup / export / import ---------------------------------------------------

export const mockExportPreview: ExportPreview = {
  mediaCount: mockMedia.length,
  reminderCount: mockReminders.length,
  estimatedBytes: bytes(mockMedia.reduce((sum, item) => sum + Number(item.sizeBytes), 0)),
};

export const mockBackupInspection: BackupInspection = {
  operationId: 'demo-import-operation-0000-000000000001' as UUID,
  archiveVersion: '1.0',
  createdAt: instant(-14 * 24 * 60),
  sourceAppVersion: '0.1.0',
  mediaCount: 6,
  reminderCount: 7,
  compressedBytes: bytes(184 * 1024 * 1024),
  expectedUncompressedBytes: bytes(210 * 1024 * 1024),
  checksumStatus: 'valid',
  compatibility: 'compatible',
  conflicts: [
    {kind: 'reminder', count: 2, resolutionKey: 'backup.conflict.keptNewer'},
    {kind: 'media', count: 1, resolutionKey: 'backup.conflict.keptExisting'},
  ],
  warnings: [],
  importToken: 'demo-import-token',
};

// --- Statistics (no MR-08 DTO; local to the Statistics screen) ------------------

export interface DailyOutcomeCount {
  readonly date: string;
  readonly completed: number;
  readonly dismissed: number;
  readonly missed: number;
}

export interface StatisticsSummary {
  readonly rangeLabel: string;
  readonly totalOccurrences: number;
  readonly completed: number;
  readonly dismissed: number;
  readonly missed: number;
  readonly snoozed: number;
  readonly mostActiveReminderLabel: string;
  readonly dailyBreakdown: readonly DailyOutcomeCount[];
}

export const mockStatistics: StatisticsSummary = {
  rangeLabel: 'Last 7 days',
  totalOccurrences: 34,
  completed: 21,
  dismissed: 9,
  missed: 4,
  snoozed: 6,
  mostActiveReminderLabel: 'Morning remembrance',
  dailyBreakdown: [
    {date: 'Mon', completed: 3, dismissed: 1, missed: 0},
    {date: 'Tue', completed: 4, dismissed: 0, missed: 1},
    {date: 'Wed', completed: 2, dismissed: 2, missed: 0},
    {date: 'Thu', completed: 3, dismissed: 1, missed: 1},
    {date: 'Fri', completed: 4, dismissed: 0, missed: 0},
    {date: 'Sat', completed: 2, dismissed: 3, missed: 1},
    {date: 'Sun', completed: 3, dismissed: 2, missed: 1},
  ],
};
