/**
 * Onboarding (MR-03 "Onboarding") — the full 3-page flow: purpose, adaptive
 * presentation, permissions. Previously only page 1 existed; pages
 * 2-3 were left as "UX content work" (see decision log).
 *
 * Page 3 is a real permissions step, not a description of one: it renders the
 * live `CapabilityRow`s for `notifications` and `exact_alarm` (the same rows
 * the Health screen uses), so the user grants them here, in context, having
 * just been told why. This is deliberately the *first* ask —
 * `useRequestNotificationPermissionOnLaunch` now stays silent until
 * onboarding is complete, because Android only ever shows the notification
 * dialog twice and spending one of those on an unexplained cold-launch
 * prompt is not recoverable. Neither row blocks Continue: MR-03's "the user
 * can skip setup" applies to permissions too, and the reminder editor
 * re-checks both before saving anyway.
 *
 * `hasCompletedOnboarding`
 * writes exactly once, from either the final page's primary action or Skip —
 * both land on the same empty Library/Upcoming tabs, since there is no
 * separate "demo" content to show (MR-05's text-card kind has no create path
 * yet, see `AddActionSheet.tsx`'s own note, so a fabricated "demo card" was
 * not built). MR-03 "the user can skip setup" is satisfied by Skip actually
 * skipping, not by a fake shortcut.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useState} from 'react';
import {Linking, StyleSheet, View} from 'react-native';
import Animated, {FadeIn} from 'react-native-reanimated';

import {useToast} from '../../app/toast/ToastProvider';
import type {RootStackParamList} from '../../app/navigation/types';
import {links, testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {Button, EmptyState, Icon, Screen, Stack, Text, useTheme} from '../../design-system';
import type {IconName} from '../../design-system';
import {useCapabilitySnapshot, useHaptics, useUpdatePreferences} from '../../hooks';
import {useTranslation} from '../../localization';
import {CapabilityRow} from '../capability/CapabilityRow';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

const PAGE_COUNT = 3;
type PageIndex = 0 | 1 | 2;

interface PageContent {
  readonly icon: IconName;
  readonly titleKey: 'onboarding.purpose.title' | 'onboarding.adaptive.title' | 'onboarding.permissions.title';
  readonly bodyKey: 'onboarding.purpose.body' | 'onboarding.adaptive.body' | 'onboarding.permissions.body';
}

const PAGES: readonly PageContent[] = [
  {icon: 'library', titleKey: 'onboarding.purpose.title', bodyKey: 'onboarding.purpose.body'},
  {icon: 'notification', titleKey: 'onboarding.adaptive.title', bodyKey: 'onboarding.adaptive.body'},
  {icon: 'lock', titleKey: 'onboarding.permissions.title', bodyKey: 'onboarding.permissions.body'},
];

/** Named function (not an inline object) so `no-inline-styles` sees a value it can't mistake for a screen-code magic literal — the color/width really are dynamic per dot, not a one-off. */
const dotStyleFor = (isActive: boolean, activeColor: string, inactiveColor: string) => ({
  backgroundColor: isActive ? activeColor : inactiveColor,
  width: isActive ? 20 : 8,
});

/** Dot row — decorative; the real page-position announcement is the row's own accessibilityLabel. */
function PageIndicator({page, label}: {readonly page: PageIndex; readonly label: string}) {
  const theme = useTheme();
  return (
    <Stack direction="row" justify="center" gap="xs" groupAccessibility accessibilityLabel={label}>
      {PAGES.map((_, index) => {
        const dotStyle = dotStyleFor(index === page, theme.color.primary, theme.color.outlineVariant);
        return <View key={index} style={[styles.dot, dotStyle]} />;
      })}
    </Stack>
  );
}

/**
 * The permissions step's live content. `notifications` and `exact_alarm` are
 * the only two capabilities a user can meaningfully act on before they have
 * created anything — the rest of the `CapabilitySnapshot` (channels, battery,
 * scheduler) is either derived from these or has no first-run action, so
 * showing it here would be noise on a page whose whole job is "grant these
 * two." Rows are filtered by kind, not sliced by index, so a future snapshot
 * that reorders or adds items cannot silently change what this page asks for.
 */
function PermissionsPage() {
  const t = useTranslation();
  const theme = useTheme();
  const capability = useCapabilitySnapshot();

  const items = capability.data?.items ?? [];
  const notifications = items.find(item => item.kind === 'notifications');
  const exactAlarm = items.find(item => item.kind === 'exact_alarm');

  return (
    <Stack style={styles.flexFill} justify="center" gap="lg" paddingHorizontal="lg">
      <Stack gap="xs" align="center">
        <Icon name="lock" size="xl" color={theme.color.onSurfaceVariant} />
        <Text variant="titleLarge" align="center" isHeading>
          {t('onboarding.permissions.title')}
        </Text>
        <Text variant="bodyLarge" tone="variant" align="center">
          {t('onboarding.permissions.body')}
        </Text>
      </Stack>

      <Stack gap="sm">
        {notifications ? <CapabilityRow item={notifications} /> : null}
        {exactAlarm ? <CapabilityRow item={exactAlarm} /> : null}
      </Stack>
    </Stack>
  );
}

export function OnboardingScreen() {
  const t = useTranslation();
  const navigation = useNavigation<Navigation>();
  const updatePreferences = useUpdatePreferences();
  const theme = useTheme();
  const haptics = useHaptics();
  const {showToast} = useToast();
  const [page, setPage] = useState<PageIndex>(0);

  // Onboarding completion must never be a hard gate a user can get stuck
  // behind: `hasCompletedOnboarding` is a soft "don't show this again" flag,
  // not something worth trapping someone in a 3-page flow over if the write
  // fails (a transient bridge error, a cold-start race, anything). Both
  // outcomes navigate; a failed write only costs re-seeing Onboarding once
  // on the next launch, which is a far smaller problem than "no way out."
  const handleStart = () => {
    updatePreferences.mutate(
      {hasCompletedOnboarding: true},
      {
        onSuccess: () => navigation.replace(rootRoutes.tabs),
        onError: () => {
          showToast({message: t('error.unexpected.effect'), tone: 'error'});
          navigation.replace(rootRoutes.tabs);
        },
      },
    );
  };

  const goNext = () => {
    haptics.trigger('confirm');
    setPage(current => (current + 1) as PageIndex);
  };
  const goBack = () => {
    haptics.trigger('confirm');
    setPage(current => (current - 1) as PageIndex);
  };

  const current = PAGES[page]!;
  const isLastPage = page === PAGE_COUNT - 1;

  const body = isLastPage ? (
    <PermissionsPage />
  ) : (
    <EmptyState
      icon={current.icon}
      title={t(current.titleKey)}
      body={t(current.bodyKey)}
      secondaryAction={
        page === 0
          ? {
              label: t('onboarding.purpose.privacyDetails'),
              onPress: () => {
                // eslint-disable-next-line no-void -- fire-and-forget: the OS browser opens, nothing to await here.
                void Linking.openURL(links.privacyDetails);
              },
            }
          : undefined
      }
    />
  );

  return (
    <Screen testID={testIds.onboarding.screen}>
      <Stack style={styles.flexFill} justify="space-between">
        <Stack direction="row" justify="flex-end" paddingHorizontal="sm" paddingVertical="xs">
          {isLastPage ? null : (
            <Button
              testID={testIds.onboarding.skipButton}
              label={t('onboarding.skip')}
              variant="text"
              onPress={handleStart}
            />
          )}
        </Stack>

        {theme.a11y.reduceMotion ? (
          body
        ) : (
          <Animated.View key={page} entering={FadeIn.duration(200)} style={styles.flexFill}>
            {body}
          </Animated.View>
        )}

        <Stack gap="md" paddingHorizontal="lg" paddingVertical="md">
          <PageIndicator
            page={page}
            label={t('onboarding.pageIndicator', {current: page + 1, total: PAGE_COUNT})}
          />
          <Button
            testID={testIds.onboarding.continueButton}
            label={isLastPage ? t('onboarding.start') : t('onboarding.purpose.continue')}
            onPress={isLastPage ? handleStart : goNext}
            loading={isLastPage && updatePreferences.isPending}
            fullWidth
          />
          {page > 0 ? (
            <Button
              testID={testIds.onboarding.backButton}
              label={t('onboarding.back')}
              variant="text"
              onPress={goBack}
            />
          ) : null}
        </Stack>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
