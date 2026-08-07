/**
 * List row with an optional independent trailing control.
 *
 * MR-04 "Reminder card": "Tapping body opens details; switch changes enable
 * state but never propagates tap to the card."
 * MR-13: "The switch must not be nested ambiguously in a fully clickable row."
 *
 * The row therefore renders the body and the trailing control as *siblings*,
 * each with its own accessibility node, rather than nesting a control inside a
 * pressable parent. That is the only structure TalkBack can express as
 * "open" and "toggle" being two distinct actions.
 */
import {memo} from 'react';
import {Pressable, View} from 'react-native';

import {Text} from './Text';
import {useRippleConfig, useTheme} from '../theme/useTheme';


export interface ListRowProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Third line, e.g. a repeat summary or next occurrence. */
  readonly meta?: string;
  readonly leading?: React.ReactNode;
  /** Independent control (switch, icon button). Not wrapped by the press area. */
  readonly trailing?: React.ReactNode;
  readonly onPress?: () => void;
  /**
   * Full announcement for the body node. MR-13 gives the pattern:
   * "Morning remembrance. Daily at 6:15 AM. Standard alert. Enabled. Next tomorrow."
   * Falls back to composing the visible strings.
   */
  readonly accessibilityLabel?: string;
  readonly disabled?: boolean;
  readonly testID?: string;
}

/**
 * Memoized: real backing lists (Reminders, up to MR-09's 10,000-row
 * anticipated scale) can hold far more rows than fit on screen; without
 * this, every row in a virtualized list re-renders whenever the list's own
 * state changes, not just when that row's own props do (docs/decision-log.md).
 */
export const ListRow = memo(function ListRowImpl({
  title,
  subtitle,
  meta,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  disabled = false,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const ripple = useRippleConfig();

  const label =
    accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join('. ');

  const body = (
    <View style={{flex: 1, gap: 2}}>
      <Text variant="titleMedium" tone={disabled ? 'disabled' : 'default'}>
        {title}
      </Text>
      {subtitle ? (
        <Text variant="bodyMedium" tone="variant">
          {subtitle}
        </Text>
      ) : null}
      {meta ? (
        <Text variant="labelMedium" tone="variant">
          {meta}
        </Text>
      ) : null}
    </View>
  );

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        // MR-04: minimum 64 dp, "expanding with font scale" — hence minHeight.
        minHeight: theme.layout.listRowMinHeight,
        paddingVertical: theme.spacing.sm,
      }}>
      {leading}

      {onPress ? (
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{disabled}}
          android_ripple={disabled ? undefined : ripple}
          style={{
            flex: 1,
            justifyContent: 'center',
            minHeight: theme.layout.minTouchTarget,
          }}>
          {body}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label} style={{flex: 1}}>
          {body}
        </View>
      )}

      {/* Sibling, not child: its own focus stop and its own action. */}
      {trailing}
    </View>
  );
});
