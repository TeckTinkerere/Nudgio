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
        /*
         * The off track is `outlineVariant`, not a surface role. It used to
         * be `surfaceContainerHigh`, which sits a hair away from the page
         * behind it — so an *off* switch showed no track at all, just its
         * thumb floating as a lone grey circle that read as a rendering
         * fault rather than a control. (Material draws the unselected track
         * with a 2 dp outline border for exactly this reason; React Native's
         * `Switch` has no border, so the track itself has to carry the
         * definition.) The thumb then takes a surface role so it stays
         * legible against that darker track.
         */
        trackColor={{
          false: theme.color.outlineVariant,
          true: theme.color.primaryContainer,
        }}
        thumbColor={value ? theme.color.primary : theme.color.surface}
        ios_backgroundColor={theme.color.outlineVariant}
      />
    </View>
  );
}
