/**
 * Editor section "Alert & snooze": how loudly the reminder asks for
 * attention, how long a snooze lasts, and whether history is kept.
 *
 * Collapsed by default to a one-line summary ("Standard · snooze 10 min"):
 * every reminder has sensible defaults here, and the person creating a
 * reminder is thinking about *what* and *when*, not alarm channels. It is
 * still one tap away, never hidden behind a separate screen.
 */
import {useState} from 'react';
import {StyleSheet} from 'react-native';

import {appConfig} from '../../../core/config/appConfig';
import {Card, Chip, Icon, RadioCard, Stack, Text, Toggle, useTheme} from '../../../design-system';
import {useTranslation} from '../../../localization';
import {isBuiltInProfileNameKey} from '../../../native-client/reminderProfileNameKeys';
import type {ReminderProfile, UUID} from '../../../native-client/types';
import {PROFILE_DESCRIPTION_KEY, PROFILE_ICON} from '../profileDisplay';

export interface ReminderAlertSectionProps {
  readonly profiles: readonly ReminderProfile[];
  readonly profileId: UUID | undefined;
  readonly onProfileChange: (id: UUID) => void;
  readonly snoozeMinutes: number;
  readonly onSnoozeChange: (minutes: number) => void;
  readonly historyEnabled: boolean;
  readonly onHistoryChange: (enabled: boolean) => void;
}

export function ReminderAlertSection({
  profiles,
  profileId,
  onProfileChange,
  snoozeMinutes,
  onSnoozeChange,
  historyEnabled,
  onHistoryChange,
}: ReminderAlertSectionProps) {
  const t = useTranslation();
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const profileName = (profile: ReminderProfile) =>
    isBuiltInProfileNameKey(profile.nameKey) ? t(profile.nameKey) : profile.nameKey;
  const selected = profiles.find(profile => profile.id === profileId);

  return (
    <Stack gap="sm">
      <Card onPress={() => setExpanded(value => !value)} accessibilityLabel={t('reminders.editor.alertStyle')}
        testID="reminder-alert-summary">
        <Stack direction="row" align="center" gap="sm">
          <Icon name={selected ? PROFILE_ICON[selected.nameKey] ?? 'notification' : 'notification'}
            color={theme.color.primary} />
          <Stack style={styles.flex} gap={2}>
            <Text variant="titleMedium">{t('reminders.editor.alertStyle')}</Text>
            <Text variant="bodyMedium" tone="variant">
              {t('reminders.editor.alertSummary', {
                profile: selected ? profileName(selected) : '',
                minutes: snoozeMinutes,
              })}
            </Text>
          </Stack>
          <Icon name={expanded ? 'chevronUp' : 'chevronDown'} color={theme.color.onSurfaceVariant} />
        </Stack>
      </Card>

      {expanded ? (
        <Stack gap="lg">
          <Stack gap="xs" accessibilityLabel={t('reminders.editor.alertStyle')}>
            {profiles.length === 0 ? (
              <Text variant="bodyMedium" tone="error">{t('reminders.editor.validationProfileRequired')}</Text>
            ) : null}
            {profiles.map(profile => (
              <RadioCard
                key={profile.id}
                title={profileName(profile)}
                description={t(PROFILE_DESCRIPTION_KEY[profile.nameKey] ?? 'profile.gentle.description')}
                icon={PROFILE_ICON[profile.nameKey] ?? 'notification'}
                selected={profile.id === profileId}
                onPress={() => onProfileChange(profile.id)}
                notice={profile.nameKey === 'profile.persistent.name' ? t('profile.persistent.notice') : undefined}
              />
            ))}
          </Stack>

          <Stack gap="xs">
            <Text variant="titleMedium">{t('reminders.editor.snooze')}</Text>
            <Stack direction="row" gap="xxs" wrap accessibilityLabel={t('reminders.editor.snoozeDefault')}>
              {appConfig.snooze.presetMinutes.map(minutes => (
                <Chip
                  key={minutes}
                  label={t('reminders.editor.snoozeMinutes', {minutes})}
                  selected={snoozeMinutes === minutes}
                  onPress={() => onSnoozeChange(minutes)}
                />
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" align="center" justify="space-between" gap="sm">
            <Stack style={styles.flex} gap={2}>
              <Text variant="titleMedium">{t('reminders.editor.historyToggle')}</Text>
              <Text variant="bodyMedium" tone="variant">{t('reminders.editor.historyHelper')}</Text>
            </Stack>
            <Toggle value={historyEnabled} onValueChange={onHistoryChange} label={t('reminders.editor.historyToggle')} />
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}

const styles = StyleSheet.create({
  flex: {flex: 1},
});
