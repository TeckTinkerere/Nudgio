/**
 * Bottom tab navigation (MR-03 "Navigation model").
 *
 * MR-04 responsive table: wider layouts move to a navigation rail instead of
 * a bottom bar. `useResponsive().navigation` decides that; this component
 * only renders the tab *set*, and `AppTabBar`/`AppNavigationRail` (rendered by
 * the navigator's `tabBar` override) decide the chrome.
 */
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {useMemo} from 'react';
import {SafeAreaInsetsContext, useSafeAreaInsets} from 'react-native-safe-area-context';

import {AppTabBar} from './AppTabBar';
import type {TabParamList} from './types';
import {tabRoutes} from '../../constants/routes';
import {LibraryScreen} from '../../features/library/LibraryScreen';
import {RemindersScreen} from '../../features/reminders/RemindersScreen';
import {SettingsScreen} from '../../features/settings/SettingsScreen';
import {TodayScreen} from '../../features/today/TodayScreen';


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

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{headerShown: false}}
      tabBar={renderTabBar}
      screenLayout={renderScreenLayout}>
      <Tab.Screen name={tabRoutes.today} component={TodayScreen} />
      <Tab.Screen name={tabRoutes.library} component={LibraryScreen} />
      <Tab.Screen name={tabRoutes.reminders} component={RemindersScreen} />
      <Tab.Screen name={tabRoutes.settings} component={SettingsScreen} />
    </Tab.Navigator>
  );
}
