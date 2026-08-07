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
import {useReminderDueEvents} from './useReminderDueEvents';

function AppShellOverlays() {
  // MR-06 rule 4 / MR-08 `reminderDueWhileForeground`: one subscription for
  // the app's lifetime, independent of which screen is mounted underneath.
  useReminderDueEvents();
  return <InAppDueCard />;
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
