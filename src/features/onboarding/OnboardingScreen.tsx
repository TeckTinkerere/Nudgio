/**
 * Onboarding (MR-03 "Onboarding") — the full 3-page flow: purpose, adaptive
 * presentation, permissions. Previously only page 1 existed; pages
 * 2-3 were left as "UX content work" (see decision log).
 *
 * Page 3 is a real permissions step in two stages: a **primer** that explains
 * the ask and fires the OS notification dialog from its own button, then a
 * **review** showing the live `CapabilityRow`s (the same rows the Health
 * screen uses). The user is told why, then asked, then shown what happened.
 *
 * This is the *only* automatic notification ask in the app. A cold-launch
 * catch-up prompt used to exist alongside it and was deleted: on a device it
 * fired seconds after onboarding finished, so a user who declined the primer
 * was asked again immediately and unexplained — which consumed both of the
 * two dialogs Android ever shows and left the permission permanently denied.
 * Every other route to it is now user-initiated and explained: the Home
 * banner, the Health screen, and the `Allow` action on the row below.
 *
 * Nothing here blocks Continue: MR-03's "the user can skip setup" applies to
 * permissions too, and the reminder editor re-checks before saving anyway.
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
import {Linking, ScrollView, StyleSheet, View} from 'react-native';
import Animated, {FadeIn} from 'react-native-reanimated';

import type {RootStackParamList} from '../../app/navigation/types';
import {useToast} from '../../app/toast/ToastProvider';
import {links, testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {
  Button,
  EmptyState,
  Icon,
  Screen,
  Stack,
  Text,
  useTheme,
} from '../../design-system';
import type {IconName} from '../../design-system';
import {BrandLogo} from '../../design-system/components/BrandLogo';
import {
  useCapabilitySnapshot,
  useHaptics,
  useRequestNotificationPermission,
  useUpdatePreferences,
} from '../../hooks';
import {useTranslation} from '../../localization';
import {CapabilityRow} from '../capability/CapabilityRow';

type Navigation = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

const PAGE_COUNT = 3;
type PageIndex = 0 | 1 | 2;

/**
 * The permissions page is two steps behind one dot: a primer that explains
 * the ask, then the resulting state. They are not separate pages because the
 * second is the answer to the first — splitting them would add a dot the
 * user cannot navigate back across (the OS dialog is not re-showable at
 * will), and would make a denial look like a page they had failed to
 * complete.
 */
type PermissionStage = 'primer' | 'review';

interface PageContent {
  readonly icon: IconName;
  readonly titleKey:
    | 'onboarding.purpose.title'
    | 'onboarding.adaptive.title'
    | 'onboarding.permissions.title';
  readonly bodyKey:
    | 'onboarding.purpose.body'
    | 'onboarding.adaptive.body'
    | 'onboarding.permissions.body';
}

const PAGES: readonly PageContent[] = [
  {
    icon: 'library',
    titleKey: 'onboarding.purpose.title',
    bodyKey: 'onboarding.purpose.body',
  },
  {
    icon: 'notification',
    titleKey: 'onboarding.adaptive.title',
    bodyKey: 'onboarding.adaptive.body',
  },
  {
    icon: 'lock',
    titleKey: 'onboarding.permissions.title',
    bodyKey: 'onboarding.permissions.body',
  },
];

/** Named function (not an inline object) so `no-inline-styles` sees a value it can't mistake for a screen-code magic literal — the color/width really are dynamic per dot, not a one-off. */
const dotStyleFor = (
  isActive: boolean,
  activeColor: string,
  inactiveColor: string,
) => ({
  backgroundColor: isActive ? activeColor : inactiveColor,
  width: isActive ? 20 : 8,
});

/** Dot row — decorative; the real page-position announcement is the row's own accessibilityLabel. */
function PageIndicator({
  page,
  label,
}: {
  readonly page: PageIndex;
  readonly label: string;
}) {
  const theme = useTheme();
  return (
    <Stack
      direction="row"
      justify="center"
      gap="xs"
      groupAccessibility
      accessibilityLabel={label}>
      {PAGES.map((_, index) => {
        const dotStyle = dotStyleFor(
          index === page,
          theme.color.primary,
          theme.color.outlineVariant,
        );
        return <View key={index} style={[styles.dot, dotStyle]} />;
      })}
    </Stack>
  );
}

/**
 * The permissions step's live content. `notifications`, `exact_alarm` and
 * `full_screen_intent` are the only capabilities a user can meaningfully act
 * on before they have created anything — the rest of the `CapabilitySnapshot`
 * (channels, battery, scheduler) is either derived from these or has no
 * first-run action, so showing it here would be noise on a page whose whole
 * job is "grant these three." Rows are filtered by kind, not sliced by
 * index, so a future snapshot that reorders or adds items cannot silently
 * change what this page asks for.
 */
function PermissionsPage({stage}: {readonly stage: PermissionStage}) {
  const t = useTranslation();
  const theme = useTheme();
  const capability = useCapabilitySnapshot();

  const items = capability.data?.items ?? [];
  const notifications = items.find(item => item.kind === 'notifications');
  const exactAlarm = items.find(item => item.kind === 'exact_alarm');
  const fullScreenIntent = items.find(item => item.kind === 'full_screen_intent');

  // The primer: explanation only, no rows. The OS dialog fires from the
  // page's primary button, so the user reads why before Android asks.
  if (stage === 'primer') {
    return (
      <ScrollView
        contentContainerStyle={[
          styles.scrollFill,
          {padding: theme.spacing.lg, gap: theme.spacing.lg},
        ]}>
        <Stack gap="xs" align="center">
          <Icon name="notification" size="xl" color={theme.color.onSurfaceVariant} />
          <Text variant="titleLarge" align="center" isHeading>
            {t('onboarding.primer.title')}
          </Text>
          <Text variant="bodyLarge" tone="variant" align="center">
            {t('onboarding.primer.body')}
          </Text>
        </Stack>
      </ScrollView>
    );
  }

  // The review: what is genuinely still outstanding after the dialog. On
  // Android 13+ `exact_alarm` reports ready without ever being asked for
  // (`USE_EXACT_ALARM` is granted at install), so this usually shows one
  // settled row rather than a list of chores. Rows stay filtered by kind,
  // not sliced by index, so a snapshot that reorders cannot change what
  // this page asks for.
  const outstanding = [notifications, exactAlarm, fullScreenIntent].filter(
    item => item !== undefined && item.status !== 'ready',
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.scrollFill,
        {padding: theme.spacing.lg, gap: theme.spacing.lg},
      ]}>
      <Stack gap="xs" align="center">
        <Icon
          name={outstanding.length === 0 ? 'check' : 'lock'}
          size="xl"
          color={
            outstanding.length === 0
              ? theme.color.primary
              : theme.color.onSurfaceVariant
          }
        />
        <Text variant="titleLarge" align="center" isHeading>
          {t('onboarding.permissions.title')}
        </Text>
        <Text variant="bodyLarge" tone="variant" align="center">
          {outstanding.length === 0
            ? t('onboarding.permissions.allSet')
            : t('onboarding.permissions.body')}
        </Text>
      </Stack>

      <Stack gap="sm">
        {notifications ? <CapabilityRow item={notifications} /> : null}
        {exactAlarm ? <CapabilityRow item={exactAlarm} /> : null}
        {fullScreenIntent ? <CapabilityRow item={fullScreenIntent} /> : null}
      </Stack>
    </ScrollView>
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
  const [permissionStage, setPermissionStage] = useState<PermissionStage>('primer');
  const requestNotifications = useRequestNotificationPermission();

  // Onboarding completion must never be a hard gate a user can get stuck
  // behind: `hasCompletedOnboarding` is a soft "don't show this again" flag,
  // not something worth trapping someone in a 3-page flow over if the write
  // fails (a transient bridge error, a cold-start race, anything). Both
  // outcomes navigate; a failed write only costs re-seeing Onboarding once
  // on the next launch, which is a far smaller problem than "no way out."
  const finish = (createFirstReminder: boolean) => {
    const leave = () => {
      navigation.replace(rootRoutes.tabs);
      if (createFirstReminder) {
        navigation.navigate(rootRoutes.reminderEditor, {reminderId: undefined});
      }
    };
    updatePreferences.mutate(
      {hasCompletedOnboarding: true},
      {
        onSuccess: leave,
        onError: () => {
          showToast({message: t('error.unexpected.effect'), tone: 'error'});
          leave();
        },
      },
    );
  };
  const handleStart = () => finish(true);
  const handleSkip = () => finish(false);

  /**
   * Fires the OS notification dialog straight off the primer, then shows what
   * actually happened.
   *
   * `onSettled`, not `onSuccess`: a denial resolves the mutation just as a
   * grant does, and even a thrown bridge error must still advance — leaving
   * the user on a primer whose button has stopped working would be the one
   * genuinely unrecoverable outcome here. The review step reads live
   * capability state rather than this call's result, so it stays truthful
   * either way.
   */
  const handleAllowNotifications = () => {
    haptics.trigger('confirm');
    requestNotifications.mutate(undefined, {
      onSettled: () => setPermissionStage('review'),
    });
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

  const isPrimer = isLastPage && permissionStage === 'primer';

  const body = isLastPage ? (
    <PermissionsPage stage={permissionStage} />
  ) : (
    <EmptyState
      icon={current.icon}
      illustration={page === 0 ? <BrandLogo /> : undefined}
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
        <Stack
          direction="row"
          justify="flex-end"
          paddingHorizontal="sm"
          paddingVertical="xs">
          <Button
            testID={testIds.onboarding.skipButton}
            label={isLastPage ? t('onboarding.exploreFirst') : t('onboarding.skip')}
            variant="text"
            onPress={handleSkip}
          />
        </Stack>

        {theme.a11y.reduceMotion ? (
          body
        ) : (
          <Animated.View
            key={page}
            entering={FadeIn.duration(200)}
            style={styles.flexFill}>
            {body}
          </Animated.View>
        )}

        <Stack gap="md" paddingHorizontal="lg" paddingVertical="md">
          <PageIndicator
            page={page}
            label={t('onboarding.pageIndicator', {
              current: page + 1,
              total: PAGE_COUNT,
            })}
          />
          <Button
            testID={testIds.onboarding.continueButton}
            label={
              isPrimer
                ? t('onboarding.primer.allow')
                : isLastPage
                  ? t('onboarding.start')
                  : t('onboarding.purpose.continue')
            }
            onPress={
              isPrimer ? handleAllowNotifications : isLastPage ? handleStart : goNext
            }
            loading={
              isPrimer
                ? requestNotifications.isPending
                : isLastPage && updatePreferences.isPending
            }
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
  scrollFill: {flexGrow: 1, justifyContent: 'center'},
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
