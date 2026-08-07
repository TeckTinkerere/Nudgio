/**
 * High-salience inline message.
 *
 * MR-03 "Capability warning": "A single high-salience card appears only for a
 * condition that affects active reminders... It never blocks browsing."
 * MR-03 "Error and recovery pattern" fixes the anatomy: human title,
 * one-sentence effect, optional preserved-state note, primary recovery action,
 * details behind a disclosure, and a diagnostic code with no file name.
 */
import {View} from 'react-native';

import {Icon, type IconName} from '../icons';
import {Button} from './Button';
import type {StatusKind} from './StatusPill';
import {Text} from './Text';
import {useTheme} from '../theme/useTheme';

export interface BannerProps {
  readonly kind: Exclude<StatusKind, 'ready'>;
  /** Human title, e.g. "Exact timing is off". */
  readonly title: string;
  /** One sentence on the consequence, in plain language. */
  readonly effect: string;
  /** Optional reassurance, e.g. "No library item was created." */
  readonly preservedState?: string;
  readonly action?: {readonly label: string; readonly onPress: () => void};
  /**
   * Diagnostic code shown behind "Details" (MR-03). MUST contain no file name,
   * media title or personal label — the native error envelope guarantees this.
   */
  readonly diagnosticCode?: string;
  readonly testID?: string;
}

const ICON_FOR: Record<BannerProps['kind'], IconName> = {
  limited: 'warning',
  actionNeeded: 'alert',
  neutral: 'info',
};

export function Banner({
  kind,
  title,
  effect,
  preservedState,
  action,
  diagnosticCode,
  testID,
}: BannerProps) {
  const theme = useTheme();
  const role = theme.status[kind];

  return (
    <View
      testID={testID}
      // One announcement, status before consequence, per MR-13's
      // "Status precedes action consequence" rule for capability cards.
      accessible
      accessibilityRole="alert"
      accessibilityLabel={[title, effect, preservedState].filter(Boolean).join('. ')}
      style={{
        flexDirection: 'row',
        gap: theme.spacing.sm,
        padding: theme.layout.cardPadding,
        borderRadius: theme.radius.card,
        backgroundColor: role.container,
        borderWidth: theme.layout.borderWidth,
        borderColor: role.color,
      }}>
      {/* `onContainer`, not `color` — see the note in StatusPill. */}
      <Icon name={ICON_FOR[kind]} size="md" color={role.onContainer} />

      <View style={{flex: 1, gap: theme.spacing.xxs}}>
        <Text variant="titleMedium" style={{color: role.onContainer}}>
          {title}
        </Text>
        <Text variant="bodyMedium" style={{color: role.onContainer}}>
          {effect}
        </Text>
        {preservedState ? (
          <Text variant="bodyMedium" tone="variant">
            {preservedState}
          </Text>
        ) : null}

        {action ? (
          <Button
            label={action.label}
            onPress={action.onPress}
            variant="outlined"
            style={{marginTop: theme.spacing.xs}}
          />
        ) : null}

        {diagnosticCode ? (
          <Text variant="labelMedium" tone="variant" selectable>
            {diagnosticCode}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
