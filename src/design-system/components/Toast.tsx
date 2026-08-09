/**
 * Top-of-screen notification toast.
 *
 * Uses the `inverseSurface`/`inverseOnSurface` roles — MR-04's own doc
 * on those roles calls out "Snackbars and inverted callouts" as their
 * purpose, so this is the first thing in the design system to actually use
 * them. Tone is carried by an icon plus text, never color alone (MR-13
 * ACC-004, the same rule `StatusPill` already follows), so a colorblind
 * user can tell a success toast from an error one.
 *
 * Purely presentational: a screen doesn't render this directly, it calls
 * `useToast()` (`app/toast/ToastProvider`) — this component is mounted once
 * at the app root by that provider, and its own animation is reduced-motion-
 * safe the same way every other motion in this app is (`tokens/motion.ts`'s
 * contract): under `reduceMotion` it just appears/disappears, no slide.
 */
import Animated, {SlideInDown, SlideOutUp} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Icon, type IconName} from '../icons';
import {Text} from './Text';
import {useTheme} from '../theme/useTheme';
import {spacing} from '../tokens';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastProps {
  readonly message: string;
  readonly tone?: ToastTone;
  readonly testID?: string;
}

const ICON_FOR: Record<ToastTone, IconName> = {
  success: 'check',
  error: 'alert',
  info: 'info',
};

export function Toast({message, tone = 'info', testID}: ToastProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const card = (
    <Icon key="icon" name={ICON_FOR[tone]} size="sm" color={theme.color.inverseOnSurface} />
  );

  return (
    <Animated.View
      testID={testID}
      entering={theme.a11y.reduceMotion ? undefined : SlideInDown.springify().damping(18)}
      exiting={theme.a11y.reduceMotion ? undefined : SlideOutUp.duration(150)}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top: insets.top + spacing.xs,
        left: spacing.md,
        right: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        backgroundColor: theme.color.inverseSurface,
        borderRadius: theme.radius.card,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        elevation: theme.elevation.level3,
      }}>
      {card}
      <Text
        variant="bodyMedium"
        style={{flex: 1, color: theme.color.inverseOnSurface}}
        numberOfLines={2}>
        {message}
      </Text>
    </Animated.View>
  );
}
