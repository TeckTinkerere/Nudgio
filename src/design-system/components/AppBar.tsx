/**
 * Top app bar.
 *
 * MR-04: screen titles use sentence case and `titleLarge`. The bar consumes
 * the top safe-area inset so `Screen` does not double-pad beneath it.
 *
 * At large font scale the title is allowed to wrap to a second line rather
 * than truncate, because a screen title is orientation-critical content under
 * MR-13's truncation rule.
 */
import {View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {IconName} from '../icons';
import {IconButton} from './IconButton';
import {Text} from './Text';
import {useTheme} from '../theme/useTheme';

export interface AppBarAction {
  readonly icon: IconName;
  /** Required accessible name for an icon-only control. */
  readonly label: string;
  readonly onPress: () => void;
}

export interface AppBarProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly back?: {readonly label: string; readonly onPress: () => void};
  readonly actions?: readonly AppBarAction[];
  readonly testID?: string;
}

export function AppBar({title, subtitle, back, actions = [], testID}: AppBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      style={{
        paddingTop: insets.top,
        paddingHorizontal: theme.spacing.xs,
        paddingBottom: theme.spacing.xs,
        backgroundColor: theme.color.surface,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xxs,
      }}>
      {back ? (
        // `arrowBack` mirrors automatically in RTL via the icon registry.
        <IconButton name="arrowBack" label={back.label} onPress={back.onPress} />
      ) : null}

      <View style={{flex: 1, paddingHorizontal: theme.spacing.xs}}>
        <Text variant="titleLarge" isHeading>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="bodyMedium" tone="variant">
            {subtitle}
          </Text>
        ) : null}
      </View>

      {actions.map(action => (
        <IconButton
          key={action.label}
          name={action.icon}
          label={action.label}
          onPress={action.onPress}
          tone="variant"
        />
      ))}
    </View>
  );
}
