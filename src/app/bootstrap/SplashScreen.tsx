/**
 * The branded first frame, shown while `useAppBootstrap` resolves.
 *
 * Before this, a cold start showed the generic `LoadingState` spinner — the
 * same component an empty list uses — so the first thing a new user saw was
 * indistinguishable from a screen that had failed to load. This is the app
 * identifying itself instead.
 *
 * Deliberately not a native/system splash. Android's windowSplashScreen is
 * drawn by the OS before any JS runs, so it cannot show bootstrap progress,
 * cannot become a welcome animation, and cannot react to the repair state.
 * This renders inside the app, which is also what makes the extension point
 * below possible.
 *
 * Extension point: `caption` is the only moving part today, but the mark is
 * already isolated in its own centred slot. A future welcome animation
 * replaces `<BrandLogo />` here — e.g. a Reanimated entrance, or the mark
 * drawing itself in — without touching `StartupGate`, which only decides
 * *when* a splash is appropriate, never what it contains. Keep that split:
 * animation belongs in this file, phase logic belongs in the gate.
 */
import {StyleSheet, View} from 'react-native';

import {Stack, Text} from '../../design-system';
import {BrandLogo} from '../../design-system/components/BrandLogo';

export interface SplashScreenProps {
  /** Status line under the mark. Omitted while nothing useful can be said. */
  readonly caption?: string;
  readonly testID?: string;
}

export function SplashScreen({caption, testID}: SplashScreenProps) {
  return (
    <View style={styles.fill} testID={testID}>
      <Stack gap="lg" align="center" justify="center" style={styles.fill}>
        <BrandLogo />
        <Stack gap="xs" align="center">
          <Text variant="headlineMedium" isHeading align="center">
            Nudgio
          </Text>
          {caption ? (
            <Text variant="bodyMedium" tone="variant" align="center">
              {caption}
            </Text>
          ) : null}
        </Stack>
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
