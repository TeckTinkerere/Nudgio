/**
 * Root stack: onboarding gate, tabs, and screens that sit above the tab bar.
 *
 * MR-03: onboarding is skippable ("The user can skip setup") and is shown
 * once; `hasCompletedOnboarding` (from preferences) decides the initial
 * route.
 *
 * `headerShown: false` on every screen, including this navigator's own
 * `screenOptions`: every screen in this app renders its own `AppBar` inside
 * `Screen` (MR-04's consistent top-bar pattern), so a native stack header on
 * top of that would double up the title and the back button. The previous
 * placeholder screens had `headerShown: true` set here while also rendering
 * their own `AppBar` — a real double-header bug, fixed as part of wiring the
 * rest of the routes below.
 */
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import {rootRoutes} from '../../constants/routes';
import {LoadingState, useTheme} from '../../design-system';
import {AboutScreen} from '../../features/about/AboutScreen';
import {BackupScreen} from '../../features/backup/BackupScreen';
import {ImportScreen} from '../../features/backup/ImportScreen';
import {EditMediaAssetScreen} from '../../features/library/EditMediaAssetScreen';
import {MediaDetailScreen} from '../../features/library/MediaDetailScreen';
import {OnboardingScreen} from '../../features/onboarding/OnboardingScreen';
import {ReminderDetailScreen} from '../../features/reminders/ReminderDetailScreen';
import {ReminderEditorScreen} from '../../features/reminders/ReminderEditorScreen';
import {SelectMediaScreen} from '../../features/reminders/SelectMediaScreen';
import {StatisticsScreen} from '../../features/statistics/StatisticsScreen';
import {usePreferences} from '../../hooks';
import {useTranslation} from '../../localization';
import {HealthScreen} from './placeholders/HealthScreen';
import {TabNavigator} from './TabNavigator';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const t = useTranslation();
  const theme = useTheme();
  const preferences = usePreferences();

  // `isPending`, not `isLoading` — see useAppBootstrap for why.
  if (preferences.isPending) {
    return <LoadingState label={t('loading.startingUp')} />;
  }

  const initialRoute = preferences.data?.hasCompletedOnboarding
    ? rootRoutes.tabs
    : rootRoutes.onboarding;

  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{
        headerShown: false,
        // MR-04's `navigation` motion token declares `reduced: 'fade'`
        // (not "no animation") — reduced motion still confirms the
        // navigation happened, just without the directional slide
        // (MR-13 ACC-006). `'default'` is Android's own Material stack
        // transition; there is no separate token for it to override.
        animation: theme.a11y.reduceMotion ? 'fade' : 'default',
      }}>
      <Stack.Screen name={rootRoutes.onboarding} component={OnboardingScreen} />
      <Stack.Screen name={rootRoutes.tabs} component={TabNavigator} />
      <Stack.Screen name={rootRoutes.mediaDetail} component={MediaDetailScreen} />
      <Stack.Screen name={rootRoutes.editMediaAsset} component={EditMediaAssetScreen} />
      <Stack.Screen name={rootRoutes.reminderDetail} component={ReminderDetailScreen} />
      <Stack.Screen name={rootRoutes.reminderEditor} component={ReminderEditorScreen} />
      <Stack.Screen name={rootRoutes.selectMedia} component={SelectMediaScreen} />
      <Stack.Screen name={rootRoutes.health} component={HealthScreen} />
      <Stack.Screen name={rootRoutes.backup} component={BackupScreen} />
      <Stack.Screen name={rootRoutes.import} component={ImportScreen} />
      <Stack.Screen name={rootRoutes.statistics} component={StatisticsScreen} />
      <Stack.Screen name={rootRoutes.about} component={AboutScreen} />
    </Stack.Navigator>
  );
}
