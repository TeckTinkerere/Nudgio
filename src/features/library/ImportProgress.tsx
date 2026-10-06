/**
 * The one progress row every "Import media" entry point shows.
 *
 * Library, its grid and the reminder editor each rendered their own bare
 * `ProgressBar` with no way out — `useImportMedia().cancel` existed and no
 * screen called it. With multi-select a batch can be twenty videos long, so
 * Cancel sits beside the bar wherever it appears: it stops the file being
 * copied and skips the rest, and files already imported stay.
 */
import {StyleSheet, View} from 'react-native';

import {Button, Dialog, ProgressBar, useTheme} from '../../design-system';
import type {useImportMedia} from '../../hooks';
import {formatStorageSize, useTranslation} from '../../localization';

export interface ImportProgressProps {
  readonly importMedia: ReturnType<typeof useImportMedia>;
}

export function ImportProgress({importMedia}: ImportProgressProps) {
  const t = useTranslation();
  const theme = useTheme();
  // Nothing is copying while the large-file question is open.
  if (!importMedia.isImporting || importMedia.largeFilePrompt) {
    return null;
  }
  return (
    <View style={[styles.row, {gap: theme.spacing.sm}]} testID="import-progress">
      <View style={styles.bar}>
        <ProgressBar progress={importMedia.progressFraction} label={importMedia.progressLabel} />
      </View>
      <Button label={t('action.cancel')} variant="text" onPress={importMedia.cancel} />
    </View>
  );
}

/**
 * Questions an import asks before copying (DL-110): today only MR-09's soft
 * warning for files over 500 MB. Rendered once per screen that imports,
 * separately from `ImportProgress`, which some screens show in two places.
 */
export function ImportPrompts({importMedia}: ImportProgressProps) {
  const t = useTranslation();
  const prompt = importMedia.largeFilePrompt;
  if (!prompt) {
    return null;
  }
  return (
    <Dialog
      visible
      title={t('library.import.largeTitle')}
      body={prompt.count === 1
        ? t('library.import.largeBodyOne', {size: formatStorageSize(prompt.largestBytes)})
        : t('library.import.largeBody', {count: prompt.count, size: formatStorageSize(prompt.largestBytes)})}
      cancel={{label: t('action.cancel'), onPress: prompt.decline}}
      confirm={{label: t('library.import.largeConfirm'), onPress: prompt.confirm}}
      testID="import-large-file-prompt"
    />
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center'},
  bar: {flex: 1},
});
