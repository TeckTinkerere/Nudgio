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
 * rather than staying planted over the current screen indefinitely.
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

import {useSessionStore, type InAppDueBanner} from '../core/state/sessionStore';
import {Button} from '../design-system/components/Button';
import {IconButton} from '../design-system/components/IconButton';
import {Text} from '../design-system/components/Text';
import {Icon} from '../design-system/icons';
import {useSurfaceStyle, useTheme} from '../design-system/theme/useTheme';
import {inAppStripMaxHeight} from '../design-system/tokens';
import {useHaptics, useMotionDuration} from '../hooks';
import {useTranslation} from '../localization';
import {useAppContainer} from './di/useAppContainer';

// MR-04 motion tokens are cubic-bezier control points, not RN `Easing`
// functions — this is the one place that gap is bridged, deliberately kept
// out of `design-system/tokens` (pure data, no RN dependency).
const EASING_EMPHASIZED_DECELERATE = Easing.bezier(0.05, 0.7, 0.1, 1.0);
const EASING_STANDARD = Easing.bezier(0.2, 0.0, 0.0, 1.0);

const AUTO_COLLAPSE_MS = 15_000;
const SWIPE_UP_COLLAPSE_THRESHOLD = 24;

const overlayStyle: ViewStyle = {position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50};
const flexOneStyle: ViewStyle = {flex: 1};

export function InAppDueCard() {
  const theme = useTheme();
  const t = useTranslation();
  const surface = useSurfaceStyle('level3');
  const {height: windowHeight} = useWindowDimensions();
  const container = useAppContainer();
  const haptics = useHaptics();

  const banner = useSessionStore(state => state.inAppDueBanner);
  const collapsed = useSessionStore(state => state.inAppDueBannerCollapsed);
  const showDueBanner = useSessionStore(state => state.showDueBanner);
  const collapseDueBanner = useSessionStore(state => state.collapseDueBanner);
  const dismissDueBanner = useSessionStore(state => state.dismissDueBanner);

  // Kept mounted through the exit animation — `banner` itself may already
  // be null by the time the fade-out finishes.
  const [rendered, setRendered] = useState<InAppDueBanner | null>(banner);
  const progress = useRef(new Animated.Value(0)).current;

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
  // if the user neither acts on nor dismisses the full card.
  useEffect(() => {
    if (!banner || collapsed) {
      return undefined;
    }
    const timer = setTimeout(() => collapseDueBanner(), AUTO_COLLAPSE_MS);
    return () => clearTimeout(timer);
  }, [banner, collapsed, collapseDueBanner]);

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
  // up to, not a fixed height MR-03 explicitly forbids promising.
  const maxCardHeight = inAppStripMaxHeight(windowHeight);

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
    paddingTop: theme.spacing.xl,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    justifyContent: 'space-between',
  };
  const headerRowStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  };
  const mediaTitleStyle: TextStyle = {marginTop: 2};
  const buttonRowStyle: ViewStyle = {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  };

  if (!rendered) {
    return null;
  }

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
            onExpand={() => showDueBanner(rendered)}
            onDismiss={() => dismissDueBanner()}
          />
        ) : (
          <View
            style={cardStyle}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={`${rendered.reminderLabel}. ${rendered.mediaTitle}`}
            testID="in-app-due-card">
            <View style={headerRowStyle}>
              <Icon name="play" color={theme.color.primary} />
              <View style={flexOneStyle}>
                <Text variant="titleMedium" numberOfLines={2}>
                  {rendered.reminderLabel}
                </Text>
                {rendered.mediaTitle.length > 0 ? (
                  <Text variant="bodyMedium" tone="variant" numberOfLines={1} style={mediaTitleStyle}>
                    {rendered.mediaTitle}
                  </Text>
                ) : null}
              </View>
              <IconButton
                name="chevronUp"
                label={t('due.collapse')}
                onPress={() => collapseDueBanner()}
                tone="variant"
              />
            </View>

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
          </View>
        )}
      </Animated.View>
    </View>
  );
}

interface CollapsedChipProps {
  readonly banner: InAppDueBanner;
  readonly onExpand: () => void;
  readonly onDismiss: () => void;
}

const chipWrapStyle: ViewStyle = {alignItems: 'center'};
const chipTextStyle: TextStyle = {maxWidth: 220};

function CollapsedChip({banner, onExpand, onDismiss}: CollapsedChipProps) {
  const theme = useTheme();
  const t = useTranslation();
  const surface = useSurfaceStyle('level2');

  const wrapStyle: ViewStyle = {...chipWrapStyle, paddingTop: theme.spacing.sm};
  const expandRowStyle: ViewStyle = {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  };
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

  return (
    <View style={wrapStyle}>
      <View style={pillStyle}>
        <Pressable
          onPress={onExpand}
          accessibilityRole="button"
          accessibilityLabel={`${banner.reminderLabel}, reminder due. Double tap to expand.`}
          style={expandRowStyle}>
          <Icon name="chevronDown" size="sm" />
          <Text variant="labelLarge" numberOfLines={1} style={chipTextStyle}>
            {banner.reminderLabel}
          </Text>
        </Pressable>
        <IconButton
          name="close"
          size="sm"
          tone="variant"
          label={t('due.dismiss')}
          onPress={onDismiss}
        />
      </View>
    </View>
  );
}
