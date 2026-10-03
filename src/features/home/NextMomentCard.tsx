/**
 * The next moment, shown the way the product actually works: the user's own
 * media first, large, then when it returns and what it will say.
 *
 * This replaces the old "Next reminder" row, which put the media in a 40 dp
 * circle and then stacked four equal-weight controls (Preview / Edit / More /
 * Pause) under it. For an app whose whole premise is "your media comes back
 * to you", a thumbnail the size of an avatar and a toolbar of same-sized
 * buttons buried the one thing that matters. Here the media *is* the card,
 * Preview is the single affordance on it, and everything else moves to the
 * detail screen a tap away.
 */
import {Pressable, StyleSheet, View} from 'react-native';

import {Icon, Stack, Text, useResponsive, useSurfaceStyle, useTheme} from '../../design-system';
import {withAlpha} from '../../design-system/theme/colorUtils';
import {neutral} from '../../design-system/tokens';
import {useTranslation} from '../../localization';
import type {ReminderSummary} from '../../native-client/types';
import {MediaHero} from '../reminders/MediaHero';
import {actionTargetOf, ACTION_TARGET_ICON} from '../reminders/reminderActions';

/**
 * The stage scales with the window instead of sitting at a fixed 208 dp. On
 * a 320x568 phone that fixed height was 37% of the viewport, so the card's
 * own title was pushed under the floating FAB and the list below it started
 * off-screen; on a tablet it looked undersized. Clamped at both ends so it
 * stays a hero on a small screen and never swallows a large one.
 */
const HERO_MIN = 140;
const HERO_MAX = 240;
const HERO_FRACTION = 0.26;

/**
 * Above this width, a landscape window lays the card out side by side —
 * media left, words right — the same rule and the same threshold
 * `ReminderMoment` already uses. Stacked, a 700 dp-wide window with ~360 dp
 * of height gave the media a 5:1 letterbox slit: a portrait photo became a
 * narrow strip between two wide bands of its own blurred backdrop.
 */
const SIDE_BY_SIDE_MIN_WIDTH = 600;
/** Share of the card the media takes when side by side. */
const SIDE_BY_SIDE_MEDIA = 0.45;

export interface NextMomentCardProps {
  readonly reminder: ReminderSummary;
  /** Already formatted, e.g. "Tomorrow at 7:00 AM". */
  readonly whenLabel: string;
  readonly onOpen: () => void;
  readonly onPreview: () => void;
  readonly testID?: string;
}

export function NextMomentCard({reminder, whenLabel, onOpen, onPreview, testID}: NextMomentCardProps) {
  const t = useTranslation();
  const theme = useTheme();
  const {usableHeight, width, isLandscape} = useResponsive();
  const sideBySide = isLandscape && width >= SIDE_BY_SIDE_MIN_WIDTH;
  // Side by side the media is bounded by the card's own height rather than a
  // share of the window, so it fills its column instead of slicing it.
  const heroHeight = Math.round(
    sideBySide
      ? Math.max(HERO_MIN, Math.min(HERO_MAX, usableHeight * 0.55))
      : Math.min(HERO_MAX, Math.max(HERO_MIN, usableHeight * HERO_FRACTION)),
  );
  // The same surface `Card` gives the reminder rows below, so the hero and
  // the list it heads read as one material rather than two.
  const surface = useSurfaceStyle();
  const message = reminder.notes?.trim();

  const styles = StyleSheet.create({
    card: {
      borderRadius: theme.radius.card,
      backgroundColor: surface.backgroundColor,
      borderWidth: surface.borderWidth,
      borderColor: surface.borderColor,
      overflow: 'hidden',
    },
    row: {flexDirection: sideBySide ? 'row' : 'column'},
    media: sideBySide ? {width: `${Math.round(SIDE_BY_SIDE_MEDIA * 100)}%`} : {},
    body: {flex: sideBySide ? 1 : undefined, padding: theme.spacing.md, gap: theme.spacing.xxs, justifyContent: 'center'},
    // Anchored to the hero's bottom edge by offset rather than `bottom`,
    // which would place it over the text below the media.
    preview: {
      position: 'absolute',
      ...(sideBySide
        ? {left: theme.spacing.sm}
        : {right: theme.spacing.sm}),
      top: heroHeight - 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.xxs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      borderRadius: theme.radius.full,
      backgroundColor: withAlpha(neutral.black, 0.6),
    },
    onScrim: {color: neutral.white},
  });

  return (
    <View style={styles.card} testID={testID}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={[whenLabel, reminder.label, message].filter(Boolean).join('. ')}>
        <View style={styles.row}>
        <View style={styles.media}>
          <MediaHero
            thumbnailToken={reminder.thumbnailToken}
            kind={reminder.mediaKind}
            height={heroHeight}
            roundTopOnly={!sideBySide}
          />
        </View>
        <View style={styles.body}>
          <Text variant="labelLarge" tone="primary">
            {whenLabel}
          </Text>
          <Text variant="titleLarge" numberOfLines={2}>
            {reminder.label}
          </Text>
          {message ? (
            <Text variant="bodyMedium" tone="variant" numberOfLines={3}>
              {message}
            </Text>
          ) : null}
          {reminder.action ? (
            <Stack direction="row" align="center" gap="xxs" paddingVertical="xxs">
              <Icon
                name={ACTION_TARGET_ICON[actionTargetOf(reminder.action.uri)]}
                size="xs"
                color={theme.color.onSurfaceVariant}
              />
              <Text variant="labelMedium" tone="variant" numberOfLines={1}>
                {reminder.action.label ?? t('home.next.opensAfter')}
              </Text>
            </Stack>
          ) : null}
        </View>
        </View>
      </Pressable>

      {/* Sibling of the card body, never nested inside it: a button inside a
          pressable row swallows its own taps on some Android builds. */}
      <Pressable
        onPress={onPreview}
        accessibilityRole="button"
        accessibilityLabel={t('home.next.previewFor', {label: reminder.label})}
        style={({pressed}) => [styles.preview, {opacity: pressed ? 0.8 : 1}]}>
        <Icon name="play" size="xs" color={neutral.white} />
        <Text variant="labelMedium" style={styles.onScrim}>
          {t('home.next.preview')}
        </Text>
      </Pressable>
    </View>
  );
}
