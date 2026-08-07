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

import {AppTabBar} from './AppTabBar';
import type {TabParamList} from './types';
import {tabRoutes} from '../../constants/routes';
import {LibraryScreen} from '../../features/library';
import {RemindersScreen} from '../../features/reminders';
import {SettingsScreen} from '../../features/settings';
import {TodayScreen} from '../../features/today';


const Tab = createBottomTabNavigator<TabParamList>();

// Module-level, not an inline arrow in JSX: React Navigation calls `tabBar`
// as a render prop every frame, so an inline `props => <AppTabBar {...props}
// />` is a fresh function identity each time — harmless here since AppTabBar
// itself is stable, but it also trips the "component defined during render"
// lint heuristic. Hoisting it removes the false positive and the churn.
const renderTabBar = (props: BottomTabBarProps) => <AppTabBar {...props} />;

export function TabNavigator() {
  return (
    <Tab.Navigator screenOptions={{headerShown: false}} tabBar={renderTabBar}>
      <Tab.Screen name={tabRoutes.today} component={TodayScreen} />
      <Tab.Screen name={tabRoutes.library} component={LibraryScreen} />
      <Tab.Screen name={tabRoutes.reminders} component={RemindersScreen} />
      <Tab.Screen name={tabRoutes.settings} component={SettingsScreen} />
    </Tab.Navigator>
  );
}
