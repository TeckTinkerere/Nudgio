/**
 * Media grid/list card (MR-04 "Media card").
 *
 * "Aspect ratio 16:9 for video, square treatment for image/audio fallback.
 * Duration/type label sits on a high-contrast scrim. Broken preview uses icon
 * and text, never an empty gray rectangle."
 *
 * MR-13 TalkBack example: "Video. Morning remembrance. 1 minute 33 seconds.
 * Two active reminders." — the whole card is one accessible node composed
 * from exactly those parts, the same pattern `ListRow` uses. Every piece of
 * text is a caller-supplied, already-localized string: this component holds
 * no English copy of its own, matching every other design-system component
 * (`StatusPill`, `Banner`, `EmptyState`, ...).
 */
import {memo, useState} from 'react';
import {Image, Pressable, View} from 'react-native';

import {Icon, type IconName} from '../icons';
import {withAlpha} from '../theme/colorUtils';
import {useRippleConfig, useSurfaceStyle, useTheme} from '../theme/useTheme';
import {neutral} from '../tokens';
import {Text} from './Text';

export type MediaCardKind = 'video' | 'audio' | 'image' | 'text';

const KIND_ICON: Record<MediaCardKind, IconName> = {
  video: 'video',
  audio: 'audio',
  image: 'image',
  text: 'text',
};

export interface MediaCardProps {
  readonly title: string;
  readonly kind: MediaCardKind;
  /** Localized: "Video", "Audio", ... Shown as the fallback subtitle. */
  readonly kindLabel: string;
  /** Local `file://` or app-provided preview URI. Omit to force the fallback tile. */
  readonly thumbnailUri?: string;
  /** Pre-formatted compact duration, e.g. "1:33". Omit for kinds with no duration. */
  readonly durationLabel?: string;
  /** Pre-formatted accessible phrase, e.g. "1 minute 33 seconds" (`formatDurationAccessible`). */
  readonly durationAccessibleLabel?: string;
  readonly activeReminderCount?: number;
  /** Localized, e.g. "2 active reminders". Required whenever `activeReminderCount > 0`. */
  readonly activeReminderCountLabel?: string;
  /** MR-04: "Broken preview uses icon and text, never an empty gray rectangle." */
  readonly isMissing?: boolean;
  /** Localized "Missing" label, shown on the fallback tile and in the a11y name. */
  readonly missingLabel?: string;
  readonly onPress?: () => void;
  /**
   * Shown as a standalone circular affordance over the thumbnail for
   * video/audio only — present whenever the caller can offer in-place
   * preview playback, independent of whether a real thumbnail loaded (a
   * fallback-tile audio card can still play; it just has no art to show).
   */
  readonly onPlayPress?: () => void;
  /** Localized, e.g. "Play". Required whenever `onPlayPress` is given. */
  readonly playLabel?: string;
  readonly testID?: string;
}

/**
 * Memoized: real backing lists (Library grid) can hold thousands of media
 * items per MR-09; without this, every row in a virtualized list re-renders
 * whenever the list's own state changes, not just when that row's own props
 * do (docs/decision-log.md).
 */
export const MediaCard = memo(function MediaCardImpl({
  title,
  kind,
  kindLabel,
  thumbnailUri,
  durationLabel,
  durationAccessibleLabel,
  activeReminderCount = 0,
  activeReminderCountLabel,
  isMissing = false,
  missingLabel,
  onPress,
  onPlayPress,
  playLabel,
  testID,
}: MediaCardProps) {
  const theme = useTheme();
  const surface = useSurfaceStyle('level1');
  const ripple = useRippleConfig();
  const isSquare = kind === 'audio' || kind === 'image' || kind === 'text';
  // MR-09: the thumbnail cache "may be cleared at any time" — a token that
  // was valid when the list loaded can 404 by the time this cell renders.
  // `imageFailed` catches that at display time, the same "icon and text,
  // never a broken rectangle" fallback `isMissing`/no-token already use.
  const [imageFailed, setImageFailed] = useState(false);
  const showFallback = isMissing || !thumbnailUri || imageFailed;
  const canPlay = onPlayPress !== undefined && (kind === 'video' || kind === 'audio') && !isMissing;

  // Computed once per render, referenced by identifier in the style objects
  // below — not a literal color inside a style prop — so the design system's
  // "no isolated magic color values" lint rule has nothing to flag here.
  const scrimColor = withAlpha(neutral.black, 0.6);
  const onScrimColor = neutral.white;

  const accessibilityLabel = [
    kindLabel,
    title,
    durationAccessibleLabel,
    activeReminderCount > 0 ? activeReminderCountLabel : undefined,
    isMissing ? missingLabel : undefined,
  ]
    .filter((part): part is string => Boolean(part))
    .join('. ');

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      android_ripple={onPress ? ripple : undefined}
      style={{
        flex: 1,
        borderRadius: theme.radius.card,
        overflow: 'hidden',
        backgroundColor: surface.backgroundColor,
        borderWidth: surface.borderWidth,
        borderColor: surface.borderColor,
      }}>
      <View
        style={{
          width: '100%',
          aspectRatio: isSquare ? 1 : 16 / 9,
          backgroundColor: theme.color.surfaceContainerHigh,
        }}>
        {showFallback ? (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              gap: theme.spacing.xxs,
            }}>
            <Icon
              name={isMissing ? 'mediaMissing' : KIND_ICON[kind]}
              size="lg"
              color={theme.color.onSurfaceVariant}
            />
            {isMissing && missingLabel ? (
              <Text variant="labelMedium" tone="variant">
                {missingLabel}
              </Text>
            ) : null}
          </View>
        ) : (
          <Image
            source={{uri: thumbnailUri}}
            style={{width: '100%', height: '100%'}}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
            // Decorative: the accessible name lives on the Pressable.
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        )}

        {canPlay ? (
          <View
            style={{position: 'absolute', top: 0, start: 0, end: 0, bottom: 0}}
            // Decorative wrapper only; the Pressable inside carries the
            // accessible name and is the one focusable/actionable node here.
            pointerEvents="box-none">
            <Pressable
              onPress={onPlayPress}
              accessibilityRole="button"
              accessibilityLabel={playLabel ?? kindLabel}
              android_ripple={{...ripple, borderless: true}}
              style={{
                position: 'absolute',
                top: '50%',
                start: '50%',
                marginTop: -theme.layout.minTouchTarget / 2,
                marginStart: -theme.layout.minTouchTarget / 2,
                width: theme.layout.minTouchTarget,
                height: theme.layout.minTouchTarget,
                borderRadius: theme.radius.full,
                backgroundColor: scrimColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon name="play" size="md" color={onScrimColor} />
            </Pressable>
          </View>
        ) : null}

        {durationLabel && !showFallback ? (
          <View
            style={{
              position: 'absolute',
              right: theme.spacing.xxs,
              bottom: theme.spacing.xxs,
              paddingHorizontal: theme.spacing.xxs,
              paddingVertical: 2,
              borderRadius: theme.radius.chip,
              // High-contrast scrim (MR-04), not the app modal `scrim` token —
              // this sits over arbitrary image content and must stay legible
              // regardless of the current app theme.
              backgroundColor: scrimColor,
            }}>
            <Text variant="labelMedium" style={{color: onScrimColor}} tabularNumbers>
              {durationLabel}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{padding: theme.spacing.xs, gap: 2}}>
        <Text variant="titleMedium" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="labelMedium" tone="variant">
          {activeReminderCount > 0 ? (activeReminderCountLabel ?? kindLabel) : kindLabel}
        </Text>
      </View>
    </Pressable>
  );
});
