/**
 * Reminders screen (MR-03 "Reminders" destination).
 *
 * Lists reminders with enable state and next occurrence. `ListRow` already
 * implements the MR-13 "switch never nested in a clickable row" pattern this
 * screen needs. The list itself is virtualized (`VirtualizedList`) rather
 * than mapped, since MR-09 anticipates up to 10,000 reminders.
 *
 * `mediaKind`/`thumbnailToken` on `ReminderSummary` only became real
 * recently — `ReminderDtoWriter.kt` used to hardcode `"video"` and never
 * join `media_assets` at all (see docs/decision-log.md DL-057), so this row
 * previously had no way to show a real thumbnail or the correct kind icon.
 */
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback} from 'react';
import {Image, StyleSheet, View} from 'react-native';

import {useSetReminderEnabled} from './useSetReminderEnabled';
import type {RootStackParamList} from '../../app/navigation/types';
import {testIds} from '../../constants';
import {rootRoutes} from '../../constants/routes';
import {
  AppBar,
  EmptyState,
  ErrorState,
  Icon,
  ListRow,
  LoadingState,
  Screen,
  Toggle,
  VirtualizedList,
} from '../../design-system';
import type {IconName} from '../../design-system';
import {useTheme} from '../../design-system/theme/useTheme';
import {useReminderList} from '../../hooks';
import {useTranslation} from '../../localization';
import {thumbnailImageSource} from '../../native-client/mediaTokens';
import type {MediaKind, ReminderSummary} from '../../native-client/types';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const MEDIA_ICON: Record<MediaKind, IconName> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
};

export function RemindersScreen() {
  const t = useTranslation();
  const theme = useTheme();
  const navigation = useNavigation<Navigation>();
  const reminders = useReminderList();
  const setEnabled = useSetReminderEnabled();

  const avatarStyle = StyleSheet.create({
    box: {
      width: theme.layout.listRowMinHeight - theme.spacing.sm,
      height: theme.layout.listRowMinHeight - theme.spacing.sm,
      borderRadius: theme.radius.card,
      backgroundColor: theme.color.surfaceContainerHigh,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
  });

  const renderReminder = useCallback(
    ({item}: {item: ReminderSummary}) => {
      const thumbnail = thumbnailImageSource(item.thumbnailToken);
      return (
        <ListRow
          title={item.label}
          subtitle={item.repeatSummary}
          onPress={() => navigation.navigate(rootRoutes.reminderDetail, {reminderId: item.id})}
          leading={
            <View style={avatarStyle.box}>
              {thumbnail ? (
                <Image
                  source={thumbnail}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
              ) : (
                <Icon name={MEDIA_ICON[item.mediaKind]} size="md" color={theme.color.onSurfaceVariant} />
              )}
            </View>
          }
          trailing={
            <Toggle
              value={item.enabledIntent}
              onValueChange={enabled => setEnabled.mutate({id: item.id, enabled})}
              label={t('reminders.list.enableToggle', {label: item.label})}
            />
          }
        />
      );
    },
    [avatarStyle, navigation, setEnabled, t, theme.color.onSurfaceVariant],
  );

  return (
    <Screen
      hasAppBar
      edgeToEdge={reminders.isSuccess && reminders.data.items.length > 0}
      testID={testIds.reminders.screen}>
      <AppBar title={t('reminders.title')} />

      {/* `isPending`, not `isLoading` — see TodayScreen for why. */}
      {reminders.isPending ? (
        <LoadingState label={t('loading.startingUp')} />
      ) : reminders.isError ? (
        <ErrorState
          title={t('error.unexpected.title')}
          effect={t('error.unexpected.effect')}
          recoveryAction={{label: t('action.retry'), onPress: () => reminders.refetch()}}
          diagnosticCode={reminders.error.correlationId}
        />
      ) : reminders.data.items.length === 0 ? (
        <EmptyState
          icon="reminders"
          title={t('today.empty.title')}
          body={t('today.empty.body')}
        />
      ) : (
        <VirtualizedList
          testID={testIds.reminders.list}
          data={reminders.data.items}
          keyExtractor={item => item.id}
          renderItem={renderReminder}
        />
      )}
    </Screen>
  );
}
