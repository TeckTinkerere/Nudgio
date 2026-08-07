/**
 * Full-surface error state.
 *
 * Implements the six-part MR-03 "Error and recovery pattern" literally:
 *   1. a human title;
 *   2. one-sentence effect;
 *   3. preserved-state statement when relevant;
 *   4. primary recovery action;
 *   5. optional technical details behind "Details";
 *   6. a diagnostic code containing no file name or personal label.
 *
 * The props are named after those six items so a reviewer can check the
 * pattern is satisfied without reading the render body.
 */
import {useState} from 'react';
import {View} from 'react-native';

import {Icon} from '../icons';
import {Button} from './Button';
import {Text} from './Text';
import {useTheme} from '../theme/useTheme';

export interface ErrorStateProps {
  readonly title: string;
  readonly effect: string;
  readonly preservedState?: string;
  readonly recoveryAction?: {readonly label: string; readonly onPress: () => void};
  readonly cancelAction?: {readonly label: string; readonly onPress: () => void};
  /** Localized label for the disclosure control, e.g. "Details". */
  readonly detailsLabel?: string;
  /** Safe technical text. Never a stack trace, path or media title (MR-07). */
  readonly details?: string;
  readonly diagnosticCode?: string;
  readonly testID?: string;
}

export function ErrorState({
  title,
  effect,
  preservedState,
  recoveryAction,
  cancelAction,
  detailsLabel = 'Details',
  details,
  diagnosticCode,
  testID,
}: ErrorStateProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.xl,
      }}>
      <Icon name="alert" size="xl" color={theme.color.error} />

      <Text variant="titleLarge" align="center" isHeading>
        {title}
      </Text>
      <Text variant="bodyLarge" tone="variant" align="center">
        {effect}
      </Text>
      {preservedState ? (
        <Text variant="bodyMedium" tone="variant" align="center">
          {preservedState}
        </Text>
      ) : null}

      <View style={{flexDirection: 'row', gap: theme.spacing.xs, marginTop: theme.spacing.xs}}>
        {recoveryAction ? (
          <Button label={recoveryAction.label} onPress={recoveryAction.onPress} />
        ) : null}
        {cancelAction ? (
          <Button
            label={cancelAction.label}
            onPress={cancelAction.onPress}
            variant="text"
          />
        ) : null}
      </View>

      {details || diagnosticCode ? (
        <Button
          label={detailsLabel}
          variant="text"
          icon={expanded ? 'chevronUp' : 'chevronDown'}
          onPress={() => setExpanded(current => !current)}
        />
      ) : null}

      {expanded ? (
        <View style={{gap: theme.spacing.xxs, alignItems: 'center'}}>
          {details ? (
            <Text variant="bodyMedium" tone="variant" align="center" selectable>
              {details}
            </Text>
          ) : null}
          {diagnosticCode ? (
            <Text variant="labelMedium" tone="variant" selectable>
              {diagnosticCode}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
