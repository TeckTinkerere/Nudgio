/**
 * Bottom tab navigation (MR-03 "Navigation model").
 *
 * MR-04 responsive table: wider layouts move to a navigation rail instead of
 * a bottom bar. `useResponsive().navigation` decides that; this component
 * only renders the tab *set*, and `AppTabBar`/`AppNavigationRail` (rendered by
 * the navigator's `tabBar` override) decide the chrome.
 *
 * Also owns the global "Add" FAB (MR-03: "A floating action button labeled
 * Add opens a modal action sheet with Import media, Create reminder...").
 * Mounted once here rather than duplicated on Today/Library/Reminders: it is
 * chrome, visible across every tab, not a per-screen affordance, and a single
 * `useImportMedia()` instance means its progress/error state has exactly one
 * source of truth regardless of which tab is focused when an import
 * finishes. `TabNavigator` is registered as a plain `Stack.Screen` in
 * `RootNavigator`, so it already receives root-stack `navigation` as a prop —
 * used for "Create reminder" — without needing `useNavigation()` to resolve
 * through the nested `Tab.Navigator`'s own context.
 */
import type {BottomTabBarProps} from '@react-navigation/bottom-tabs';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {SafeAreaInsetsContext, useSafeAreaInsets} from 'react-native-safe-area-context';

import {AppTabBar} from './AppTabBar';
import type {RootStackParamList, TabParamList} from './types';
import {rootRoutes, tabRoutes, type TabRouteName} from '../../constants/routes';
import {FAB, useResponsive} from '../../design-system';
import {HomeScreen} from '../../features/home/HomeScreen';
import {LibraryScreen} from '../../features/library/LibraryScreen';
import {SettingsScreen} from '../../features/settings/SettingsScreen';
import {useReminderList} from '../../hooks';
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
  const {navigation: navTreatment} = useResponsive();
  // Only a *bottom* bar sits between the screen and the gesture bar. A rail
  // runs down the side, so there the screen keeps its real bottom inset —
  // zeroing it would run content under the gesture bar on a tablet.
  // Memoized because this is a context value: a fresh object every render
  // would re-render every inset consumer in the whole tab subtree.
  const adjusted = useMemo(
    () => (navTreatment === 'rail' ? insets : {...insets, bottom: 0}),
    [insets, navTreatment],
  );

  return (
    <SafeAreaInsetsContext.Provider value={adjusted}>
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

/** Below this usable height the FAB drops its label (see `roomForExtendedFab`). */
const EXTENDED_FAB_MIN_HEIGHT = 640;

export function TabNavigator({navigation}: Props) {
  const t = useTranslation();
  const insets = useSafeAreaInsets();
  // The FAB is the tab's primary action, not one generic "Add": on Home
  // that is a new reminder, straight into the editor. The Library has its
  // own Add in its app bar (import, new album), and Settings has nothing to
  // add — a FAB there only covered controls.
  const [activeTab, setActiveTab] = useState<TabRouteName>(tabRoutes.home);
  // Home's own first-run empty state already offers "Create a reminder" as
  // its one obvious next step. Showing the FAB on top of it put two filled
  // primary buttons on the same screen saying the same thing, so the FAB
  // waits until there is actually a list for it to float over.
  const reminders = useReminderList();
  const hasReminders = (reminders.data?.items.length ?? 0) > 0;
  // An *extended* FAB is wide enough to cover a whole row's title. There is
  // room for that on a tall phone, where it floats over the end of a long
  // list; there is not on a 320x568 one, where it landed squarely on the
  // next moment's name. Short windows (and landscape, which is always short)
  // get the plain 56 dp circle instead — same action, a third of the
  // footprint. `nav.newReminder` stays its accessible name either way.
  const {usableHeight, navigation: navTreatment, isLargeFontScale} = useResponsive();
  // Height alone is not enough: at 1.5x font the extended FAB is far wider
  // and the rows under it far taller, so on an 800 dp screen it still landed
  // on a reminder's title. `isLargeFontScale` is the same signal `AppTabBar`
  // already uses to drop its own labels, for the same reason.
  const roomForExtendedFab = usableHeight >= EXTENDED_FAB_MIN_HEIGHT && !isLargeFontScale;
  // MR-04's responsive table calls for a navigation rail on medium/expanded
  // widths, and `AppTabBar` has always *drawn* one — a vertical column, 96 dp
  // wide. It was never positioned as one: `tabBar` is the bottom-tab
  // navigator's bottom slot, so on a tablet the rail rendered as a small
  // box wedged into the bottom-left corner with a grey band beside it.
  // `tabBarPosition` is what actually moves the bar to the edge.
  const isRail = navTreatment === 'rail';
  const createReminder = () => navigation.navigate(rootRoutes.reminderEditor, {reminderId: undefined});

  return (
    <View style={styles.fill}>
      <Tab.Navigator
        screenOptions={{headerShown: false, tabBarPosition: isRail ? 'left' : 'bottom'}}
        screenListeners={({route}) => ({focus: () => setActiveTab(route.name)})}
        tabBar={renderTabBar}
        screenLayout={renderScreenLayout}>
        <Tab.Screen name={tabRoutes.home} component={HomeScreen} />
        <Tab.Screen name={tabRoutes.library} component={LibraryScreen} />
        <Tab.Screen name={tabRoutes.settings} component={SettingsScreen} />
      </Tab.Navigator>

      {activeTab === tabRoutes.home && hasReminders ? (
        <FAB
          testID="new-reminder-fab"
          icon="add"
          label={t('nav.newReminder')}
          onPress={createReminder}
          bottomOffset={(isRail ? 0 : FAB_BOTTOM_OFFSET) + insets.bottom}
          extended={roomForExtendedFab}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
