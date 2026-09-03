/**
 * MR-06 "Adaptive presentation decision" rule 4: the in-app strip shown
 * while the device is unlocked and the app is foreground. MR-03: "Swiping
 * upward collapses it to a status chip." The system notification is always
 * posted first (native side) — this is a supplementary, dismissable
 * surface, never the only way to see or act on a due reminder, which is why
 * it never demands a modal/blocking interaction.
 *
 * "Never interrupt aggressively": the card auto-collapses to the compact
 * chip after a bounded delay if the user does not act on or dismiss it,
 * rather than staying planted over the current screen indefinitely. That
 * countdown is *drawn* — the hairline along the bottom edge empties as the
 * delay runs out — because a surface that vanishes on its own with no
 * warning reads as a bug the first time you see it happen.
 *
 * The strip has one job and three exits, so it is laid out as: what is
 * happening (accent status line, with the occurrence's own time), which
 * reminder, and the three actions at full 48 dp targets. It is height-capped
 * by MR-04/MR-03 at `min(144dp, 20% of viewport)`, and the media title is
 * the one row allowed to shrink into that cap (`flexShrink`) — clipping a
 * secondary line beats clipping a button.
 */
import {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  View,
  useWindowDimensions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {useSessionStore, type InAppDueBanner} from '../core/state/sessionStore';
import {Button} from '../design-system/components/Button';
import {Text} from '../design-system/components/Text';
import {Icon} from '../design-system/icons';
import {useSurfaceStyle, useTheme} from '../design-system/theme/useTheme';
import {inAppStripMaxHeight} from '../design-system/tokens';
import {useHaptics, useMotionDuration, usePreferences} from '../hooks';
import {formatLocalTime, useTranslation} from '../localization';
import {useAppContainer} from './di/useAppContainer';

// MR-04 motion tokens are cubic-bezier control points, not RN `Easing`
// functions — this is the one place that gap is bridged, deliberately kept
// out of `design-system/tokens` (pure data, no RN dependency).
const EASING_EMPHASIZED_DECELERATE = Easing.bezier(0.05, 0.7, 0.1, 1.0);
const EASING_STANDARD = Easing.bezier(0.2, 0.0, 0.0, 1.0);

const AUTO_COLLAPSE_MS = 15_000;
const SWIPE_UP_COLLAPSE_THRESHOLD = 24;

/** Thickness of the auto-collapse countdown hairline. */
const COUNTDOWN_HEIGHT = 3;

const overlayStyle: ViewStyle = {position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50};
const flexOneStyle: ViewStyle = {flex: 1};
const rowStyle: ViewStyle = {flexDirection: 'row', alignItems: 'center'};
const countdownTrackStyle: ViewStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  height: COUNTDOWN_HEIGHT,
};
// Scaled from the left edge, so the bar drains toward the side the text
// starts on rather than shrinking symmetrically into nothing.
const countdownFillStyle: ViewStyle = {height: COUNTDOWN_HEIGHT, transformOrigin: 'left'};

export function InAppDueCard() {
  const theme = useTheme();
  const t = useTranslation();
  const surface = useSurfaceStyle('level3');
  const insets = useSafeAreaInsets();
  const {height: windowHeight} = useWindowDimensions();
  const container = useAppContainer();
  const haptics = useHaptics();
  const preferences = usePreferences();

  const banner = useSessionStore(state => state.inAppDueBanner);
  const collapsed = useSessionStore(state => state.inAppDueBannerCollapsed);
  const showDueBanner = useSessionStore(state => state.showDueBanner);
  const collapseDueBanner = useSessionStore(state => state.collapseDueBanner);
  const dismissDueBanner = useSessionStore(state => state.dismissDueBanner);

  // Kept mounted through the exit animation — `banner` itself may already
  // be null by the time the fade-out finishes.
  const [rendered, setRendered] = useState<InAppDueBanner | null>(banner);
  const progress = useRef(new Animated.Value(0)).current;
  const countdown = useRef(new Animated.Value(1)).current;

  const reduceMotion = theme.a11y.reduceMotion;
  const enterDuration = useMotionDuration('stripEnter');

  useEffect(() => {
    if (banner) {
      setRendered(banner);
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: enterDuration,
        easing: EASING_EMPHASIZED_DECELERATE,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: enterDuration,
        easing: EASING_STANDARD,
        useNativeDriver: true,
      }).start(({finished}) => {
        if (finished) {
          setRendered(null);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banner]);

  // "Never interrupt aggressively": collapse to the compact chip on its own
  // if the user neither acts on nor dismisses the full card. The bar below
  // runs the same clock, so the two cannot disagree.
  useEffect(() => {
    if (!banner || collapsed) {
      return undefined;
    }
    countdown.setValue(1);
    const animation = Animated.timing(countdown, {
      toValue: 0,
      duration: AUTO_COLLAPSE_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start();
    const timer = setTimeout(() => collapseDueBanner(), AUTO_COLLAPSE_MS);
    return () => {
      animation.stop();
      clearTimeout(timer);
    };
  }, [banner, collapsed, collapseDueBanner, countdown]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dy) > 6 && gesture.dy < 0,
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy < -SWIPE_UP_COLLAPSE_THRESHOLD) {
          collapseDueBanner();
        }
      },
    }),
  ).current;

  // MR-04/MR-03: `min(144dp, 20% of usable viewport)` — a cap the card sizes
  // up to, not a fixed height MR-03 explicitly forbids promising. The status
  // bar inset sits *outside* that cap: it is chrome the strip has to clear,
  // not strip content, and folding it in would silently shrink the strip on
  // exactly the tall-notch devices with the most room for it.
  const stripHeight = inAppStripMaxHeight(windowHeight);
  const maxCardHeight = insets.top + stripHeight;

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-maxCardHeight, 0],
  });

  // `stripEnter`'s reduced-motion behavior is `'fade'`, not `'instant'`
  // (design-system/tokens/motion.ts) — `enterDuration` above already picks
  // the shorter reduced duration; what changes here is dropping the
  // directional slide and cross-fading in place instead.
  const containerStyle: Animated.WithAnimatedValue<ViewStyle> = {
    opacity: progress,
    transform: reduceMotion ? [] : [{translateY}],
  };

  const cardStyle: ViewStyle = {
    maxHeight: maxCardHeight,
    backgroundColor: surface.backgroundColor,
    borderBottomWidth: surface.borderWidth,
    borderBottomColor: surface.borderColor,
    borderBottomLeftRadius: theme.radius.card,
    borderBottomRightRadius: theme.radius.card,
    paddingTop: insets.top + theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.sm,
    gap: theme.spacing.xxs,
    // The accent edge that makes this read as an alert rather than as a
    // toast, without spending a whole row on a colored header.
    borderTopWidth: 3,
    borderTopColor: theme.color.primary,
    overflow: 'hidden',
  };
  const statusDotStyle: ViewStyle = {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.primary,
    marginEnd: theme.spacing.xs,
  };
  // The one line allowed to give up its space inside the height cap.
  const mediaTitleStyle: TextStyle = {flexShrink: 1};
  const buttonRowStyle: ViewStyle = {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xs,
  };

  if (!rendered) {
    return null;
  }

  const dueTime = formatLocalTime(
    new Date(rendered.occurrence.scheduledAt),
    preferences.data?.use24HourTime ?? null,
  );

  // MR-03: "Alarm and notification actions respond immediately with haptic
  // confirmation where allowed" — fired on the tap itself, not gated on the
  // action's async result, so the confirmation is immediate regardless of
  // bridge latency.
  const runAction = (
    pattern: 'light' | 'confirm',
    action: (b: InAppDueBanner) => Promise<{ok: boolean}>,
  ) => {
    const current = rendered;
    haptics.trigger(pattern);
    dismissDueBanner();
    action(current)
      .then(result => {
        if (!result.ok) {
          container.logger.warn('inAppDueCard.actionFailed', {sessionId: current.sessionId});
        }
      })
      .catch(() => {
        container.logger.warn('inAppDueCard.actionThrew', {sessionId: current.sessionId});
      });
  };

  const handleAccept = () =>
    runAction('confirm', b => container.repositories.reminders.play(b.sessionId, b.nonce));
  const handleSnooze = () =>
    runAction('light', b =>
      container.repositories.reminders.snooze(b.sessionId, b.defaultSnoozeMinutes, b.nonce),
    );
  const handleDismiss = () =>
    runAction('light', b => container.repositories.reminders.dismiss(b.sessionId, b.nonce));

  return (
    <View pointerEvents="box-none" style={overlayStyle}>
      <Animated.View style={containerStyle} {...(collapsed ? {} : panResponder.panHandlers)}>
        {collapsed ? (
          <CollapsedChip
            banner={rendered}
            dueTime={dueTime}
            onExpand={() => showDueBanner(rendered)}
            onDismiss={() => dismissDueBanner()}
          />
        ) : (
          <View
            style={cardStyle}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={`${t('due.status')}, ${dueTime}. ${rendered.reminderLabel}. ${rendered.mediaTitle}`}
            testID="in-app-due-card">
            <View style={rowStyle}>
              <View style={statusDotStyle} />
              <Text variant="labelMedium" tone="primary">
                {t('due.status')}
              </Text>
              <View style={flexOneStyle} />
              <Text variant="labelMedium" tone="variant" tabularNumbers>
                {dueTime}
              </Text>
            </View>

            <Text variant="titleMedium" numberOfLines={1}>
              {rendered.reminderLabel}
            </Text>

            {rendered.mediaTitle.length > 0 ? (
              <View style={rowStyle}>
                <Icon name="play" size="sm" color={theme.color.onSurfaceVariant} />
                <Text
                  variant="bodyMedium"
                  tone="variant"
                  numberOfLines={1}
                  style={mediaTitleStyle}>
                  {` ${rendered.mediaTitle}`}
                </Text>
              </View>
            ) : null}

            <View style={buttonRowStyle}>
              <View style={flexOneStyle}>
                <Button label={t('due.dismiss')} variant="text" onPress={handleDismiss} fullWidth />
              </View>
              <View style={flexOneStyle}>
                <Button label={t('due.snooze')} variant="outlined" onPress={handleSnooze} fullWidth />
              </View>
              <View style={flexOneStyle}>
                <Button label={t('due.accept')} variant="filled" onPress={handleAccept} fullWidth />
              </View>
            </View>

            {/* The auto-collapse clock, drawn. Dropped under reduced motion
                (MR-13 ACC-006) rather than shown frozen, which would read as
                a progress bar that had stalled. */}
            {reduceMotion ? null : (
              <View
                pointerEvents="none"
                style={[countdownTrackStyle, {backgroundColor: theme.color.surfaceContainer}]}>
                <Animated.View
                  style={[
                    countdownFillStyle,
                    {
                      backgroundColor: theme.color.primary,
                      transform: [{scaleX: countdown}],
                    },
                  ]}
                />
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

interface CollapsedChipProps {
  readonly banner: InAppDueBanner;
  readonly dueTime: string;
  readonly onExpand: () => void;
  readonly onDismiss: () => void;
}

const chipWrapStyle: ViewStyle = {alignItems: 'center'};
const chipTextStyle: TextStyle = {maxWidth: 200};

function CollapsedChip({banner, dueTime, onExpand, onDismiss}: CollapsedChipProps) {
  const theme = useTheme();
  const t = useTranslation();
  const surface = useSurfaceStyle('level2');
  const insets = useSafeAreaInsets();

  const wrapStyle: ViewStyle = {...chipWrapStyle, paddingTop: insets.top + theme.spacing.xxs};
  const pillStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: surface.backgroundColor,
    borderWidth: surface.borderWidth,
    borderColor: surface.borderColor,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
  };
  const dotStyle: ViewStyle = {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.primary,
  };

  return (
    <View style={wrapStyle}>
      <Pressable
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel={t('due.collapsedHint', {label: banner.reminderLabel})}
        style={pillStyle}>
        {/* The accent dot carries "something is live" without the looping
            animation MR-04 forbids as an urgency signal. */}
        <View style={dotStyle} />
        <Text variant="labelLarge" numberOfLines={1} style={chipTextStyle}>
          {banner.reminderLabel}
        </Text>
        <Text variant="labelMedium" tone="variant" tabularNumbers>
          {dueTime}
        </Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('due.dismissReminder')}>
          <Icon name="close" size="sm" color={theme.color.onSurfaceVariant} />
        </Pressable>
      </Pressable>
    </View>
  );
}
