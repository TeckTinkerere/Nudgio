/**
 * Large title used on top-level tabs (Upcoming, Library, Reminders, Settings).
 *
 * Stack screens keep `AppBar` with a back control. Tabs do not — they share
 * this headline so chrome does not drift between destinations.
 */
import {View} from 'react-native';

import {Text} from './Text';
import {useTheme} from '../theme/useTheme';

export interface ScreenHeaderProps {
  readonly title: string;
  readonly trailing?: React.ReactNode;
  readonly testID?: string;
}

export function ScreenHeader({title, trailing, testID}: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
      }}>
      <Text variant="headlineMedium" isHeading style={{flex: 1}}>
        {title}
      </Text>
      {trailing}
    </View>
  );
}
