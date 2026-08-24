/**
 * Reminders screen (MR-03 "Reminders" destination).
 *
 * Each row leads with the next occurrence's time at `titleLarge` in a tonal
 * chip, the way native alarm-clock apps make the time the primary datum of
 * an alarm row — the previous plain `ListRow` (small thumbnail, title,
 * repeat-summary subtitle) never actually showed the scheduled time as its
 * own element, which read as a generic settings list rather than an alarm
 * list. The switch stays a sibling of the pressable body, not nested inside
 * it (MR-13 "switch never nested in a clickable row") — `AnimatedPressable`
 * wraps only the time+label body, `Toggle` sits outside it, matching the
 * sibling structure `ListRow` itself uses internally.
 *
 * The list itself is virtualized (`VirtualizedList`) rather than mapped,
 * since MR-09 anticipates up to 10,000 reminders.
 *
 * `mediaKind`/`thumbnailToken` on `ReminderSummary` only became real
 * recently — `ReminderDtoWriter.kt` used to hardcode `"video"` and never
 * join `media_assets` at all (see docs/decision-log.md DL-057), so this row
 * previously had no way to show a real thumbnail or the correct kind icon.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback, useState} from 'react';
import {Image, StyleSheet, View} from 'react-native';

import {useDeleteReminder} from './useDeleteReminder';
import {useSetReminderEnabled} from './useSetReminderEnabled';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {
  AnimatedPressable,
  AppBar,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  LoadingState,
  Screen,
  Stack,
  SwipeableRow,
  Text,
  Toggle,
  useFloatingAppBar,
  VirtualizedList,
} from '../../design-system';
import type {IconName} from '../../design-system';
import {useTheme} from '../../design-system/theme/useTheme';
import {useHaptics, usePreferences, useReminderList} from '../../hooks';
import {useTranslation} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import type {MediaKind, ReminderSummary} from '../../native-client/types';
import {MediaPreviewPlayer} from '../library/MediaPreviewPlayer';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const MEDIA_ICON: Record<MediaKind, IconName> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
};

/** Only these two kinds have anything `MediaPreviewPlayer` can play — matches `LibraryScreen`'s own gate. */
const isPlayableKind = (kind: MediaKind): kind is 'video' | 'audio' =>
  kind === 'video' || kind === 'audio';

interface TimeParts {
  readonly time: string;
  readonly period: string;
}

/**
 * `use24Hour` mirrors `PreferencesSnapshot.use24HourTime`: `null` means
 * "follow the device". This row used to hardcode `hour12: true`, so a user
 * who chose 24-hour time (or whose device is on it) still saw AM/PM here
 * while every other surface in the app respected the setting. In 24-hour
 * mode there is no `dayPeriod` part to find, so `period` comes back empty
 * and the tonal time chip simply renders without its second line.
 */
const formatTimeParts = (iso: string, use24Hour: boolean | null): TimeParts => {
  const parts = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(use24Hour === null ? {} : {hour12: !use24Hour}),
  }).formatToParts(new Date(iso));
  const hour = parts.find(part => part.type === 'hour')?.value ?? '';
  const minute = parts.find(part => part.type === 'minute')?.value ?? '';
  const period = parts.find(part => part.type === 'dayPeriod')?.value ?? '';
  return {time: `${hour}:${minute}`, period};
};

export function RemindersScreen() {
  const t = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();
  const reminders = useReminderList();
  const setEnabled = useSetReminderEnabled();
  const deleteReminder = useDeleteReminder();
  const haptics = useHaptics();
  const [previewItem, setPreviewItem] = useState<ReminderSummary | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReminderSummary | null>(null);
  const appBar = useFloatingAppBar();
  const preferences = usePreferences();
  const use24Hour = preferences.data?.use24HourTime ?? null;

  const styles = StyleSheet.create({
    card: {marginBottom: theme.spacing.xs},
    timeBox: {
      minWidth: theme.layout.reminderThumbnailSize,
      height: theme.layout.reminderThumbnailSize,
      borderRadius: theme.radius.card,
      backgroundColor: theme.color.primaryContainer,
      paddingHorizontal: theme.spacing.xs,
    },
    mediaIcon: {
      width: 20,
      height: 20,
      borderRadius: theme.radius.chip,
      overflow: 'hidden',
    },
    flexFill: {flex: 1},
  });

  const renderReminder = useCallback(
    ({item}: {item: ReminderSummary}) => {
      const thumbnail = thumbnailImageSource(item.thumbnailToken);
      const timeParts = item.nextOccurrence
        ? formatTimeParts(item.nextOccurrence.scheduledAt, use24Hour)
        : null;
      const accessibleLabel = [item.label, item.repeatSummary].filter(Boolean).join('. ');
      const canPreview = isPlayableKind(item.mediaKind) && item.sourceToken !== undefined;

      return (
        <SwipeableRow
          actionLabel={t('reminders.list.deleteAction', {label: item.label})}
          actionIcon="delete"
          onAction={() => setPendingDelete(item)}>
          <Card style={styles.card} padding="xs">
            <Stack direction="row" align="center" gap="sm">
              <Stack style={styles.timeBox} align="center" justify="center">
                {timeParts ? (
                  <>
                    <Text
                      variant="titleLarge"
                      tabularNumbers
                      style={{color: theme.color.onPrimaryContainer}}>
                      {timeParts.time}
                    </Text>
                    <Text variant="labelMedium" style={{color: theme.color.onPrimaryContainer}}>
                      {timeParts.period}
                    </Text>
                  </>
                ) : (
                  <Icon name="reminders" size="md" color={theme.color.onPrimaryContainer} />
                )}
              </Stack>

              <AnimatedPressable
                style={styles.flexFill}
                accessibilityRole="button"
                accessibilityLabel={accessibleLabel}
                onPress={() => navigation.navigate(rootRoutes.reminderDetail, {reminderId: item.id})}>
                <Stack gap={2}>
                  <Text variant="titleMedium" numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Stack direction="row" align="center" gap="xxs">
                    <View style={styles.mediaIcon}>
                      {thumbnail ? (
                        <Image
                          source={thumbnail}
                          style={StyleSheet.absoluteFill}
                          resizeMode="cover"
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        />
                      ) : (
                        <Icon name={MEDIA_ICON[item.mediaKind]} size="xs" color={theme.color.onSurfaceVariant} />
                      )}
                    </View>
                    <Text variant="bodyMedium" tone="variant" numberOfLines={1} style={styles.flexFill}>
                      {item.repeatSummary}
                    </Text>
                  </Stack>
                </Stack>
              </AnimatedPressable>

              {canPreview ? (
                <IconButton
                  name="play"
                  label={t('library.player.play', {title: item.label})}
                  onPress={() => setPreviewItem(item)}
                />
              ) : null}

              <Toggle
                value={item.enabledIntent}
                onValueChange={enabled => setEnabled.mutate({id: item.id, enabled})}
                label={t('reminders.list.enableToggle', {label: item.label})}
              />
            </Stack>
          </Card>
        </SwipeableRow>
      );
    },
    [navigation, setEnabled, styles, t, theme.color.onPrimaryContainer, theme.color.onSurfaceVariant, use24Hour],
  );

  return (
    <Screen
      hasAppBar
      edgeToEdge={reminders.isSuccess && reminders.data.items.length > 0}
      testID={testIds.reminders.screen}
      appBarSlot={
        <AppBar
          title={t('reminders.title')}
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
        />
      }>
      {/* `isPending`, not `isLoading` — see TodayScreen for why. */}
      {reminders.isPending ? (
        <View style={{flex: 1, paddingTop: appBar.barHeight}}>
          <LoadingState label={t('loading.startingUp')} />
        </View>
      ) : reminders.isError ? (
        <View style={{flex: 1, paddingTop: appBar.barHeight}}>
          <ErrorState
            title={t('error.unexpected.title')}
            effect={t('error.unexpected.effect')}
            recoveryAction={{label: t('action.retry'), onPress: () => reminders.refetch()}}
            diagnosticCode={reminders.error.correlationId}
          />
        </View>
      ) : reminders.data.items.length === 0 ? (
        <View style={{flex: 1, paddingTop: appBar.barHeight}}>
          <EmptyState
            icon="reminders"
            title={t('today.empty.title')}
            body={t('today.empty.body')}
          />
        </View>
      ) : (
        <VirtualizedList
          testID={testIds.reminders.list}
          data={reminders.data.items}
          keyExtractor={item => item.id}
          renderItem={renderReminder}
          ListHeaderComponent={<View style={{height: appBar.barHeight}} />}
          onScroll={appBar.onScroll}
          scrollEventThrottle={16}
        />
      )}

      {previewItem && isPlayableKind(previewItem.mediaKind) && previewItem.sourceToken ? (
        <MediaPreviewPlayer
          visible
          onDismiss={() => setPreviewItem(null)}
          title={previewItem.label}
          sourceToken={previewItem.sourceToken}
          kind={previewItem.mediaKind}
          closeLabel={t('library.player.close')}
          loadErrorLabel={t('library.player.loadError')}
        />
      ) : null}

      <Dialog
        visible={pendingDelete !== null}
        title={t('reminders.detail.deleteConfirmTitle')}
        body={t('reminders.detail.deleteConfirmBody')}
        destructive
        cancel={{label: t('action.cancel'), onPress: () => setPendingDelete(null)}}
        confirm={{
          label: t('action.delete'),
          onPress: () => {
            if (!pendingDelete) {
              return;
            }
            haptics.trigger('warning');
            const id = pendingDelete.id;
            setPendingDelete(null);
            deleteReminder.mutate(id);
          },
        }}
      />
    </Screen>
  );
}
