/**
 * Switch.
 *
 * Named `Toggle` to avoid shadowing React Native's `Switch` at import sites.
 *
 * MR-13 ACC-004: state is not conveyed by color alone — the accessible state
 * carries `checked`, and callers pair it with a visible label. The `label`
 * prop is required so a bare switch with no name cannot be constructed.
 */
import {Switch as RNSwitch, View} from 'react-native';

import {useTheme} from '../theme/useTheme';

export interface ToggleProps {
  readonly value: boolean;
  readonly onValueChange: (next: boolean) => void;
  /** Required accessible name, e.g. "Enable Morning remembrance". */
  readonly label: string;
  readonly disabled?: boolean;
  /** Explains a disabled control to assistive tech. */
  readonly hint?: string;
  readonly testID?: string;
}

export function Toggle({
  value,
  onValueChange,
  label,
  disabled = false,
  hint,
  testID,
}: ToggleProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        // ACC-002: the platform switch is smaller than 48 dp on its own.
        minWidth: theme.layout.minTouchTarget,
        minHeight: theme.layout.minTouchTarget,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{checked: value, disabled}}
        accessibilityHint={hint}
        testID={testID}
        trackColor={{
          false: theme.color.surfaceContainerHigh,
          true: theme.color.primaryContainer,
        }}
        thumbColor={value ? theme.color.primary : theme.color.outline}
        ios_backgroundColor={theme.color.surfaceContainerHigh}
      />
    </View>
  );
}
