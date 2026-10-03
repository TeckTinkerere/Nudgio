/**
 * One item in a gallery grid: a square thumbnail, the way phone galleries
 * and albums show media. The picture is the content, so text only appears
 * where there is no picture (audio without artwork, text notes) — inside
 * the tile, never as a caption row that makes every cell a different height.
 *
 * Small overlays carry what matters at a glance: a video's duration, how
 * many reminders use the item, a missing-file warning, and in selection
 * mode a check. Everything is also in the accessibility label, since the
 * overlays are visual-only.
 *
 * Always black/white overlays (like `MediaCard`'s scrim): they sit on
 * arbitrary photo content and must stay legible in any theme.
 */
import {Image, Pressable, StyleSheet, View} from 'react-native';

import {Text} from './Text';
import {Icon, type IconName} from '../icons';
import {withAlpha} from '../theme/colorUtils';
import {useTheme} from '../theme/useTheme';
import {neutral} from '../tokens';

export type MediaTileKind = 'video' | 'audio' | 'image' | 'text';

const KIND_ICON: Record<MediaTileKind, IconName> = {video: 'video', audio: 'audio', image: 'image', text: 'text'};

export interface MediaTileProps {
  readonly title: string;
  readonly kind: MediaTileKind;
  readonly thumbnailUri?: string;
  /** e.g. "0:08"; shown on videos and audio. */
  readonly durationLabel?: string;
  readonly activeReminderCount?: number;
  readonly isMissing?: boolean;
  readonly selectionMode?: boolean;
  readonly selected?: boolean;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  /** Complete spoken description: kind, title, duration, reminders, state. */
  readonly accessibilityLabel: string;
  readonly testID?: string;
}

export function MediaTile({
  title,
  kind,
  thumbnailUri,
  durationLabel,
  activeReminderCount = 0,
  isMissing = false,
  selectionMode = false,
  selected = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  testID,
}: MediaTileProps) {
  const theme = useTheme();
  const showPicture = Boolean(thumbnailUri) && !isMissing;
  const scrim = withAlpha(neutral.black, 0.55);

  const styles = StyleSheet.create({
    tile: {
      aspectRatio: 1,
      borderRadius: theme.radius.chip,
      overflow: 'hidden',
      backgroundColor: theme.color.surfaceContainerHigh,
      borderWidth: selected ? 3 : 0,
      borderColor: theme.color.primary,
    },
    placeholder: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xs, gap: theme.spacing.xxs},
    pill: {
      position: 'absolute',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: theme.spacing.xxs,
      paddingVertical: 2,
      borderRadius: theme.radius.full,
      backgroundColor: scrim,
    },
    duration: {right: theme.spacing.xxs, bottom: theme.spacing.xxs},
    reminders: {right: theme.spacing.xxs, top: theme.spacing.xxs},
    onScrim: {color: neutral.white},
    missing: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: withAlpha(neutral.black, 0.45)},
    check: {
      position: 'absolute',
      top: theme.spacing.xxs,
      left: theme.spacing.xxs,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: selected ? theme.color.primary : withAlpha(neutral.white, 0.85),
      borderWidth: selected ? 0 : 2,
      borderColor: theme.color.outline,
    },
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={selectionMode ? {selected} : undefined}
      testID={testID}
      style={({pressed}) => [styles.tile, {opacity: pressed ? 0.85 : 1}]}>
      {showPicture ? (
        <Image source={{uri: thumbnailUri}} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      ) : (
        <View style={styles.placeholder}>
          <Icon name={isMissing ? 'mediaMissing' : KIND_ICON[kind]} color={theme.color.onSurfaceVariant} />
          <Text variant="labelMedium" tone="variant" align="center" numberOfLines={2}>
            {title}
          </Text>
        </View>
      )}

      {isMissing && showPicture ? (
        <View style={styles.missing}>
          <Icon name="mediaMissing" color={neutral.white} />
        </View>
      ) : null}

      {durationLabel && (kind === 'video' || kind === 'audio') ? (
        <View style={[styles.pill, styles.duration]}>
          {kind === 'video' ? <Icon name="play" size="xs" color={neutral.white} /> : null}
          <Text variant="labelMedium" style={styles.onScrim} tabularNumbers>
            {durationLabel}
          </Text>
        </View>
      ) : null}

      {activeReminderCount > 0 && !selectionMode ? (
        <View style={[styles.pill, styles.reminders]}>
          <Icon name="notification" size="xs" color={neutral.white} />
          <Text variant="labelMedium" style={styles.onScrim}>
            {activeReminderCount}
          </Text>
        </View>
      ) : null}

      {selectionMode ? (
        <View style={styles.check}>
          {selected ? <Icon name="check" size="xs" color={theme.color.onPrimary} /> : null}
        </View>
      ) : null}
    </Pressable>
  );
}
