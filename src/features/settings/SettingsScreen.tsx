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
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback, useRef, useState} from 'react';
import {StyleSheet} from 'react-native';

import {useAppearanceSettings} from './useAppearanceSettings';
import {useMediaStorageUsage} from './useMediaStorageUsage';
import {useAppContainer} from '../../app/di';
import type {RootStackParamList} from '../../app/navigation/types';
import {useToast} from '../../app/toast/ToastProvider';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {appConfig} from '../../core/config/appConfig';
import type {AppError} from '../../core/errors';
import {unwrapResult} from '../../core/state';
import {
  AppBar,
  Button,
  Chip,
  ChipRow,
  Divider,
  Icon,
  IconButton,
  ListRow,
  Screen,
  SegmentedControl,
  Stack,
  StatusPill,
  Text,
  Toggle,
  useFloatingAppBar,
  useTheme,
} from '../../design-system';
import type {IconName, ThemePreference} from '../../design-system';
import {
  useAppMutation,
  useCapabilitySnapshot,
  useHaptics,
  usePreferences,
  useProfiles,
  useUpdatePreferences,
} from '../../hooks';
import {formatStorageSize, useTranslation, type TranslationKey} from '../../localization';
import {isBuiltInProfileNameKey} from '../../native-client/reminderProfileNameKeys';
import type {ReminderProfile, UUID} from '../../native-client/types';
import {statusKindFor, statusLabelKeyFor} from '../home/capabilityStatus';
import {PROFILE_DESCRIPTION_KEY, PROFILE_ICON} from '../reminders/profileDisplay';
import {useScheduleTestReminder} from '../reminders/useScheduleTestReminder';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const TONE_PREVIEW_MS = 6000;

const THEME_OPTIONS: readonly {
  readonly value: ThemePreference;
  readonly labelKey: TranslationKey;
}[] = [
  {value: 'system', labelKey: 'settings.appearance.theme.system'},
  {value: 'light', labelKey: 'settings.appearance.theme.light'},
  {value: 'dark', labelKey: 'settings.appearance.theme.dark'},
];

/**
 * The same quiet uppercase label Home and the reminder editor use. It was
 * `titleMedium`, which is exactly what several *rows* on this screen used
 * for their own titles — so "Alert profiles" (a row) and "Reminders and
 * alerts" (the section containing it) carried identical weight and the page
 * read as a flat list of headings.
 */
function SectionHeader({label}: {readonly label: string}) {
  return (
    <Text variant="labelLarge" tone="variant" isHeading>
      {label.toUpperCase()}
    </Text>
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
  const {client} = useAppContainer();
  const appearance = useAppearanceSettings();
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const haptics = useHaptics();
  const profiles = useProfiles();
  const capability = useCapabilitySnapshot();
  const storageUsage = useMediaStorageUsage();
  // `undefined` while the first read is in flight, so the row shows its
  // title and explainer with no subtitle rather than flashing "Nothing
  // imported yet" at a user who has a full library.
  const storageSubtitle = ((): string | undefined => {
    const usage = storageUsage.data;
    if (!usage) {
      return undefined;
    }
    if (usage.itemCount === 0) {
      return t('settings.row.storage.empty');
    }
    const items = `${usage.itemCount} ${t(
      usage.itemCount === 1 ? 'settings.row.storage.item' : 'settings.row.storage.items',
    )}`;
    const base = t('settings.row.storage.subtitle', {
      items,
      size: formatStorageSize(usage.totalBytes),
    });
    // Appended rather than replacing the total: the user needs both "how
    // much is Nudgio holding" and "how much of it is broken".
    return usage.unavailableCount > 0
      ? `${base} · ${t('settings.row.storage.unavailable', {count: usage.unavailableCount})}`
      : base;
  })();
  const [profilesExpanded, setProfilesExpanded] = useState(false);
  const {showToast} = useToast();
  const testReminder = useScheduleTestReminder();
  const pickRingtone = useAppMutation({
    mutationFn: (currentUri: string | null) =>
      unwrapResult(() => client.pickAlarmRingtone(currentUri)),
    onSuccess: picked => {
      if (picked === null) {
        return;
      }
      updatePreferences.mutate({alarmRingtoneUri: picked.uri}, {
        onSuccess: () => {
          showToast({message: t('settings.defaults.alarmRingtone.changed'), tone: 'info'});
          startTonePreview(picked.uri);
        },
        onError: () => showToast({message: t('settings.defaults.alarmRingtone.saveFailed'), tone: 'error'}),
      });
    },
    onError: () => {
      showToast({message: t('settings.defaults.alarmRingtone.failed'), tone: 'error'});
    },
  });

  // Alarm tones can run long; a preview only needs a few seconds to be recognizable.
  const [isPreviewingTone, setIsPreviewingTone] = useState(false);
  const toneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewGeneration = useRef(0);
  const stopTonePreview = useCallback(() => {
    previewGeneration.current += 1;
    if (toneTimer.current !== null) {
      clearTimeout(toneTimer.current);
      toneTimer.current = null;
    }
    setIsPreviewingTone(false);
    client.stopAlarmRingtonePreview();
  }, [client]);
  const startTonePreview = async (uri: string | null) => {
    const generation = ++previewGeneration.current;
    if (toneTimer.current !== null) {
      clearTimeout(toneTimer.current);
    }
    const result = await client.previewAlarmRingtone(uri);
    if (generation !== previewGeneration.current) {
      return;
    }
    if (!result.ok || result.value.status !== 'ok') {
      setIsPreviewingTone(false);
      showToast({message: t('settings.defaults.alarmRingtone.previewFailed'), tone: 'error'});
      return;
    }
    setIsPreviewingTone(true);
    toneTimer.current = setTimeout(stopTonePreview, TONE_PREVIEW_MS);
  };
  useFocusEffect(useCallback(() => stopTonePreview, [stopTonePreview]));
  const [previewingProfileId, setPreviewingProfileId] = useState<UUID | null>(null);
  const appBar = useFloatingAppBar();

  const defaultSnoozeMinutes =
    preferences.data?.defaultSnoozeMinutes ?? appConfig.snooze.presetMinutes[1];

  /**
   * "Preview alarm styles": schedules a real, short-delay alarm styled
   * with this profile's presentation policy. This is not a session and
   * does not test timeout, retries, or Snooze; the UI explains that limit.
   */
  const previewProfile = (profile: ReminderProfile) => {
    const name = isBuiltInProfileNameKey(profile.nameKey)
      ? t(profile.nameKey)
      : profile.nameKey;
    setPreviewingProfileId(profile.id);
    testReminder.mutate(
      {
        title: t('settings.alarmPreview.notificationTitle', {name}),
        body: t(
          PROFILE_DESCRIPTION_KEY[profile.nameKey] ?? 'profile.gentle.description',
        ),
        fullScreenWhenLocked: profile.fullScreenWhenLocked,
      },
      {
        onSuccess: () => {
          showToast({message: t('settings.alarmPreview.scheduled'), tone: 'info'});
          setPreviewingProfileId(null);
        },
        onError: (error: AppError) => {
          setPreviewingProfileId(null);
          const messageKey =
            error.code === 'MR_NOTIFICATIONS_BLOCKED'
              ? 'settings.alarmPreview.notificationsBlocked'
              : 'settings.alarmPreview.failed';
          showToast({message: t(messageKey), tone: 'error'});
        },
      },
    );
  };

  return (
    <Screen
      hasAppBar
      scrollable
      testID={testIds.settings.screen}
      onScroll={appBar.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{paddingTop: appBar.barHeight}}
      appBarSlot={
        <AppBar
          title={t('settings.title')}
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
        />
      }>
      <Stack gap="xl" paddingVertical="md">
        {/* Appearance */}
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

          {/*
            MR-04: Material You is opt-in; the toggle is only offered where the
            platform can supply a palette (API 31+, see DL-002 in
            docs/decision-log.md). The divider is inside the condition: left
            outside it, a device without dynamic color drew two rules with
            nothing between them.
          */}
          {appearance.dynamicColorSupported ? (
            <>
            <Divider spacing="xs" />
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
            </>
          ) : null}
        </Stack>

        <Divider />

        {/* Reminders and alerts */}
        <Stack gap="xxs">
          <SectionHeader label={t('settings.section.remindersAndAlerts')} />

          <ListRow
            title={t('settings.row.health')}
            subtitle={t('settings.row.health.subtitle')}
            leading={<SettingsRowIcon name="health" />}
            onPress={() => navigation.navigate(rootRoutes.health)}
            trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
          />
          {capability.data && <Stack gap="xxs">
            <StatusPill kind={statusKindFor(capability.data.overall)} label={t(statusLabelKeyFor(capability.data.overall))} />
            <Text variant="bodyMedium" tone="variant">{t(capability.data.overall === 'ok'
              ? 'settings.alarmHealth.ready' : 'settings.alarmHealth.limited')}</Text>
          </Stack>}

          {/*
            A row that expands, not a heading with a paragraph and a tonal
            button under it. The three-sentence caveat about what a preview
            does and does not cover only appears once the list is open —
            before that it explains a control the reader cannot see.
          */}
          <ListRow
            title={t('settings.row.profiles')}
            subtitle={t('settings.row.profiles.subtitle')}
            onPress={() => setProfilesExpanded(value => !value)}
            trailing={
              <Icon
                name={profilesExpanded ? 'chevronUp' : 'chevronDown'}
                color={theme.color.onSurfaceVariant}
              />
            }
          />
          <Stack gap="xxs">
            {profilesExpanded ? (
              <Text variant="labelMedium" tone="variant">
                {t('settings.alarmPreview.hint')}
              </Text>
            ) : null}
            {profilesExpanded && (profiles.data ?? []).map(profile => {
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
                        {t(
                          PROFILE_DESCRIPTION_KEY[profile.nameKey] ??
                            'profile.gentle.description',
                        )}
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

          {/* No "Reminder defaults" heading: it sat *inside* "Reminders and
              alerts" at the same weight as that section, and the field's own
              label already says what this is. */}
          <Stack gap="xxs">
            <Text variant="labelLarge">{t('settings.defaults.snoozeLabel')}</Text>
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

          {/*
            One control for one choice. This was two switches — "Use device
            time format", and a "24-hour time" switch that the first one
            disabled — so the setting had an unreachable state you had to
            discover by toggling something else, and a disabled switch sat
            there explaining itself in two lines. Device/12-hour/24-hour is a
            single mutually-exclusive value, which is what `SegmentedControl`
            already expresses directly above this for Theme.
          */}
          <Stack gap="xxs">
            <Text variant="labelLarge">{t('settings.defaults.timeFormat')}</Text>
            <SegmentedControl
              accessibilityLabel={t('settings.defaults.timeFormat')}
              value={
                (preferences.data?.use24HourTime ?? null) === null
                  ? 'device'
                  : preferences.data?.use24HourTime
                    ? 'h24'
                    : 'h12'
              }
              onChange={next =>
                updatePreferences.mutate({
                  use24HourTime: next === 'device' ? null : next === 'h24',
                })
              }
              options={[
                {value: 'device', label: t('settings.defaults.timeFormat.device')},
                {value: 'h12', label: t('settings.defaults.timeFormat.h12')},
                {value: 'h24', label: t('settings.defaults.timeFormat.h24')},
              ]}
            />
          </Stack>

          <Divider spacing="xs" />

          {/*
            One row, like every other: tap it to change the tone, with the
            only other control — audition what is set — in the trailing slot.
            The "Change" text button used to float *outside* the row,
            right-aligned under it beside a second icon button, which is why
            this one entry needed its own three-line layout.
          */}
          <ListRow
            title={t('settings.defaults.alarmRingtone')}
            subtitle={
              preferences.data?.alarmRingtoneTitle ??
              t('settings.defaults.alarmRingtone.helper')
            }
            onPress={() => {
              stopTonePreview();
              pickRingtone.mutate(preferences.data?.alarmRingtoneUri ?? null);
            }}
            disabled={pickRingtone.isPending || updatePreferences.isPending}
            accessibilityLabel={[
              t('settings.defaults.alarmRingtone'),
              preferences.data?.alarmRingtoneTitle ?? '',
              t('settings.defaults.alarmRingtone.change'),
            ]
              .filter(Boolean)
              .join('. ')}
            trailing={
              <IconButton
                name={isPreviewingTone ? 'pause' : 'play'}
                label={t(
                  isPreviewingTone
                    ? 'settings.defaults.alarmRingtone.stopPreview'
                    : 'settings.defaults.alarmRingtone.preview',
                )}
                tone="primary"
                selected={isPreviewingTone}
                onPress={() =>
                  isPreviewingTone
                    ? stopTonePreview()
                    : startTonePreview(preferences.data?.alarmRingtoneUri ?? null)
                }
              />
            }
          />

          <Divider spacing="xs" />

          <ListRow
            title={t('settings.row.statistics')}
            subtitle={t('settings.row.statistics.subtitle')}
            leading={<SettingsRowIcon name="today" />}
            onPress={() => navigation.navigate(rootRoutes.statistics)}
            trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
          />
        </Stack>

        <Divider />

        {/* Data and privacy */}
        <Stack gap="xxs">
          <SectionHeader label={t('settings.section.dataAndPrivacy')} />

          {/* Copying media means Nudgio holds real storage, and nothing in
              the product ever said so. Informational rather than a link:
              the Library already *is* the place media is managed, so a
              "Manage storage" row would only be a second door to it. */}
          <ListRow
            title={t('settings.row.storage')}
            subtitle={storageSubtitle}
            leading={<SettingsRowIcon name="image" />}
          />
          <Stack paddingHorizontal="md">
            <Text variant="bodyMedium" tone="variant">
              {t('settings.storage.explainer')}
            </Text>
          </Stack>

          <Divider spacing="xs" />

          <ListRow
            title={t('settings.row.backup')}
            subtitle={t('settings.row.backup.subtitle')}
            leading={<SettingsRowIcon name="backup" />}
            onPress={() => navigation.navigate(rootRoutes.backup)}
            trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
          />
          <ListRow
            title={t('settings.row.import')}
            subtitle={t('settings.row.import.subtitle')}
            leading={<SettingsRowIcon name="download" />}
            onPress={() => navigation.navigate(rootRoutes.import)}
            trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
          />

          <Divider spacing="xs" />

          <Stack gap="xxs">
            <Text variant="labelLarge">{t('settings.row.privacy')}</Text>
            <Text variant="bodyMedium" tone="variant">
              {t('settings.privacy.body')}
            </Text>
          </Stack>
        </Stack>

        <Divider />

        {/* Accessibility */}
        <Stack gap="xxs">
          <SectionHeader label={t('settings.row.accessibility')} />
          <ListRow
            title={t('settings.accessibility.reduceMotion')}
            subtitle={t('settings.accessibility.reduceMotion.helper')}
            trailing={
              <StatusPill
                kind={theme.a11y.reduceMotion ? 'ready' : 'neutral'}
                label={
                  theme.a11y.reduceMotion
                    ? t('settings.accessibility.on')
                    : t('settings.accessibility.off')
                }
              />
            }
          />
          <Text variant="labelMedium" tone="variant">
            {t('settings.accessibility.fontScale')}
          </Text>

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

        <Divider />

        {/* Support */}
        <Stack gap="xxs">
          <SectionHeader label={t('settings.section.support')} />
          <ListRow
            title={t('settings.row.about')}
            subtitle={t('settings.row.about.subtitle')}
            leading={<SettingsRowIcon name="info" />}
            onPress={() => navigation.navigate(rootRoutes.about)}
            trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
          />
        </Stack>
      </Stack>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flexFill: {flex: 1},
});
