/**
 * Launches a reminder's "what next" action (DL-080) — from the moment
 * screen, and from the editor's "Try it" so a link can be checked while it
 * is being set up rather than discovered broken at 8 PM.
 *
 * `Linking.openURL` is an `ACTION_VIEW` of the URI: Android routes it to
 * whichever installed app claims the link (YouTube, Spotify, Maps, the
 * dialer, the browser), so this app needs no network permission of its own.
 * A link nothing can open rejects, and that becomes a clear toast rather
 * than a silent no-op.
 */
import {useCallback} from 'react';
import {Linking} from 'react-native';

import {actionTargetOf, isAllowedActionUri} from './reminderActions';
import {useAppContainer} from '../../app/di';
import {useToast} from '../../app/toast/ToastProvider';
import {useTranslation} from '../../localization';
import type {ReminderActionDto} from '../../native-client/types';

export const useOpenReminderAction = (): ((action: ReminderActionDto) => Promise<boolean>) => {
  const {logger} = useAppContainer();
  const {showToast} = useToast();
  const t = useTranslation();

  return useCallback(
    async (action: ReminderActionDto) => {
      if (!isAllowedActionUri(action.uri)) {
        showToast({message: t('reminders.action.invalid'), tone: 'error'});
        return false;
      }
      try {
        await Linking.openURL(action.uri);
        return true;
      } catch {
        // The target kind only — never the URI, which can carry personal data.
        logger.warn('reminderAction.openFailed', {target: actionTargetOf(action.uri)});
        showToast({message: t('reminders.action.cannotOpen'), tone: 'error'});
        return false;
      }
    },
    [logger, showToast, t],
  );
};
