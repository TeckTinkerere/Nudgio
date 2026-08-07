/**
 * Onboarding (MR-03 "Onboarding", page 1 of 3).
 *
 * The full flow is three pages ending in "Start with my library" / "Skip
 * setup and explore with a demo text card". This slice implements page 1's
 * content and the completion write (`hasCompletedOnboarding`), which is what
 * `RootNavigator` needs to gate on. Pages 2-3 (adaptive-behavior illustration,
 * permission-by-intent explainer) are UX content work, not architecture, and
 * are left as a follow-up within the same screen shell.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {Button, EmptyState, Screen} from '../../design-system';
import {useUpdatePreferences} from '../../hooks';
import {useTranslation} from '../../localization';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export function OnboardingScreen() {
  const t = useTranslation();
  const navigation = useNavigation<Navigation>();
  const updatePreferences = useUpdatePreferences();

  const handleStart = () => {
    updatePreferences.mutate(
      {hasCompletedOnboarding: true},
      {onSuccess: () => navigation.replace(rootRoutes.tabs)},
    );
  };

  return (
    <Screen testID={testIds.onboarding.screen}>
      <EmptyState
        icon="play"
        title={t('onboarding.purpose.title')}
        body={t('onboarding.purpose.body')}
      />
      <Button
        testID={testIds.onboarding.continueButton}
        label={t('onboarding.start')}
        onPress={handleStart}
        loading={updatePreferences.isPending}
        fullWidth
      />
    </Screen>
  );
}
