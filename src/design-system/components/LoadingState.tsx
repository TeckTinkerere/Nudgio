import {ActivityIndicator, View} from 'react-native';

import {Text} from './Text';
import {useTheme} from '../theme/useTheme';


export interface LoadingStateProps {
  /** Required: an unlabelled spinner is meaningless to TalkBack (ACC-001). */
  readonly label: string;
  readonly testID?: string;
}

/**
 * MR-07 startup rule: "Long repair operations surface as a dedicated state
 * rather than blocking a blank splash screen." This component is that state —
 * it always carries a label saying what is happening.
 */
export function LoadingState({label, testID}: LoadingStateProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{text: label}}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.xl,
      }}>
      <ActivityIndicator size="large" color={theme.color.primary} />
      <Text variant="bodyLarge" tone="variant" align="center">
        {label}
      </Text>
    </View>
  );
}
