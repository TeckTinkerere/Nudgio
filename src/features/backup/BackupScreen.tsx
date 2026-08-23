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
 * same subscription — see that file's doc). "Share" opens the OS share sheet
 * for the finished archive via `shareBackupExport` (same `ACTION_SEND`/
 * `FileProvider` shape `Library`'s "Export selected" already uses for media).
 * A document-picker primitive (`pickDocument`, built for media import) now
 * exists and could unblock `ImportScreen`'s own "pick a backup archive" gap;
 * not done here, tracked in TODO.md.
 */
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useState} from 'react';
import {StyleSheet} from 'react-native';
import Animated, {ZoomIn} from 'react-native-reanimated';

import {useAppContainer} from '../../app/di/useAppContainer';
import type {RootStackParamList} from '../../app/navigation/types';
import {useToast} from '../../app/toast/ToastProvider';
import {
  AppBar,
  Banner,
  Button,
  Card,
  Icon,
  ProgressBar,
  Screen,
  Stack,
  Text,
  useFloatingAppBar,
  useTheme,
} from '../../design-system';
import type {IconName} from '../../design-system';
import {useMediaList, useOperationProgress, useStartupSnapshot} from '../../hooks';
import {useTranslation} from '../../localization';
import type {ExportResult} from '../../native-client/types';
import {formatBytes} from '../../utils';

type Props = NativeStackScreenProps<RootStackParamList, 'Backup'>;

type ExportPhase = 'idle' | 'exporting' | 'done' | 'failed';

interface SummaryRowProps {
  readonly icon: IconName;
  readonly label: string;
  readonly value: string;
}

/** Icon-accented summary row — previously plain label/value text pairs with no visual anchor. */
function SummaryRow({icon, label, value}: SummaryRowProps) {
  const theme = useTheme();
  return (
    <Stack direction="row" align="center" gap="sm">
      <Icon name={icon} size="sm" color={theme.color.onSurfaceVariant} />
      <Text variant="bodyLarge" tone="variant" style={styles.flexFill}>
        {label}
      </Text>
      <Text variant="bodyLarge" tabularNumbers>
        {value}
      </Text>
    </Stack>
  );
}

/**
 * Reduced-motion-safe success reveal (MR-03 "On success"): a tonal checkmark
 * circle scales/fades in once, then everything else appears normally.
 * `ZoomIn` is skipped entirely under `reduceMotion` rather than swapped for a
 * smaller motion — the checkmark is decorative, the text beside it already
 * carries the "it worked" message on its own.
 */
function SuccessCheckmark() {
  const theme = useTheme();
  const styles = StyleSheet.create({
    circle: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.successContainer,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
  const circle = (
    <Stack style={styles.circle} align="center" justify="center">
      <Icon name="check" size="lg" color={theme.color.onSuccessContainer} />
    </Stack>
  );
  if (theme.a11y.reduceMotion) {
    return circle;
  }
  return <Animated.View entering={ZoomIn.springify().damping(14)}>{circle}</Animated.View>;
}

export function BackupScreen({navigation}: Props) {
  const t = useTranslation();
  const container = useAppContainer();
  const {showToast} = useToast();
  const [phase, setPhase] = useState<ExportPhase>('idle');
  const [result, setResult] = useState<ExportResult | null>(null);
  const [sharing, setSharing] = useState(false);
  const progress = useOperationProgress('export', phase === 'exporting');
  const startup = useStartupSnapshot();
  const appBar = useFloatingAppBar();
  // Sized to the real total so this sums every item's real `sizeBytes`
  // exactly once, not a paginated slice — `beginExport` has no dedicated
  // "estimate size" query of its own, so this is the same real per-item
  // data the Library grid already reads, just totalled client-side.
  const allMedia = useMediaList({sort: 'recent', offset: 0, limit: startup.data?.mediaCount ?? 0});
  const estimatedBytes =
    allMedia.data?.items.reduce((sum, item) => sum + Number(item.sizeBytes), 0) ?? 0;

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

  const shareExport = async () => {
    if (!result) {return;}
    setSharing(true);
    const outcome = await container.repositories.backup.shareBackupExport(result.fileName);
    setSharing(false);
    if (!outcome.ok) {
      showToast({message: t('error.unexpected.effect'), tone: 'error'});
    }
  };

  const progressFraction =
    progress?.currentItemIndex !== undefined && progress.totalItems
      ? progress.currentItemIndex / progress.totalItems
      : undefined;

  return (
    <Screen
      hasAppBar
      scrollable
      onScroll={appBar.onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{paddingTop: appBar.barHeight}}
      appBarSlot={
        <AppBar
          title={t('backup.export.title')}
          back={{label: t('action.back'), onPress: () => navigation.goBack()}}
          floating
          scrolled={appBar.scrolled}
          onHeightChange={appBar.onHeightChange}
        />
      }>
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
              <Stack gap="sm">
                <SummaryRow
                  icon="library"
                  label={t('backup.export.mediaCount')}
                  value={(startup.data?.mediaCount ?? 0).toString()}
                />
                <SummaryRow
                  icon="reminders"
                  label={t('backup.export.reminderCount')}
                  value={(startup.data?.activeReminderCount ?? 0).toString()}
                />
                <SummaryRow
                  icon="backup"
                  label={t('backup.export.estimatedSize')}
                  value={formatBytes(estimatedBytes)}
                />
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
            <Stack gap="sm" align="center" paddingVertical="xl">
              <SuccessCheckmark />
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
              <Button
                label={t('backup.export.share')}
                icon="share"
                loading={sharing}
                onPress={() => {
                  // eslint-disable-next-line no-void -- fire-and-forget: UI feedback is toast-driven on failure only.
                  void shareExport();
                }}
              />
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

const styles = StyleSheet.create({
  flexFill: {flex: 1},
});
