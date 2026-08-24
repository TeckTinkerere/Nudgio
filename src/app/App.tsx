/**
 * Application root.
 *
 * `app-shell` per MR-07's component map: "startup routing, theme, capability
 * banner and global error boundary." The container is created once per process
 * — `useMemo` with an empty dependency array intentionally, since recreating
 * it would tear down every repository and the query cache mid-session.
 */
import {NavigationContainer} from '@react-navigation/native';
import {useMemo} from 'react';

import {AppProviders} from './AppProviders';
import {StartupGate} from './bootstrap';
import {createAppContainer} from './di';
import {ErrorBoundaryText} from './ErrorBoundaryText';
import {InAppDueCard} from './InAppDueCard';
import {RootNavigator} from './navigation';
import {usePendingMediaOpen} from './usePendingMediaOpen';
import {useReminderDueEvents} from './useReminderDueEvents';
import {MediaSelectionPreviewModal} from '../features/reminders/MediaSelectionPreviewModal';
import {useTranslation} from '../localization';

function AppShellOverlays() {
  // MR-06 rule 4 / MR-08 `reminderDueWhileForeground`: one subscription for
  // the app's lifetime, independent of which screen is mounted underneath.
  useReminderDueEvents();
  const t = useTranslation();
  const pendingMedia = usePendingMediaOpen();

  return (
    <>
      <InAppDueCard />
      {/*
        Accept on a full-screen alarm lands here. Rendered at the shell, not
        inside a screen, because the app may have cold-started straight from
        the lock screen with no particular screen mounted yet. Passing no
        `onSelect`/`selectLabel` gives the plain viewer (no confirm footer),
        and covers all four media kinds rather than only the two
        `MediaPreviewPlayer` can play on its own.
      */}
      <MediaSelectionPreviewModal
        item={pendingMedia.item}
        onDismiss={pendingMedia.clear}
        closeLabel={t('library.player.close')}
        loadErrorLabel={t('library.player.loadError')}
      />
    </>
  );
}

export function App() {

  // container for the app's lifetime, not per render or per prop change.
  const container = useMemo(() => createAppContainer(), []);

  return (
    <AppProviders container={container}>
      <ErrorBoundaryText logger={container.logger}>
        <NavigationContainer>
          <StartupGate>
            <RootNavigator />
          </StartupGate>
          <AppShellOverlays />
        </NavigationContainer>
      </ErrorBoundaryText>
    </AppProviders>
  );
}
