/**
 * Drains the native "Accept opened an alarm, show me that media" slot and
 * returns the media to play, so `AppShellOverlays` can render the same
 * `MediaPreviewPlayer` every other surface uses.
 *
 * Polled on mount *and* on every foreground transition rather than driven by
 * an event: Accept can be tapped from a locked screen before this JS context
 * exists at all, so an emit would fire into nothing. `PendingMediaOpen.take()`
 * is take-once on the native side, so re-checking on each resume cannot
 * re-open something the user already dismissed.
 */
import {useCallback, useEffect, useState} from 'react';
import {AppState} from 'react-native';

import {useAppContainer} from './di';
import type {MediaDetail, UUID} from '../native-client/types';

export const usePendingMediaOpen = (): {
  readonly item: MediaDetail | null;
  readonly clear: () => void;
} => {
  const {repositories, logger} = useAppContainer();
  const [item, setItem] = useState<MediaDetail | null>(null);

  const check = useCallback(async () => {
    const pending = await repositories.capability.takePendingMediaOpen();
    if (!pending.ok || pending.value === null) {
      return;
    }
    const mediaId: UUID = pending.value;
    const detail = await repositories.media.get(mediaId);
    if (!detail.ok) {
      // The reminder outlived its media (deleted, or the file went missing).
      // Nothing to show and nothing the user can act on from here — the
      // Library's own integrity state already surfaces this properly.
      logger.warn('pendingMediaOpen.mediaMissing', {code: detail.error.code});
      return;
    }
    setItem(detail.value);
  }, [repositories, logger]);

  useEffect(() => {
    // eslint-disable-next-line no-void
    void check();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        // eslint-disable-next-line no-void
        void check();
      }
    });
    return () => subscription.remove();
  }, [check]);

  return {item, clear: useCallback(() => setItem(null), [])};
};
