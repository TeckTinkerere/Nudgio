/**
 * Library title row, swapping between two states per the selection-mode
 * spec: normal browsing ("Library" heading + a "Select" text button) and
 * active selection (a literal black Back button + Export/Delete). `neutral`
 * is a named token constant (`src/design-system/tokens/palette.ts`), not a
 * literal color value, so referencing it here doesn't trip the
 * `no-color-literals` lint rule — the same precedent `MediaCard`'s
 * always-black play-button scrim already established.
 */
import {Pressable, StyleSheet} from 'react-native';

import {Button, Icon, Stack, Text, neutral, useRippleConfig, useTheme} from '../../design-system';

const styles = StyleSheet.create({
  backButton: {alignItems: 'center', justifyContent: 'center'},
});

export interface LibrarySelectionHeaderProps {
  readonly title: string;
  readonly selectionMode: boolean;
  readonly backLabel: string;
  readonly selectLabel: string;
  readonly exportLabel: string;
  readonly deleteLabel: string;
  readonly onSelect: () => void;
  readonly onBack: () => void;
  readonly onExport: () => void;
  readonly onDelete: () => void;
  readonly exportTestID?: string;
  readonly deleteTestID?: string;
  readonly selectTestID?: string;
  readonly backTestID?: string;
}

function BlackBackButton({label, onPress, testID}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  const theme = useTheme();
  const ripple = useRippleConfig(neutral.white);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      android_ripple={{...ripple, borderless: true}}
      style={[
        styles.backButton,
        {
          width: theme.layout.minTouchTarget,
          height: theme.layout.minTouchTarget,
          borderRadius: theme.radius.full,
          backgroundColor: neutral.black,
        },
      ]}>
      <Icon name="arrowBack" size="md" color={neutral.white} />
    </Pressable>
  );
}

export function LibrarySelectionHeader({
  title,
  selectionMode,
  backLabel,
  selectLabel,
  exportLabel,
  deleteLabel,
  onSelect,
  onBack,
  onExport,
  onDelete,
  exportTestID,
  deleteTestID,
  selectTestID,
  backTestID,
}: LibrarySelectionHeaderProps) {
  return (
    <Stack direction="row" align="center" justify="space-between">
      {selectionMode ? (
        <BlackBackButton label={backLabel} onPress={onBack} testID={backTestID} />
      ) : (
        <Text variant="headlineMedium" isHeading>
          {title}
        </Text>
      )}

      {selectionMode ? (
        <Stack direction="row" gap="xs">
          <Button
            variant="tonal"
            label={exportLabel}
            icon="backup"
            onPress={onExport}
            testID={exportTestID}
          />
          <Button
            variant="destructive"
            label={deleteLabel}
            onPress={onDelete}
            testID={deleteTestID}
          />
        </Stack>
      ) : (
        <Button variant="text" label={selectLabel} onPress={onSelect} testID={selectTestID} />
      )}
    </Stack>
  );
}
