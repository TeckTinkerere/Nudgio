/**
 * Settings screen (MR-03 "Settings").
 *
 * Appearance is implemented end to end (theme preference + Material You
 * opt-in). The remaining rows route to their own screens where MR-03 gives
 * them one (Health, Statistics, Backup, Import, About); profiles, reminder
 * defaults, accessibility and privacy are inline sections here since MR-03
 * does not call for standalone screens for them and this build's scope names
 * nine specific top-level screens, none of which are those four.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useState} from 'react';
import {StyleSheet} from 'react-native';
import Animated, {FadeInUp} from 'react-native-reanimated';

import {useAppearanceSettings} from './useAppearanceSettings';
import type {RootStackParamList} from '../../app/navigation/types';
import {useToast} from '../../app/toast/ToastProvider';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {appConfig} from '../../core/config/appConfig';
import {
  AppBar,
  Button,
  Chip,
  ChipRow,
  Divider,
  Icon,
  ListRow,
  Screen,
  SegmentedControl,
  Stack,
  StatusPill,
  Text,
  Toggle,
  useTheme,
} from '../../design-system';
import type {IconName, ThemePreference} from '../../design-system';
import {useHaptics, usePreferences, useProfiles, useUpdatePreferences} from '../../hooks';
import {useTranslation, type TranslationKey} from '../../localization';
import {isBuiltInProfileNameKey} from '../../native-client/reminderProfileNameKeys';
import type {ReminderProfile, UUID} from '../../native-client/types';
import {PROFILE_DESCRIPTION_KEY, PROFILE_ICON} from '../reminders/profileDisplay';
import {useScheduleTestReminder} from '../reminders/useScheduleTestReminder';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const THEME_OPTIONS: readonly {
  readonly value: ThemePreference;
  readonly labelKey: TranslationKey;
}[] = [
  {value: 'system', labelKey: 'settings.appearance.theme.system'},
  {value: 'light', labelKey: 'settings.appearance.theme.light'},
  {value: 'dark', labelKey: 'settings.appearance.theme.dark'},
];

function SectionHeader({label}: {readonly label: string}) {
  return (
    <Text variant="titleMedium" tone="variant">
      {label}
    </Text>
  );
}

/** Staggered per-section entrance, skipped under `reduceMotion` (`tokens/motion.ts` contract). */
function SectionReveal({
  index,
  reduceMotion,
  children,
}: {
  readonly index: number;
  readonly reduceMotion: boolean;
  readonly children: React.ReactNode;
}) {
  if (reduceMotion) {
    return <>{children}</>;
  }
  return (
    <Animated.View
      entering={FadeInUp.delay(index * 70)
        .springify()
        .damping(18)}>
      {children}
    </Animated.View>
  );
}

/**
 * Tonal icon chip for every row's `leading` slot — previously a bare glyph
 * in the row's own text color, which read as a plain, dense settings list
 * rather than something considered. Reuses the `secondaryContainer` role
 * (MR-04: warm attention, never errors) so Settings reads distinctly from
 * Today/Reminders' `primaryContainer` avatar treatment rather than repeating
 * it verbatim.
 */
function SettingsRowIcon({name}: {readonly name: IconName}) {
  const theme = useTheme();
  const styles = StyleSheet.create({
    box: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.card,
      backgroundColor: theme.color.secondaryContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  return (
    <Stack style={styles.box} align="center" justify="center">
      <Icon name={name} size="sm" color={theme.color.onSecondaryContainer} />
    </Stack>
  );
}

export function SettingsScreen() {
  const t = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();
  const appearance = useAppearanceSettings();
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const haptics = useHaptics();
  const profiles = useProfiles();
  const {showToast} = useToast();
  const testReminder = useScheduleTestReminder();
  const [previewingProfileId, setPreviewingProfileId] = useState<UUID | null>(null);

  const defaultSnoozeMinutes =
    preferences.data?.defaultSnoozeMinutes ?? appConfig.snooze.presetMinutes[1];

  /**
   * "Preview alarm styles": schedules a real, short-delay alarm styled
   * exactly like this profile (same full-screen-when-locked behavior), so
   * the user sees/hears the actual difference between Gentle/Standard/
   * Persistent before picking one for a real reminder — not just a
   * description of the difference.
   */
  const previewProfile = (profile: ReminderProfile) => {
    const name = isBuiltInProfileNameKey(profile.nameKey) ? t(profile.nameKey) : profile.nameKey;
    setPreviewingProfileId(profile.id);
    testReminder.mutate(
      {
        title: t('settings.alarmPreview.notificationTitle', {name}),
        body: t(PROFILE_DESCRIPTION_KEY[profile.nameKey] ?? 'profile.gentle.description'),
        fullScreenWhenLocked: profile.fullScreenWhenLocked,
      },
      {
        onSuccess: () => {
          showToast({message: t('settings.alarmPreview.scheduled'), tone: 'info'});
          setPreviewingProfileId(null);
        },
        onError: () => setPreviewingProfileId(null),
      },
    );
  };

  return (
    <Screen hasAppBar scrollable testID={testIds.settings.screen}>
      <AppBar title={t('settings.title')} />

      <Stack gap="xl" paddingVertical="md">
        {/* Appearance */}
        <SectionReveal index={0} reduceMotion={theme.a11y.reduceMotion}>
          <Stack gap="sm">
            <SectionHeader label={t('settings.appearance.title')} />

            {/*
            Segmented buttons, not a Chip row. System/Light/Dark is one
            mutually-exclusive value, which is exactly `SegmentedControl`'s
            radiogroup semantics — a row of `Chip`s announces three
            independently-selectable filters to TalkBack and gives no visual
            affordance that picking one clears the others (MR-13 ACC: the
            control's role must match its behavior). Reuses the component the
            reminder editor's repeat type already uses rather than adding a
            fourth way to express a single choice.
          */}
            <Stack gap="xxs">
              <Text variant="labelLarge">{t('settings.appearance.theme')}</Text>
              <SegmentedControl
                testID={testIds.settings.themeRow}
                accessibilityLabel={t('settings.appearance.theme')}
                value={appearance.preference}
                onChange={appearance.setPreference}
                options={THEME_OPTIONS.map(option => ({
                  value: option.value,
                  label: t(option.labelKey),
                }))}
              />
            </Stack>

            <Divider spacing="xs" />

            {/*
            MR-04: Material You is opt-in; the toggle is only offered where the
            platform can supply a palette (API 31+, see DL-002 in
            docs/decision-log.md).
          */}
            {appearance.dynamicColorSupported ? (
              <ListRow
                title={t('settings.appearance.materialYou')}
                subtitle={t('settings.appearance.materialYou.helper')}
                trailing={
                  <Toggle
                    testID={testIds.settings.materialYouToggle}
                    value={appearance.useMaterialYou}
                    onValueChange={appearance.setUseMaterialYou}
                    label={t('settings.appearance.materialYou')}
                  />
                }
              />
            ) : null}
          </Stack>
        </SectionReveal>

        <Divider />

        {/* Reminders and alerts */}
        <SectionReveal index={1} reduceMotion={theme.a11y.reduceMotion}>
          <Stack gap="xxs">
            <SectionHeader label={t('settings.section.remindersAndAlerts')} />

            <ListRow
              title={t('settings.row.health')}
              subtitle={t('settings.row.health.subtitle')}
              leading={<SettingsRowIcon name="health" />}
              onPress={() => navigation.navigate(rootRoutes.health)}
              trailing={
                <Icon name="chevronRight" color={theme.color.onSurfaceVariant} />
              }
            />

            <Stack gap="xxs" paddingVertical="xs">
              <Text variant="titleMedium">{t('settings.row.profiles')}</Text>
              <Text variant="bodyMedium" tone="variant">
                {t('settings.row.profiles.subtitle')}
              </Text>
              <Text variant="labelMedium" tone="variant">
                {t('settings.alarmPreview.hint')}
              </Text>
              {(profiles.data ?? []).map(profile => {
                const profileName = isBuiltInProfileNameKey(profile.nameKey)
                  ? t(profile.nameKey)
                  : profile.nameKey;
                return (
                  <Stack key={profile.id} gap="xxs" paddingVertical="xxs">
                    <Stack direction="row" align="center" gap="xs">
                      <Icon
                        name={PROFILE_ICON[profile.nameKey] ?? 'notification'}
                        size="sm"
                        color={theme.color.onSurfaceVariant}
                      />
                      <Stack style={styles.flexFill} gap={2}>
                        <Text variant="bodyLarge">{profileName}</Text>
                        <Text variant="labelMedium" tone="variant">
                          {t(PROFILE_DESCRIPTION_KEY[profile.nameKey] ?? 'profile.gentle.description')}
                        </Text>
                      </Stack>
                    </Stack>
                    <Button
                      label={t('action.preview')}
                      variant="text"
                      icon="play"
                      loading={previewingProfileId === profile.id}
                      onPress={() => previewProfile(profile)}
                    />
                  </Stack>
                );
              })}
            </Stack>

            <Divider spacing="xs" />

            <Stack gap="xxs">
              <Text variant="titleMedium">{t('settings.row.defaults')}</Text>
              <Text variant="labelLarge" tone="variant">
                {t('settings.defaults.snoozeLabel')}
              </Text>
              <ChipRow>
                {appConfig.snooze.presetMinutes.map(minutes => (
                  <Chip
                    key={minutes}
                    label={t('reminders.editor.snoozeMinutes', {minutes})}
                    selected={defaultSnoozeMinutes === minutes}
                    onPress={() =>
                      updatePreferences.mutate({defaultSnoozeMinutes: minutes})
                    }
                  />
                ))}
              </ChipRow>
            </Stack>

            <Divider spacing="xs" />

            <ListRow
              title={t('settings.row.statistics')}
              subtitle={t('settings.row.statistics.subtitle')}
              leading={<SettingsRowIcon name="today" />}
              onPress={() => navigation.navigate(rootRoutes.statistics)}
              trailing={
                <Icon name="chevronRight" color={theme.color.onSurfaceVariant} />
              }
            />
          </Stack>
        </SectionReveal>

        <Divider />

        {/* Data and privacy */}
        <SectionReveal index={2} reduceMotion={theme.a11y.reduceMotion}>
          <Stack gap="xxs">
            <SectionHeader label={t('settings.section.dataAndPrivacy')} />

            <ListRow
              title={t('settings.row.backup')}
              subtitle={t('settings.row.backup.subtitle')}
              leading={<SettingsRowIcon name="backup" />}
              onPress={() => navigation.navigate(rootRoutes.backup)}
              trailing={
                <Icon name="chevronRight" color={theme.color.onSurfaceVariant} />
              }
            />
            <ListRow
              title={t('settings.row.import')}
              subtitle={t('settings.row.import.subtitle')}
              leading={<SettingsRowIcon name="download" />}
              onPress={() => navigation.navigate(rootRoutes.import)}
              trailing={
                <Icon name="chevronRight" color={theme.color.onSurfaceVariant} />
              }
            />

            <Divider spacing="xs" />

            <Stack gap="xxs">
              <Text variant="titleMedium">{t('settings.row.privacy')}</Text>
              <Text variant="bodyMedium" tone="variant">
                {t('settings.privacy.body')}
              </Text>
            </Stack>
          </Stack>
        </SectionReveal>

        <Divider />

        {/* Accessibility */}
        <SectionReveal index={3} reduceMotion={theme.a11y.reduceMotion}>
          <Stack gap="xxs">
            <SectionHeader label={t('settings.row.accessibility')} />
            <Stack gap="xxs">
              <Stack direction="row" align="center" justify="space-between">
                <Text variant="bodyLarge">
                  {t('settings.accessibility.reduceMotion')}
                </Text>
                <StatusPill
                  kind={theme.a11y.reduceMotion ? 'ready' : 'neutral'}
                  label={
                    theme.a11y.reduceMotion
                      ? t('settings.accessibility.on')
                      : t('settings.accessibility.off')
                  }
                />
              </Stack>
              <Text variant="labelMedium" tone="variant">
                {t('settings.accessibility.reduceMotion.helper')}
              </Text>
              <Text variant="labelMedium" tone="variant">
                {t('settings.accessibility.fontScale')}
              </Text>
            </Stack>

            <Divider spacing="xs" />

            <ListRow
              title={t('settings.accessibility.strongerHaptics')}
              subtitle={t('settings.accessibility.strongerHaptics.helper')}
              trailing={
                <Toggle
                  testID={testIds.settings.strongerHapticsToggle}
                  value={haptics.stronger}
                  onValueChange={next => {
                    haptics.setStronger(next);
                    haptics.trigger('confirm');
                  }}
                  label={t('settings.accessibility.strongerHaptics')}
                />
              }
            />
            {/* MR-13: "custom vibration patterns are ... previewable." */}
            <Button
              label={t('action.preview')}
              variant="text"
              icon="play"
              onPress={() => haptics.trigger('confirm')}
            />
          </Stack>
        </SectionReveal>

        <Divider />

        {/* Support */}
        <SectionReveal index={4} reduceMotion={theme.a11y.reduceMotion}>
          <Stack gap="xxs">
            <SectionHeader label={t('settings.section.support')} />
            <ListRow
              title={t('settings.row.about')}
              subtitle={t('settings.row.about.subtitle')}
              leading={<SettingsRowIcon name="info" />}
              onPress={() => navigation.navigate(rootRoutes.about)}
              trailing={
                <Icon name="chevronRight" color={theme.color.onSurfaceVariant} />
              }
            />
          </Stack>
        </SectionReveal>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
});
