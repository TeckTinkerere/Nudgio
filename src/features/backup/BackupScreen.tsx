/**
 * Backup / export screen (MR-03 "Backup UX" — Export).
 *
 * "Screen summarizes asset count, reminders, estimated size, archive privacy
 * and destination choice... Progress shows files completed and bytes
 * written. On success: filename, size, hash, Share, Done."
 *
 * `beginExport` is wired to the real bridge call (docs/decision-log.md
 * DL-025 onward) — the export itself needs no user-supplied input, so there
 * was nothing standing in the way of wiring this one for real. Progress
 * ticks come from the native `operationProgress` event stream via
 * `useOperationProgress` (moved to `src/hooks/` once media import needed the
 * same subscription — see that file's doc). "Share" is not yet wired to an
 * OS share sheet — Done always works. A document-picker primitive
 * (`pickDocument`, built for media import) now exists and could unblock
 * `ImportScreen`'s own "pick a backup archive" gap; not done here, tracked
 * in TODO.md.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useState} from 'react';

import {useAppContainer} from '../../app/di/useAppContainer';
import type {RootStackParamList} from '../../app/navigation/types';
import {
  AppBar,
  Banner,
  Button,
  Card,
  ProgressBar,
  Screen,
  Stack,
  Text,
} from '../../design-system';
import {useOperationProgress} from '../../hooks';
import {useTranslation} from '../../localization';
import {demoExportPreview} from '../../native-client';
import type {ExportResult} from '../../native-client/types';
import {formatBytes} from '../../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Backup'>;

type ExportPhase = 'idle' | 'exporting' | 'done' | 'failed';

export function BackupScreen({navigation}: Props) {
  const t = useTranslation();
  const container = useAppContainer();
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [result, setResult] = useState<ExportResult | null>(null);
  const progress = useOperationProgress('export', phase === 'exporting');

  const startExport = async () => {
    setPhase('exporting');
    const outcome = await container.repositories.backup.beginExport({});
    if (outcome.ok) {
      setResult(outcome.value);
      setPhase('done');
    } else {
      container.logger.warn('backupScreen.exportFailed', {code: outcome.error.code});
      setPhase('failed');
    }
  };

  const progressFraction =
    progress?.currentItemIndex !== undefined && progress.totalItems
      ? progress.currentItemIndex / progress.totalItems
      : undefined;

  return (
    <Screen hasAppBar scrollable>
      <AppBar
        title={t('backup.export.title')}
        back={{label: t('action.back'), onPress: () => navigation.goBack()}}
      />

      <Stack gap="lg" paddingVertical="md">
        {phase === 'idle' || phase === 'failed' ? (
          <>
            {phase === 'failed' ? (
              <Banner kind="actionNeeded" title={t('error.unexpected.title')} effect={t('error.unexpected.effect')} />
            ) : null}
            <Banner
              kind="neutral"
              title={t('backup.export.title')}
              effect={t('backup.export.privacyWarning')}
            />

            <Card>
              <Stack gap="xs">
                <Stack direction="row" justify="space-between">
                  <Text variant="bodyLarge" tone="variant">
                    {t('backup.export.mediaCount')}
                  </Text>
                  <Text variant="bodyLarge" tabularNumbers>
                    {demoExportPreview.mediaCount}
                  </Text>
                </Stack>
                <Stack direction="row" justify="space-between">
                  <Text variant="bodyLarge" tone="variant">
                    {t('backup.export.reminderCount')}
                  </Text>
                  <Text variant="bodyLarge" tabularNumbers>
                    {demoExportPreview.reminderCount}
                  </Text>
                </Stack>
                <Stack direction="row" justify="space-between">
                  <Text variant="bodyLarge" tone="variant">
                    {t('backup.export.estimatedSize')}
                  </Text>
                  <Text variant="bodyLarge" tabularNumbers>
                    {formatBytes(demoExportPreview.estimatedBytes)}
                  </Text>
                </Stack>
              </Stack>
            </Card>

            <Button
              label={t('backup.export.chooseDestination')}
              onPress={() => {
                // eslint-disable-next-line no-void
                void startExport();
              }}
              fullWidth
            />
          </>
        ) : phase === 'exporting' ? (
          <ProgressBar progress={progressFraction} label={t('backup.export.exporting')} />
        ) : result ? (
          <Stack gap="lg">
            <Stack gap="xs" align="center" paddingVertical="xl">
              <Text variant="headlineMedium" isHeading align="center">
                {t('backup.export.successTitle')}
              </Text>
              <Text variant="bodyLarge" tone="variant" align="center">
                {t('backup.export.successBody', {
                  fileName: result.fileName,
                  size: formatBytes(result.sizeBytes),
                })}
              </Text>
              <Text variant="labelMedium" tone="variant" selectable>
                {t('backup.export.hash', {hash: result.sha256.slice(0, 16)})}
              </Text>
            </Stack>

            <Stack direction="row" gap="xs" justify="center">
              <Button label={t('backup.export.share')} icon="share" onPress={() => undefined} />
              <Button
                label={t('backup.export.done')}
                variant="outlined"
                onPress={() => navigation.goBack()}
              />
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </Screen>
  );
}
