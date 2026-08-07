/**
 * MR-06 "Adaptive presentation decision" rule 4 / MR-08
 * `reminderDueWhileForeground`: subscribes once, at the app shell, to the
 * native event `ReminderEventEmitter.kt` fires when a reminder becomes due
 * while the device is unlocked. Native remains the fallback either way — the
 * notification is always posted first — this only decides whether the
 * compact in-app card also appears.
 *
 * MR-18 "Runtime-decode native/external payloads": the event crosses the
 * bridge as an untyped object: fields are checked before being trusted as
 * the branded `InAppDueBanner` shape, and a malformed payload is dropped
 * rather than crashing the app-shell listener.
 */
import {useEffect} from 'react';
import {DeviceEventEmitter} from 'react-native';

import {useSessionStore, type InAppDueBanner} from '../core/state/sessionStore';
import type {Instant, OccurrenceKind, OccurrenceState, UUID} from '../native-client/types';

const REMINDER_DUE_WHILE_FOREGROUND = 'reminderDueWhileForeground';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const decodeBanner = (payload: unknown): InAppDueBanner | null => {
  if (!isRecord(payload) || !isRecord(payload.occurrence)) {
    return null;
  }
  const occurrence = payload.occurrence;

  const hasRequiredStrings =
    typeof payload.sessionId === 'string' &&
    typeof payload.nonce === 'string' &&
    typeof payload.reminderLabel === 'string' &&
    typeof payload.mediaTitle === 'string' &&
    typeof payload.defaultSnoozeMinutes === 'number' &&
    typeof occurrence.id === 'string' &&
    typeof occurrence.reminderId === 'string' &&
    typeof occurrence.kind === 'string' &&
    typeof occurrence.scheduledAt === 'string' &&
    typeof occurrence.state === 'string';

  if (!hasRequiredStrings) {
    return null;
  }

  return {
    sessionId: payload.sessionId as UUID,
    nonce: payload.nonce as string,
    reminderLabel: payload.reminderLabel as string,
    mediaTitle: payload.mediaTitle as string,
    defaultSnoozeMinutes: payload.defaultSnoozeMinutes as number,
    occurrence: {
      id: occurrence.id as UUID,
      reminderId: occurrence.reminderId as UUID,
      kind: occurrence.kind as OccurrenceKind,
      scheduledAt: occurrence.scheduledAt as Instant,
      state: occurrence.state as OccurrenceState,
    },
  };
};

/** Side-effect-only — mounted once at the app root (`App.tsx`), renders nothing. */
export const useReminderDueEvents = (): void => {
  const showDueBanner = useSessionStore(state => state.showDueBanner);

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(REMINDER_DUE_WHILE_FOREGROUND, payload => {
      const banner = decodeBanner(payload);
      if (banner !== null) {
        showDueBanner(banner);
      }
    });
    return () => subscription.remove();
  }, [showDueBanner]);
};
