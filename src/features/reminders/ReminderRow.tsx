/**
 * One reminder in the Reminders list. The user's media leads — it is what
 * makes each reminder recognizable — followed by the title, when it next
 * happens (or that it is paused/done), how it repeats and whether it opens
 * something afterwards. The toggle pauses and resumes; it is hidden for a
 * finished one-time reminder, where switching it on would schedule nothing.
 */
import {Image, StyleSheet, View} from 'react-native';

import {actionTargetOf, ACTION_TARGET_ICON} from './reminderActions';
import {reminderStatus, relativeDayOf, type ReminderStatus} from './reminderStatus';
import {
  AnimatedPressable,
  Card,
  Icon,
  Stack,
  Text,
  Toggle,
  useTheme,
  type IconName,
} from '../../design-system';
import {useTranslation} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import type {MediaKind, ReminderSummary} from '../../native-client/types';

const MEDIA_ICON: Record<MediaKind, IconName> = {video: 'video', audio: 'audio', image: 'image', text: 'text'};

const THUMB = 64;

export interface ReminderRowProps {
  readonly reminder: ReminderSummary;
  readonly now: Date;
  readonly use24Hour: boolean | null;
  readonly onOpen: () => void;
  readonly onToggle: (enabled: boolean) => void;
}

/**
 * Colour for each status line.
 *
 * `mediaMissing` is the only one that earns `error`: it is the only state
 * the user has to act on, and it previously rendered in the same grey as
 * "Paused", which is how four broken reminders looked like four deliberate
 * ones.
 */
const STATUS_TONE: Record<ReminderStatus['kind'], 'primary' | 'variant' | 'error'> = {
  next: 'primary',
  mediaMissing: 'error',
  paused: 'variant',
  done: 'variant',
  unscheduled: 'variant',
};

export function ReminderRow({reminder, now, use24Hour, onOpen, onToggle}: ReminderRowProps) {
  const t = useTranslation();
  const theme = useTheme();
  const thumbnail = thumbnailImageSource(reminder.thumbnailToken);
  const status = reminderStatus(reminder, now);
  const statusText = describeStatus(status, now, use24Hour, t);
  const muted = status.kind === 'paused' || status.kind === 'done';

  const styles = StyleSheet.create({
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: theme.radius.card,
      backgroundColor: theme.color.surfaceContainerHigh,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: muted ? 0.55 : 1,
    },
    flex: {flex: 1},
  });

  return (
    <Card padding="xs">
      <Stack direction="row" align="center" gap="sm">
        <AnimatedPressable
          style={styles.flex}
          accessibilityRole="button"
          accessibilityLabel={[reminder.label, statusText, reminder.repeatSummary].join('. ')}
          onPress={onOpen}>
          <Stack direction="row" align="center" gap="sm">
            <View style={styles.thumb}>
              {status.kind === 'mediaMissing' ? (
                // The cached WebP outlives the asset it depicts, so without
                // this a reminder whose video is gone still showed a
                // perfectly healthy picture of it.
                <Icon name="mediaMissing" color={theme.color.error} />
              ) : thumbnail ? (
                <Image source={thumbnail} style={StyleSheet.absoluteFill} resizeMode="cover"
                  accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
              ) : (
                <Icon name={MEDIA_ICON[reminder.mediaKind]} color={theme.color.onSurfaceVariant} />
              )}
            </View>
            <Stack style={styles.flex} gap={2}>
              <Text variant="titleMedium" numberOfLines={2} tone={muted ? 'variant' : 'default'}>
                {reminder.label}
              </Text>
              <Text variant="bodyMedium" tone={STATUS_TONE[status.kind]} numberOfLines={1}>
                {statusText}
              </Text>
              <Stack direction="row" align="center" gap="xxs">
                <Text variant="bodyMedium" tone="variant" numberOfLines={1} style={styles.flex}>
                  {reminder.repeatSummary}
                </Text>
                {reminder.action ? (
                  <Icon name={ACTION_TARGET_ICON[actionTargetOf(reminder.action.uri)]} size="xs"
                    color={theme.color.onSurfaceVariant} />
                ) : null}
              </Stack>
            </Stack>
          </Stack>
        </AnimatedPressable>
        {status.kind === 'done' || status.kind === 'mediaMissing' ? null : (
          <Toggle
            value={reminder.enabledIntent}
            onValueChange={onToggle}
            label={t('reminders.list.enableToggle', {label: reminder.label})}
          />
        )}
      </Stack>
    </Card>
  );
}

export const describeStatus = (
  status: ReminderStatus,
  now: Date,
  use24Hour: boolean | null,
  t: ReturnType<typeof useTranslation>,
): string => {
  switch (status.kind) {
    case 'mediaMissing':
      return t('reminders.status.mediaMissing');
    case 'paused':
      return t('reminders.status.paused');
    case 'done':
      return t('reminders.status.done');
    case 'unscheduled':
      return t('reminders.status.unscheduled');
    case 'next': {
      const time = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        ...(use24Hour === null ? {} : {hour12: !use24Hour}),
      }).format(status.at);
      switch (relativeDayOf(status.at, now)) {
        case 'today':
          return t('today.nextReminder.todayAt', {time});
        case 'tomorrow':
          return t('today.nextReminder.tomorrowAt', {time});
        case 'thisWeek':
          return t('today.nextReminder.weekdayAt', {
            weekday: new Intl.DateTimeFormat(undefined, {weekday: 'long'}).format(status.at),
            time,
          });
        case 'later':
          return t('reminders.status.dateAt', {
            date: new Intl.DateTimeFormat(undefined, {day: 'numeric', month: 'short'}).format(status.at),
            time,
          });
      }
    }
  }
};
