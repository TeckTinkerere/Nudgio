/**
 * Bottom tab navigation (MR-03 "Navigation model").
 *
 * MR-04 responsive table: wider layouts move to a navigation rail instead of
 * a bottom bar. `useResponsive().navigation` decides that; this component
 * only renders the tab *set*, and `AppTabBar`/`AppNavigationRail` (rendered by
 * the navigator's `tabBar` override) decide the chrome.
 *
 * Owns a contextual FAB: create reminder on Upcoming/Reminders, import on
 * Library, hidden on Settings. A single `useImportMedia()` instance keeps
 * import progress/error in one place.
 */
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {SafeAreaInsetsContext, useSafeAreaInsets} from 'react-native-safe-area-context';

import {AppTabBar} from './AppTabBar';
import type {RootStackParamList, TabParamList} from './types';
import {rootRoutes, tabRoutes} from '../../constants/routes';
import {Dialog, FAB, ProgressBar, useTheme} from '../../design-system';
import {LibraryScreen} from '../../features/library/LibraryScreen';
import {RemindersScreen} from '../../features/reminders/RemindersScreen';
import {SettingsScreen} from '../../features/settings/SettingsScreen';
import {UpcomingScreen} from '../../features/today/UpcomingScreen';
import {
  importErrorCopy,
  importPhaseLabelKey,
  importProgressFraction,
  STORAGE_INSUFFICIENT_MIN_MB,
  useImportMedia,
} from '../../hooks';
import {useTranslation} from '../../localization';


const Tab = createBottomTabNavigator<TabParamList>();

// Module-level, not an inline arrow in JSX: React Navigation calls `tabBar`
// as a render prop every frame, so an inline `props => <AppTabBar {...props}
// />` is a fresh function identity each time — harmless here since AppTabBar
// itself is stable, but it also trips the "component defined during render"
// lint heuristic. Hoisting it removes the false positive and the churn.
const renderTabBar = (props: BottomTabBarProps) => <AppTabBar {...props} />;

/**
 * Hands tab screens a bottom inset of zero.
 *
 * `AppTabBar` already pads itself by `insets.bottom` so its touch targets clear
 * the gesture/navigation bar. The tab bar and the screen are siblings, so if
 * the screen also applied the real bottom inset the space would be reserved
 * twice — a dead gap above the tab bar the height of the gesture bar. That is
 * exactly what `SettingsScreen` (the one scrollable tab screen) was doing.
 *
 * Zeroing it here instead of adding a "am I in a tab?" flag to every screen
 * keeps `Screen` unconditional: the inset it reads is simply already correct
 * for wherever it is mounted. `tabBar` is rendered by the navigator outside
 * `screenLayout`, so `AppTabBar` still sees the real, unmodified insets.
 */
function TabScreenInsets({children}: {readonly children: React.ReactElement}) {
  const insets = useSafeAreaInsets();
  // Memoized because this is a context value: a fresh object every render
  // would re-render every inset consumer in the whole tab subtree.
  const withoutBottom = useMemo(() => ({...insets, bottom: 0}), [insets]);

  return (
    <SafeAreaInsetsContext.Provider value={withoutBottom}>
      {children}
    </SafeAreaInsetsContext.Provider>
  );
}

const renderScreenLayout = ({children}: {readonly children: React.ReactElement}) => (
  <TabScreenInsets>{children}</TabScreenInsets>
);

type Props = NativeStackScreenProps<RootStackParamList, 'Tabs'>;

/**
 * Fixed offset above the tab bar's bottom edge, not a measured one:
 * `AppTabBar`'s real height depends on font scale and bar-vs-rail treatment,
 * and measuring it would mean threading an `onLayout` callback through a
 * render-prop the navigator itself owns. 88 dp is Material 3's standard
 * bottom-nav height (`64` content + `24` for label/padding headroom) plus a
 * small margin — verified against the rendered bar on a physical device
 * (2026-08-08); revisit if `AppTabBar`'s own height token changes.
 */
const FAB_BOTTOM_OFFSET = 88;

export function TabNavigator({navigation}: Props) {
  const t = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const importMedia = useImportMedia();
  const [focusedTab, setFocusedTab] = useState<string>(tabRoutes.today);

  const showFab = focusedTab !== tabRoutes.settings;
  const libraryFocused = focusedTab === tabRoutes.library;

  return (
    <View style={styles.fill}>
      <Tab.Navigator
        screenOptions={{headerShown: false}}
        tabBar={renderTabBar}
        screenLayout={renderScreenLayout}
        screenListeners={{
          state: event => {
            const state = event.data.state;
            if (!state) {
              return;
            }
            const route = state.routes[state.index];
            if (route) {
              setFocusedTab(route.name);
            }
          },
        }}>
        <Tab.Screen name={tabRoutes.today} component={UpcomingScreen} />
        <Tab.Screen name={tabRoutes.library} component={LibraryScreen} />
        <Tab.Screen name={tabRoutes.reminders} component={RemindersScreen} />
        <Tab.Screen name={tabRoutes.settings} component={SettingsScreen} />
      </Tab.Navigator>

      {importMedia.isImporting ? (
        <View
          style={[
            styles.progressOverlay,
            {
              right: 0,
              left: 0,
              bottom: FAB_BOTTOM_OFFSET + insets.bottom,
              paddingHorizontal: theme.spacing.md,
            },
          ]}
          pointerEvents="none">
          <ProgressBar
            progress={importProgressFraction(importMedia.progress)}
            label={t(importPhaseLabelKey(importMedia.progress?.phase) ?? 'library.import.copying')}
          />
        </View>
      ) : showFab ? (
        <FAB
          testID="add-fab"
          icon={libraryFocused ? 'library' : 'add'}
          label={libraryFocused ? t('today.empty.importMedia') : t('add.createReminder')}
          onPress={() => {
            if (libraryFocused) {
              importMedia.importMedia();
              return;
            }
            navigation.navigate(rootRoutes.reminderEditor, {reminderId: undefined});
          }}
          bottomOffset={FAB_BOTTOM_OFFSET + insets.bottom}
        />
      ) : null}

      {importMedia.error ? (
        <Dialog
          visible
          title={t(importErrorCopy(importMedia.error).titleKey)}
          body={t(
            importErrorCopy(importMedia.error).bodyKey,
            importErrorCopy(importMedia.error).bodyKey === 'library.import.errorInsufficientSpace'
              ? {megabytes: STORAGE_INSUFFICIENT_MIN_MB}
              : undefined,
          )}
          cancel={{label: t('action.close'), onPress: () => importMedia.reset()}}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
  progressOverlay: {position: 'absolute'},
});
