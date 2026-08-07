/**
 * Ephemeral, process-local UI state that does not belong in React Query.
 *
 * React Query caches *server truth* (bridge responses). This store is for
 * state that is never fetched — it is produced by UI interaction or by a
 * native event and is correct precisely because it is not persisted.
 *
 * MR-07: "React state is disposable; killing the JS process must not lose
 * user intent or active-session truth." That is why this store holds only
 * *presentation hints*, never the active alarm session itself — the session's
 * truth is `activeSession` on the `StartupSnapshot`, refetched from Room on
 * every cold start. Losing this store on process death is by design.
 *
 * Zustand is used rather than Context for this slice specifically because
 * MR-08 events (`reminderDueWhileForeground`, `importProgress`, ...) arrive
 * outside React's render cycle from a native event emitter subscription, and
 * a store update from there must not require a Provider to be mounted above
 * the subscriber.
 */
import {create} from 'zustand';

import type {OccurrenceSummary, UUID} from '../../native-client/types';

export interface InAppDueBanner {
  /** MR-08 alarm action contract: needed to call `playDueSession`/`snoozeDueSession`/`dismissDueSession` — the same session the notification's own buttons resolve against. */
  readonly sessionId: UUID;
  readonly nonce: string;
  readonly occurrence: OccurrenceSummary;
  readonly reminderLabel: string;
  readonly mediaTitle: string;
  /** The reminder's own configured snooze default (native-resolved) — the card has no custom-duration picker, matching the notification's plain Snooze button. */
  readonly defaultSnoozeMinutes: number;
}

interface SessionState {
  /**
   * MR-08 `reminderDueWhileForeground`; MR-03 "In-app strip". Non-null while
   * the compact strip should render over the current screen.
   */
  readonly inAppDueBanner: InAppDueBanner | null;
  /** MR-03: "Swiping upward collapses it to a status chip." */
  readonly inAppDueBannerCollapsed: boolean;

  /**
   * Import/export progress the user has navigated away from. MR-08: "A screen
   * restored after process death calls getOperation(id)... it does not assume
   * it received every event" — this cache is a hint for a badge, not truth.
   */
  readonly activeOperationIds: ReadonlySet<UUID>;

  showDueBanner(banner: InAppDueBanner): void;
  collapseDueBanner(): void;
  dismissDueBanner(): void;

  trackOperation(id: UUID): void;
  untrackOperation(id: UUID): void;
}

export const useSessionStore = create<SessionState>((set) => ({
  inAppDueBanner: null,
  inAppDueBannerCollapsed: false,
  activeOperationIds: new Set(),

  showDueBanner: banner =>
    set({inAppDueBanner: banner, inAppDueBannerCollapsed: false}),

  collapseDueBanner: () => set({inAppDueBannerCollapsed: true}),

  dismissDueBanner: () =>
    set({inAppDueBanner: null, inAppDueBannerCollapsed: false}),

  trackOperation: id =>
    set(state => ({activeOperationIds: new Set(state.activeOperationIds).add(id)})),

  untrackOperation: id =>
    set(state => {
      const next = new Set(state.activeOperationIds);
      next.delete(id);
      return {activeOperationIds: next};
    }),
}));
