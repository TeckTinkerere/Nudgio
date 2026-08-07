/**
 * Selectable card with a concise behavior summary.
 *
 * MR-03 "Alert style - profile card with concise behavior summary." Bigger
 * and more informative than a `Chip`: a profile choice (Gentle/Standard/
 * Persistent) needs room for what the profile actually *does*, not just its
 * name, so the user isn't picking a mystery label.
 */
import {Pressable, View} from 'react-native';


import {Icon, type IconName} from '../icons';
import {Text} from './Text';
import {useRippleConfig, useTheme} from '../theme/useTheme';

export interface RadioCardProps {
  readonly title: string;
  /** Plain-language behavior summary, e.g. "Heads-up with sound. Full-screen when locked." */
  readonly description: string;
  readonly selected: boolean;
  readonly onPress: () => void;
  readonly icon?: IconName;
  /** e.g. "Not for emergencies." (Persistent profile, ADR-018). */
  readonly notice?: string;
  readonly testID?: string;
}

export function RadioCard({
  title,
  description,
  selected,
  onPress,
  icon,
  notice,
  testID,
}: RadioCardProps) {
  const theme = useTheme();
  const ripple = useRippleConfig();

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{selected, checked: selected}}
      accessibilityLabel={[title, description, notice].filter(Boolean).join('. ')}
      android_ripple={ripple}
      style={({pressed}) => ({
        borderRadius: theme.radius.card,
        borderWidth: selected ? 2 : theme.layout.borderWidth,
        borderColor: selected ? theme.color.primary : theme.color.outlineVariant,
        backgroundColor: selected
          ? theme.color.primaryContainer
          : pressed
            ? theme.color.surfaceContainerHigh
            : theme.color.surfaceContainer,
        padding: theme.spacing.sm,
        flexDirection: 'row',
        gap: theme.spacing.sm,
        alignItems: 'flex-start',
      })}>
      {icon ? (
        <Icon
          name={icon}
          color={selected ? theme.color.onPrimaryContainer : theme.color.onSurfaceVariant}
        />
      ) : null}

      <View style={{flex: 1, gap: 2}}>
        <Text
          variant="titleMedium"
          style={{color: selected ? theme.color.onPrimaryContainer : theme.color.onSurface}}>
          {title}
        </Text>
        <Text
          variant="bodyMedium"
          style={{
            color: selected ? theme.color.onPrimaryContainer : theme.color.onSurfaceVariant,
          }}>
          {description}
        </Text>
        {notice ? (
          <Text variant="labelMedium" tone="variant">
            {notice}
          </Text>
        ) : null}
      </View>

      {/* Selection is also conveyed by border + fill; the check is the
          non-color-dependent confirmation (MR-13 ACC-004). Decorative here —
          the state is already announced via `accessibilityState.selected`. */}
      {selected ? <Icon name="check" color={theme.color.onPrimaryContainer} /> : null}
    </Pressable>
  );
}
