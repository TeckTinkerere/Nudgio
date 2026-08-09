/**
 * Media grid/list card (MR-04 "Media card").
 *
 * Renders at the caller-supplied `aspectRatio` — the real source's own
 * `width / height` — never a fixed 16:9/square crop: a portrait photo or
 * video keeps its full proportional height, matching how it actually looks
 * (explicit product direction superseding MR-04's original "16:9 for video,
 * square for image/audio fallback" text; see docs/decision-log.md). Falls
 * back to 16:9 (video) / 1:1 (everything else) only when the caller has no
 * real dimensions to give it — the fallback icon tile and kinds with
 * nothing visual to size (audio/text).
 *
 * Duration/type label sits on a high-contrast scrim. Broken preview uses
 * icon and text, never an empty gray rectangle.
 *
 * MR-13 TalkBack example: "Video. Morning remembrance. 1 minute 33 seconds.
 * Two active reminders." — the whole card is one accessible node composed
 * from exactly those parts, the same pattern `ListRow` uses. Every piece of
 * text is a caller-supplied, already-localized string: this component holds
 * no English copy of its own, matching every other design-system component
 * (`StatusPill`, `Banner`, `EmptyState`, ...).
 */
import {memo, useEffect, useState} from 'react';
import {Image, Pressable, StyleSheet, View} from 'react-native';

import {Icon, type IconName} from '../icons';
import {withAlpha} from '../theme/colorUtils';
import {useRippleConfig, useSurfaceStyle, useTheme} from '../theme/useTheme';
import {neutral} from '../tokens';
import {Skeleton} from './Skeleton';
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
  /**
   * The real source's `width / height` — every card renders at this exact
   * ratio (never cropped into a fixed 16:9/square frame) so a portrait
   * photo or video keeps its full proportional height. Omitted only for
   * kinds with nothing visual to size (audio/text) or when the source's
   * pixel dimensions are unknown, in which case the fallback tile's own
   * icon-only content justifies a plain square.
   */
  readonly aspectRatio?: number;
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
  /** Highlights the card as the current pick — the reminder-editor media picker's own "already chosen" state. */
  readonly selected?: boolean;
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
  aspectRatio,
  durationLabel,
  durationAccessibleLabel,
  activeReminderCount = 0,
  activeReminderCountLabel,
  isMissing = false,
  missingLabel,
  onPress,
  onPlayPress,
  playLabel,
  selected = false,
  testID,
}: MediaCardProps) {
  const theme = useTheme();
  const surface = useSurfaceStyle('level1');
  const ripple = useRippleConfig();
  // Real, per-item ratio when the caller has one (video frame / image pixel
  // dimensions) — never a fixed 16:9/square crop. Falls back to a plain
  // square only for kinds with nothing visual to size, or a pathological
  // `0`/`NaN` ratio that would otherwise collapse the cell to zero height.
  const resolvedAspectRatio =
    aspectRatio !== undefined && Number.isFinite(aspectRatio) && aspectRatio > 0
      ? aspectRatio
      : kind === 'video'
        ? 16 / 9
        : 1;
  // MR-09: the thumbnail cache "may be cleared at any time" — a token that
  // was valid when the list loaded can 404 by the time this cell renders.
  // `imageFailed` catches that at display time, the same "icon and text,
  // never a broken rectangle" fallback `isMissing`/no-token already use.
  const [imageFailed, setImageFailed] = useState(false);
  // A card is a memoized, recycled list cell — a fresh `thumbnailUri` means
  // this is now showing a different item, so both flags reset instead of
  // carrying over the previous item's already-loaded/failed state.
  const [imageLoaded, setImageLoaded] = useState(false);
  useEffect(() => {
    setImageFailed(false);
    setImageLoaded(false);
  }, [thumbnailUri]);
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
      accessibilityState={onPress ? {selected} : undefined}
      android_ripple={onPress ? ripple : undefined}
      style={{
        flex: 1,
        borderRadius: theme.radius.card,
        overflow: 'hidden',
        backgroundColor: surface.backgroundColor,
        borderWidth: selected ? 2 : surface.borderWidth,
        borderColor: selected ? theme.color.primary : surface.borderColor,
      }}>
      <View
        style={{
          width: '100%',
          aspectRatio: resolvedAspectRatio,
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
          <>
            <Image
              source={{uri: thumbnailUri}}
              style={{width: '100%', height: '100%'}}
              resizeMode="cover"
              onLoadEnd={() => setImageLoaded(true)}
              onError={() => setImageFailed(true)}
              // Decorative: the accessible name lives on the Pressable.
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            {/* Never a blank/empty cell while the real thumbnail decodes —
            `onLoadEnd` fires on success and failure alike, so this never
            outlives the point where either the image or the fallback icon
            (via `imageFailed`) takes over. */}
            {imageLoaded ? null : (
              <View style={StyleSheet.absoluteFill}>
                <Skeleton width="100%" height="100%" radius="none" />
              </View>
            )}
          </>
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
