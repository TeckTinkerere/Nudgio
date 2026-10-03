/**
 * Drains the native "Play opened an alarm — show me that reminder" slot and
 * opens the reminder's moment (`ReminderMoment`, DL-080).
 *
 * Polled on mount *and* on every foreground transition rather than driven by
 * an event: Play can be tapped from a locked screen before this JS context
 * exists at all, so an emit would fire into nothing. `PendingMediaOpen.take()`
 * is take-once on the native side, so re-checking on each resume cannot
 * re-open something the user already closed.
 */
import {useCallback, useEffect} from 'react';
import {AppState} from 'react-native';

import {useAppContainer} from './di';
import {useSessionStore} from '../core/state/sessionStore';

export const usePendingMediaOpen = (): void => {
  const {repositories} = useAppContainer();
  const openMoment = useSessionStore(state => state.openMoment);

  const check = useCallback(async () => {
    const pending = await repositories.capability.takePendingMediaOpen();
    if (!pending.ok || pending.value === null) {
      return;
    }
    openMoment(pending.value);
  }, [repositories, openMoment]);

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
};
