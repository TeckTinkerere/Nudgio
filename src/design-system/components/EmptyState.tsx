/**
 * Empty state.
 *
 * MR-18: "Screens must implement loading, empty, error, offline/local and
 * high-font states." MR-03 fixes the copy shape: title, one supporting line,
 * one primary action and an optional secondary.
 *
 * MR-13 "Cognitive accessibility": one primary action per screen — hence a
 * single `action` plus an optional lower-emphasis `secondaryAction`.
 */
import type {ReactNode} from 'react';
import {View} from 'react-native';

import {Icon, type IconName} from '../icons';
import {Button} from './Button';
import {Text} from './Text';
import {useTheme} from '../theme/useTheme';

export interface EmptyStateProps {
  readonly icon?: IconName;
  readonly illustration?: ReactNode;
  readonly title: string;
  readonly body: string;
  readonly action?: {readonly label: string; readonly onPress: () => void};
  readonly secondaryAction?: {readonly label: string; readonly onPress: () => void};
  readonly testID?: string;
}

export function EmptyState({
  icon,
  illustration,
  title,
  body,
  action,
  secondaryAction,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.xl,
      }}>
      {illustration ?? (icon ? <Icon name={icon} size="xl" color={theme.color.onSurfaceVariant} /> : null)}

      <Text variant="titleLarge" align="center" isHeading>
        {title}
      </Text>
      <Text variant="bodyLarge" tone="variant" align="center">
        {body}
      </Text>

      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          // `Button` sizes itself with `alignSelf: 'flex-start'`, which
          // beats the parent's `alignItems: 'center'` — every empty state's
          // action sat on the left under centered text.
          style={{marginTop: theme.spacing.xs, alignSelf: 'center'}}
        />
      ) : null}
      {secondaryAction ? (
        <Button
          label={secondaryAction.label}
          onPress={secondaryAction.onPress}
          variant="text"
          style={{alignSelf: 'center'}}
        />
      ) : null}
    </View>
  );
}
