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

import {useAppearanceSettings} from './useAppearanceSettings';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {appConfig} from '../../core/config/appConfig';
import {
  AppBar,
  Button,
  Chip,
  Divider,
  Icon,
  ListRow,
  Screen,
  Stack,
  StatusPill,
  Text,
  Toggle,
  useTheme,
} from '../../design-system';
import type {ThemePreference} from '../../design-system';
import {useHaptics, usePreferences, useUpdatePreferences} from '../../hooks';
import {useTranslation, type TranslationKey} from '../../localization';
import {mockProfiles} from '../../native-client';
import {isBuiltInProfileNameKey} from '../../native-client/reminderProfileNameKeys';

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

export function SettingsScreen() {
  const t = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();
  const appearance = useAppearanceSettings();
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const haptics = useHaptics();

  const defaultSnoozeMinutes =
    preferences.data?.defaultSnoozeMinutes ?? appConfig.snooze.presetMinutes[1];

  return (
    <Screen hasAppBar scrollable testID={testIds.settings.screen}>
      <AppBar title={t('settings.title')} />

      <Stack gap="xl" paddingVertical="md">
        {/* Appearance */}
        <Stack gap="sm">
          <SectionHeader label={t('settings.appearance.title')} />

          <Stack gap="xxs">
            <Text variant="labelLarge">{t('settings.appearance.theme')}</Text>
            <Stack direction="row" gap="xs" wrap testID={testIds.settings.themeRow}>
              {THEME_OPTIONS.map(option => (
                <Chip
                  key={option.value}
                  label={t(option.labelKey)}
                  selected={appearance.preference === option.value}
                  onPress={() => appearance.setPreference(option.value)}
                />
              ))}
            </Stack>
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

        <Divider />

        {/* Reminders and alerts */}
        <Stack gap="xxs">
          <SectionHeader label={t('settings.section.remindersAndAlerts')} />

          <ListRow
            title={t('settings.row.health')}
            subtitle={t('settings.row.health.subtitle')}
            leading={<Icon name="health" color={theme.color.onSurfaceVariant} />}
            onPress={() => navigation.navigate(rootRoutes.health)}
            trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
          />

          <Stack gap="xxs" paddingVertical="xs">
            <Text variant="titleMedium">{t('settings.row.profiles')}</Text>
            <Text variant="bodyMedium" tone="variant">
              {t('settings.row.profiles.subtitle')}
            </Text>
            {mockProfiles.map(profile => (
              <Stack key={profile.id} direction="row" align="center" gap="xs" paddingVertical="xxs">
                <Icon name="profile" size="sm" color={theme.color.onSurfaceVariant} />
                <Text variant="bodyLarge">
                  {isBuiltInProfileNameKey(profile.nameKey) ? t(profile.nameKey) : profile.nameKey}
                </Text>
              </Stack>
            ))}
          </Stack>

          <Divider spacing="xs" />

          <Stack gap="xxs">
            <Text variant="titleMedium">{t('settings.row.defaults')}</Text>
            <Text variant="labelLarge" tone="variant">
              {t('settings.defaults.snoozeLabel')}
            </Text>
            <Stack direction="row" gap="xxs" wrap>
              {appConfig.snooze.presetMinutes.map(minutes => (
                <Chip
                  key={minutes}
                  label={t('reminders.editor.snoozeMinutes', {minutes})}
                  selected={defaultSnoozeMinutes === minutes}
                  onPress={() => updatePreferences.mutate({defaultSnoozeMinutes: minutes})}
                />
              ))}
            </Stack>
          </Stack>

          <Divider spacing="xs" />

          <ListRow
            title={t('settings.row.statistics')}
            subtitle={t('settings.row.statistics.subtitle')}
            leading={<Icon name="today" color={theme.color.onSurfaceVariant} />}
            onPress={() => navigation.navigate(rootRoutes.statistics)}
            trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
          />
        </Stack>

        <Divider />

        {/* Data and privacy */}
        <Stack gap="xxs">
          <SectionHeader label={t('settings.section.dataAndPrivacy')} />

          <ListRow
            title={t('settings.row.backup')}
            subtitle={t('settings.row.backup.subtitle')}
            leading={<Icon name="backup" color={theme.color.onSurfaceVariant} />}
            onPress={() => navigation.navigate(rootRoutes.backup)}
            trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
          />
          <ListRow
            title={t('settings.row.import')}
            subtitle={t('settings.row.import.subtitle')}
            leading={<Icon name="download" color={theme.color.onSurfaceVariant} />}
            onPress={() => navigation.navigate(rootRoutes.import)}
            trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
          />

          <Divider spacing="xs" />

          <Stack gap="xxs">
            <Text variant="titleMedium">{t('settings.row.privacy')}</Text>
            <Text variant="bodyMedium" tone="variant">
              {t('settings.privacy.body')}
            </Text>
          </Stack>
        </Stack>

        <Divider />

        {/* Accessibility */}
        <Stack gap="xxs">
          <SectionHeader label={t('settings.row.accessibility')} />
          <Stack gap="xxs">
            <Stack direction="row" align="center" justify="space-between">
              <Text variant="bodyLarge">{t('settings.accessibility.reduceMotion')}</Text>
              <StatusPill
                kind={theme.a11y.reduceMotion ? 'ready' : 'neutral'}
                label={theme.a11y.reduceMotion ? t('settings.accessibility.on') : t('settings.accessibility.off')}
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

        <Divider />

        {/* Support */}
        <Stack gap="xxs">
          <SectionHeader label={t('settings.section.support')} />
          <ListRow
            title={t('settings.row.about')}
            subtitle={t('settings.row.about.subtitle')}
            leading={<Icon name="info" color={theme.color.onSurfaceVariant} />}
            onPress={() => navigation.navigate(rootRoutes.about)}
            trailing={<Icon name="chevronRight" color={theme.color.onSurfaceVariant} />}
          />
        </Stack>
      </Stack>
    </Screen>
  );
}
