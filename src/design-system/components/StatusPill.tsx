/**
 * Status indicator for capability, occurrence and integrity state.
 *
 * MR-13 ACC-004: "Color is never the sole indicator." This component always
 * renders icon + text + color together and offers no way to disable the icon
 * or the label, so a color-only status cannot be built out of it.
 *
 * MR-04: "Avoid a dashboard filled with green checks" — `Ready` is available
 * in a low-emphasis form for collapsed healthy rows.
 */
import {View} from 'react-native';

import {Icon, type IconName} from '../icons';
import {useTheme} from '../theme/useTheme';
import {transparent} from '../tokens';
import {Text} from './Text';

/** Mirrors the MR-08 `CapabilityItem.status` vocabulary. */
export type StatusKind = 'ready' | 'limited' | 'actionNeeded' | 'neutral';

export interface StatusPillProps {
  readonly kind: StatusKind;
  /** Already-localized label: "Ready", "Limited", "Action needed". */
  readonly label: string;
  readonly emphasis?: 'high' | 'low';
  readonly testID?: string;
}

const ICON_FOR: Record<StatusKind, IconName> = {
  ready: 'check',
  limited: 'warning',
  actionNeeded: 'alert',
  neutral: 'info',
};

export function StatusPill({kind, label, emphasis = 'high', testID}: StatusPillProps) {
  const theme = useTheme();
  const role = theme.status[kind];

  return (
    <View
      // One node, one announcement: "Exact timing. Action needed."
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xxs,
        alignSelf: 'flex-start',
        paddingHorizontal: theme.spacing.xs,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.radius.chip,
        backgroundColor: emphasis === 'high' ? role.container : transparent,
        minHeight: 24,
      }}>
      {/*
        The icon uses `onContainer`, not `color`. The status icon is a genuine
        state indicator under ACC-004, so it must clear the 3:1 UI-component
        threshold against the container it sits on — and the MR-04 amber
        secondary measures only 2.57:1 on its own light-mode container.
        `color` stays reserved for accents drawn on the app surface.
      */}
      <Icon name={ICON_FOR[kind]} size="xs" color={role.onContainer} />
      <Text variant="labelMedium" style={{color: role.onContainer}}>
        {label}
      </Text>
    </View>
  );
}
