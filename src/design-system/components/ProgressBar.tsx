/**
 * Determinate / indeterminate progress.
 *
 * MR-03: "Import progress is determinate when byte length is known and
 * otherwise uses a labeled indeterminate indicator."
 * MR-13: progress "announces phase changes and meaningful percentage
 * thresholds, not every byte" — hence the `announcement` prop, which callers
 * update only at phase boundaries, and the coarse `accessibilityValue`.
 */
import {View} from 'react-native';

import {Text} from './Text';
import {useTheme} from '../theme/useTheme';


export interface ProgressBarProps {
  /** 0..1. Omit for an indeterminate indicator. */
  readonly progress?: number;
  /** Required label: the current phase, e.g. "Copying". */
  readonly label: string;
  /** Live-region text announced on phase change only. */
  readonly announcement?: string;
  readonly testID?: string;
}

export function ProgressBar({progress, label, announcement, testID}: ProgressBarProps) {
  const theme = useTheme();
  const isDeterminate = progress !== undefined;
  const clamped = isDeterminate ? Math.max(0, Math.min(1, progress)) : 0;
  const percent = Math.round(clamped * 100);

  return (
    <View style={{gap: theme.spacing.xxs}} testID={testID}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
        <Text variant="labelMedium" tone="variant">
          {label}
        </Text>
        {isDeterminate ? (
          <Text variant="labelMedium" tone="variant" tabularNumbers>
            {`${percent}%`}
          </Text>
        ) : null}
      </View>

      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        // Coarse value: TalkBack reads a percentage, not a byte count.
        accessibilityValue={
          isDeterminate ? {min: 0, max: 100, now: percent} : {text: label}
        }
        style={{
          height: 4,
          borderRadius: theme.radius.full,
          backgroundColor: theme.color.surfaceContainerHigh,
          overflow: 'hidden',
        }}>
        <View
          style={{
            height: '100%',
            // Indeterminate renders a static partial track rather than a
            // looping animation: MR-04 forbids looping decorative motion, and
            // MR-13 ACC-006 requires reduced motion to remove it anyway.
            width: isDeterminate ? `${percent}%` : '35%',
            backgroundColor: theme.color.primary,
            borderRadius: theme.radius.full,
          }}
        />
      </View>

      {announcement ? (
        <Text
          variant="bodyMedium"
          tone="variant"
          // Live region: announced when the phase text changes.
          accessibilityLabel={announcement}>
          {announcement}
        </Text>
      ) : null}
    </View>
  );
}
