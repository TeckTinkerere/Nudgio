/**
 * Dev-only native module seeded with realistic mock data.
 *
 * Distinct from `mockNativeModule.ts`, which stays deliberately empty
 * (`mediaCount: 0`, `items: []`) because it backs both Jest tests and the
 * MR-08 "declared but unimplemented" contract parity check — changing its
 * defaults would silently invalidate assertions like
 * `MediaReminderClient.test.ts`'s "resolves a startup snapshot... mediaCount
 * is 0".
 *
 * This module exists purely so `npm run android` against Metro with no
 * Kotlin module registered (or before the native build works at all) shows
 * a populated, screen-development-ready UI instead of every screen's empty
 * state. It is installed by `AppContainer` — see that file's module doc —
 * only when `__DEV__` is true AND no real native module answered
 * `TurboModuleRegistry.get()`. On a device with the Kotlin module actually
 * registered, or in any release build, this file is never reached.
 *
 * Reminder mutations (`saveReminder`/`setReminderEnabled`/`deleteReminder`/
 * the due-session actions) are backed by a `Map` seeded from the fixtures and
 * mutated in place for the lifetime of one app process — enough for a
 * screen-dev session to feel real, with none of the DST/timezone/idempotency
 * correctness the actual `OccurrenceCalculator` (Kotlin, JVM-testable)
 * provides. Never mistake this file's estimate for that engine.
 */

import {decodeWire} from './mapping';
import {createMockNativeModule, mockProfiles} from './mockNativeModule';
import {
  __setNativeMediaReminderOverride,
  getNativeMediaReminder,
} from './NativeMediaReminder';
import type {MediaReminderSpec} from './NativeMediaReminder';
import type {
  ByteCount,
  EnableResult,
  ImportRequest,
  Instant,
  MediaDetail,
  MediaKind,
  MediaQuery,
  MediaSummary,
  MutationResult,
  Page,
  PickedDocument,
  ReminderDetail,
  ReminderSummary,
  SaveReminderRequest,
  SaveReminderResult,
  ScheduleRuleDto,
  StartupSnapshot,
  UUID,
} from './types';
import {
  mockBackupInspection,
  mockExportPreview,
  mockMedia,
  mockReminders,
  mockStatistics,
  mockTodayOccurrences,
} from '../mocks/fixtures';

/** Matches the plain-object rejection shape `mockNativeModule.ts` uses. */
const notFound = (correlationId: string) =>
  Promise.reject({
    code: 'MR_VALIDATION_FAILED',
    messageKey: 'error.unexpected',
    category: 'validation',
    retryable: false,
    correlationId,
  });

const paginate = <T>(items: readonly T[], offset: number, limit: number): Page<T> => {
  const slice = items.slice(offset, offset + limit);
  return {
    items: slice,
    total: items.length,
    offset,
    hasMore: offset + slice.length < items.length,
  };
};

const randomId = (): UUID =>
  `demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}` as UUID;

/** Coarse MIME-group classification, matching `MediaKinds.kindOf` on the Kotlin side. */
const kindFromMimeType = (mimeType: string): MediaKind => {
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType.startsWith('image/')) {
    return 'image';
  }
  if (mimeType.startsWith('text/')) {
    return 'text';
  }
  return 'video';
};

/** A plausible extension/canonical MIME type for a fabricated demo-picked file, by kind. */
const DEMO_FILE_BY_KIND: Record<
  MediaKind,
  {readonly extension: string; readonly mimeType: string}
> = {
  video: {extension: 'mp4', mimeType: 'video/mp4'},
  audio: {extension: 'm4a', mimeType: 'audio/mp4'},
  image: {extension: 'jpg', mimeType: 'image/jpeg'},
  text: {extension: 'txt', mimeType: 'text/plain'},
};

/**
 * Rough, non-authoritative "what would this rule fire next" estimate for the
 * demo module's UI only. Does not resolve DST gaps/overlaps, does not follow
 * device-timezone changes after the fact, and treats every month as having
 * the day-of-month requested (clamping only at the JS `Date` rollover level).
 * The real semantics live in Kotlin's `OccurrenceCalculator`.
 */
const estimateNextOccurrence = (
  schedule: ScheduleRuleDto,
  from: Date = new Date(),
): Instant => {
  const next = new Date(from);

  const applyTimeOfDay = (localTime: string) => {
    const [h, m] = localTime.split(':').map(Number);
    next.setHours(h ?? 0, m ?? 0, 0, 0);
  };

  switch (schedule.type) {
    case 'once':
      return schedule.instant;
    case 'daily':
      applyTimeOfDay(schedule.localTime);
      if (next.getTime() <= from.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      return next.toISOString() as Instant;
    case 'weekdays': {
      applyTimeOfDay(schedule.localTime);
      const targets = new Set(schedule.isoWeekdays);
      for (let i = 0; i < 8; i += 1) {
        const isoWeekday = ((next.getDay() + 6) % 7) + 1;
        if (targets.has(isoWeekday) && next.getTime() > from.getTime()) {
          break;
        }
        next.setDate(next.getDate() + 1);
      }
      return next.toISOString() as Instant;
    }
    case 'monthly': {
      applyTimeOfDay(schedule.localTime);
      next.setDate(schedule.dayOfMonth);
      if (next.getTime() <= from.getTime()) {
        next.setMonth(next.getMonth() + 1, schedule.dayOfMonth);
      }
      return next.toISOString() as Instant;
    }
    case 'yearly': {
      applyTimeOfDay(schedule.localTime);
      next.setMonth(schedule.month - 1, schedule.dayOfMonth);
      if (next.getTime() <= from.getTime()) {
        next.setFullYear(next.getFullYear() + 1);
      }
      return next.toISOString() as Instant;
    }
    case 'custom': {
      applyTimeOfDay(schedule.localTime);
      const anchor = new Date(schedule.anchorDate);
      const dayMs = 24 * 60 * 60 * 1000;
      const elapsedDays = Math.floor((next.getTime() - anchor.getTime()) / dayMs);
      const cyclesElapsed = Math.max(0, Math.ceil(elapsedDays / schedule.intervalDays));
      next.setTime(anchor.getTime() + cyclesElapsed * schedule.intervalDays * dayMs);
      applyTimeOfDay(schedule.localTime);
      if (next.getTime() <= from.getTime()) {
        next.setDate(next.getDate() + schedule.intervalDays);
      }
      return next.toISOString() as Instant;
    }
  }
};

const toSummary = (reminder: ReminderDetail): ReminderSummary => ({
  id: reminder.id,
  label: reminder.label,
  mediaId: reminder.mediaId,
  mediaKind: reminder.mediaKind,
  thumbnailToken: reminder.thumbnailToken,
  profileId: reminder.profileId,
  enabledIntent: reminder.enabledIntent,
  effectiveState: reminder.effectiveState,
  nextOccurrence: reminder.nextOccurrence,
  repeatSummary: reminder.repeatSummary,
});

export const createDemoNativeModule = (): MediaReminderSpec => {
  const base = createMockNativeModule();

  // Seeded, mutable — see the module doc for why this is intentionally not
  // the real engine.
  const reminders = new Map<UUID, ReminderDetail>(mockReminders.map(r => [r.id, r]));
  const media = new Map<UUID, MediaDetail>(mockMedia.map(m => [m.id, m]));

  const currentNextOccurrence = () => {
    const pending = mockTodayOccurrences.find(
      entry => entry.occurrence.state === 'pending',
    );
    return pending?.occurrence ?? null;
  };

  return {
    ...base,

    getStartupSnapshot: async (): Promise<StartupSnapshot> => {
      // `base` is Spec-typed (wire) now that MediaReminderSpec is an alias
      // for it (DL-042/DL-045) — decode before spreading so the rest of
      // this module keeps working with the rich domain shape it always has.
      const snapshot = decodeWire<StartupSnapshot>(await base.getStartupSnapshot());
      return {
        ...snapshot,
        mediaCount: media.size,
        activeReminderCount: [...reminders.values()].filter(r => r.enabledIntent)
          .length,
        nextOccurrence: currentNextOccurrence(),
      };
    },

    listMedia: async (query: MediaQuery): Promise<Page<MediaSummary>> => {
      const offset = query.offset ?? 0;
      const limit = query.limit ?? 50;
      let items: readonly MediaSummary[] = [...media.values()];
      if (query.kinds && query.kinds.length > 0) {
        const kinds = query.kinds;
        items = items.filter(item => kinds.includes(item.kind));
      }
      if (query.search) {
        const term = query.search.toLowerCase();
        items = items.filter(item => item.title.toLowerCase().includes(term));
      }
      if (query.onlyMissing) {
        items = items.filter(item => item.integrity === 'missing');
      }
      if (query.categoryId) {
        const categoryId = query.categoryId;
        items = items.filter(item => item.category?.id === categoryId);
      }
      if (query.sort === 'name') {
        items = [...items].sort((a, b) => a.title.localeCompare(b.title));
      } else if (query.sort === 'size') {
        items = [...items].sort((a, b) => Number(b.sizeBytes) - Number(a.sizeBytes));
      } else if (query.sort === 'mostScheduled') {
        items = [...items].sort(
          (a, b) => b.activeReminderCount - a.activeReminderCount,
        );
      } else {
        // 'recent' (the default, matching MediaQuerySql.SORT_RECENT on the
        // real side): newest first. Explicit, not incidental Map insertion
        // order — a demo import appends to `media`, which would otherwise
        // put it last instead of first in the Library's default view.
        items = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
      return paginate(items, offset, limit);
    },

    getMedia: async id => {
      const found = media.get(id as UUID);
      return found ?? (await notFound('demo-getMedia'));
    },

    pickDocument: async (
      mimeTypes: readonly string[],
    ): Promise<PickedDocument | null> => {
      // Always "picks" something rather than resolving null: this module
      // exists so a Metro-only dev session can exercise real screen flows
      // (module doc above), and a picker that always cancels would make the
      // whole import flow untestable without a device.
      const kind = kindFromMimeType(mimeTypes[0] ?? 'video/mp4');
      const {extension, mimeType} = DEMO_FILE_BY_KIND[kind];

      return {
        uriToken: `demo://picked/${randomId()}.${extension}`,
        displayName: `Demo import ${new Date().toLocaleTimeString()}.${extension}`,
        mimeType,
        sizeBytes: String(4_200_000) as ByteCount,
      };
    },

    beginMediaImport: async (request: ImportRequest): Promise<MediaDetail> => {
      const now = new Date().toISOString() as Instant;
      const kind = kindFromMimeType(request.mimeType);

      const asset: MediaDetail = {
        id: randomId(),
        kind,
        title: request.displayName?.replace(/\.[^.]+$/, '') || `Imported ${kind}`,
        notes: undefined,
        durationMs: kind === 'video' || kind === 'audio' ? 90_000 : undefined,
        sizeBytes: request.sizeBytes ?? (String(4_200_000) as ByteCount),
        mimeType: request.mimeType,
        category: undefined,
        tags: [],
        activeReminderCount: 0,
        integrity: 'healthy',
        createdAt: now,
        updatedAt: now,
        entityVersion: 1,
      };

      media.set(asset.id, asset);
      return asset;
    },

    listProfiles: async () => mockProfiles,

    listReminders: async (): Promise<Page<ReminderSummary>> =>
      paginate([...reminders.values()].map(toSummary), 0, 100),

    getReminder: async id => {
      // `id` arrives wire-shaped (plain string); the demo module's own
      // Map is keyed by the branded domain UUID (DL-042/DL-045) — safe to
      // assert, native always sends a real UUID string here.
      const found = reminders.get(id as UUID);
      return found ?? (await notFound('demo-getReminder'));
    },

    saveReminder: async (request: SaveReminderRequest): Promise<SaveReminderResult> => {
      const now = new Date().toISOString() as Instant;
      const existing = request.id ? reminders.get(request.id) : undefined;
      // Reads the live, mutable `media` map (not the static `mockMedia`
      // fixture) so a reminder saved against something imported earlier in
      // this same demo session resolves its real kind, not a 'video' guess.
      const referencedMedia = media.get(request.mediaId);
      const nextOccurrenceInstant = estimateNextOccurrence(request.schedule);

      const reminder: ReminderDetail = {
        id: existing?.id ?? randomId(),
        label: request.label,
        mediaId: request.mediaId,
        mediaKind: referencedMedia?.kind ?? 'video',
        thumbnailToken: undefined,
        profileId: request.profileId,
        enabledIntent: request.enabledIntent,
        effectiveState: request.enabledIntent ? 'active' : 'disabled',
        nextOccurrence: request.enabledIntent
          ? {
              id: randomId(),
              reminderId: existing?.id ?? randomId(),
              kind: 'base',
              scheduledAt: nextOccurrenceInstant,
              state: 'pending',
            }
          : null,
        // Real builds get this from the native plain-language summarizer
        // (MR-13: "Repeat rules are summarized in plain language"); the demo
        // module just names the type since it has no localization access.
        repeatSummary: request.schedule.type,
        notes: request.notes,
        schedule: request.schedule,
        snooze: request.snooze,
        historyEnabled: existing?.historyEnabled ?? true,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        entityVersion: (existing?.entityVersion ?? 0) + 1,
      };

      reminders.set(reminder.id, reminder);

      return {
        reminder,
        nextOccurrence: reminder.nextOccurrence,
        capabilityResult: {status: 'ok'},
        schedulerGeneration: reminder.updatedAt,
      };
    },

    setReminderEnabled: async (id, enabled): Promise<EnableResult> => {
      // See `getReminder` above: `id` is wire-shaped, cast once and reuse.
      const reminderId = id as UUID;
      const existing = reminders.get(reminderId);
      if (!existing) {
        return notFound('demo-setReminderEnabled');
      }
      const updated: ReminderDetail = {
        ...existing,
        enabledIntent: enabled,
        effectiveState: enabled ? 'active' : 'disabled',
        nextOccurrence: enabled
          ? {
              id: randomId(),
              reminderId,
              kind: 'base',
              scheduledAt: estimateNextOccurrence(existing.schedule),
              state: 'pending',
            }
          : null,
        updatedAt: new Date().toISOString() as Instant,
        entityVersion: existing.entityVersion + 1,
      };
      reminders.set(reminderId, updated);
      return {reminder: toSummary(updated), nextOccurrence: updated.nextOccurrence};
    },

    deleteReminder: async (id): Promise<MutationResult> => {
      const existed = reminders.delete(id as UUID);
      return {status: 'ok', affectedCount: existed ? 1 : 0};
    },

    scheduleTestReminder: async () => ({
      sessionId: randomId(),
      scheduledAt: new Date(Date.now() + 15_000).toISOString() as Instant,
    }),

    playDueSession: async sessionId => ({
      sessionId,
      outcome: 'playing',
      effectiveAt: new Date().toISOString() as Instant,
    }),

    snoozeDueSession: async (sessionId, minutes) => ({
      sessionId,
      outcome: 'snoozed',
      effectiveAt: new Date().toISOString() as Instant,
      snoozedUntil: new Date(Date.now() + minutes * 60_000).toISOString() as Instant,
    }),

    dismissDueSession: async sessionId => ({
      sessionId,
      outcome: 'dismissed',
      effectiveAt: new Date().toISOString() as Instant,
    }),

    beginExport: async () => ({
      fileName: `Nudgio_Backup_${new Date().toISOString().slice(0, 10)}_v1.0.mrbackup.zip`,
      sizeBytes: String(186_624_000) as ByteCount,
      sha256: '9f2c7a41b8e0d3f5a6c1b2e4d7f809152a3c6e8b0d4f7a1c3e5b8d0f2a4c6e81',
    }),

    inspectBackup: async () => mockBackupInspection,

    commitImport: async request => ({
      status: 'ok',
      affectedCount:
        request.mode === 'inspect' ? 0 : mockBackupInspection.reminderCount,
    }),

    cancelOperation: async () => ({status: 'ok', affectedCount: 0}),
  } satisfies MediaReminderSpec;
};

/** Exposed for screens that show export/statistics previews with no bridge call yet. */
export const demoExportPreview = mockExportPreview;
export const demoStatistics = mockStatistics;

/**
 * Installs the demo module as the bridge's answer, but only when nothing
 * real is already registered. Called once from `AppContainer` at startup —
 * see that file for the `__DEV__` gate. Safe to call unconditionally: a real
 * Kotlin module, once registered, is never displaced by this check.
 */
export const installDemoNativeModuleIfUnavailable = (): void => {
  if (getNativeMediaReminder() === null) {
    __setNativeMediaReminderOverride(createDemoNativeModule());
  }
};
