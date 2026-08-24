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
import {MediaPreviewPlayer} from '../features/library/MediaPreviewPlayer';
import {useTranslation} from '../localization';

/** Only these two kinds have anything `MediaPreviewPlayer` can play — same gate every other caller uses. */
const isPlayableKind = (kind: string): kind is 'video' | 'audio' =>
  kind === 'video' || kind === 'audio';

function AppShellOverlays() {
  // MR-06 rule 4 / MR-08 `reminderDueWhileForeground`: one subscription for
  // the app's lifetime, independent of which screen is mounted underneath.
  useReminderDueEvents();
  const t = useTranslation();
  const pendingMedia = usePendingMediaOpen();

  return (
    <>
      <InAppDueCard />
      {pendingMedia.item && isPlayableKind(pendingMedia.item.kind) && pendingMedia.item.sourceToken ? (
        <MediaPreviewPlayer
          visible
          onDismiss={pendingMedia.clear}
          title={pendingMedia.item.title}
          sourceToken={pendingMedia.item.sourceToken}
          kind={pendingMedia.item.kind}
          closeLabel={t('library.player.close')}
          loadErrorLabel={t('library.player.loadError')}
        />
      ) : null}
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
